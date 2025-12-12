import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";
import { refreshAccessToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function generatePublicCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без 0/O/1/I
  const len = 5 + Math.floor(Math.random() * 3); // 5-7
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function POST(req: Request) {
  const DEBUG = process.env.NODE_ENV !== "production";
  const dlog = (...args: any[]) => { if (DEBUG) console.log(...args); };
  const dwarn = (...args: any[]) => { if (DEBUG) console.warn(...args); };

  dlog("[CALC-BASE] ===== POST /api/calc-base called =====");
  
  let token = cookies().get("directus_access_token")?.value;
  const refreshToken = cookies().get("directus_refresh_token")?.value;
  const directusUrl = getDirectusUrl();
  const n8nUrl = process.env.N8N_CALC_URL;

  dlog("[CALC-BASE] Initial check:", {
    hasToken: !!token,
    hasRefreshToken: !!refreshToken,
    hasDirectusUrl: !!directusUrl,
    hasN8nUrl: !!n8nUrl,
    n8nUrl: n8nUrl ? "configured" : "NOT SET"
  });

  if (!token && !refreshToken) {
    console.error("[CALC-BASE] No tokens found, returning 401");
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!n8nUrl) {
    console.error("[CALC-BASE] N8N_CALC_URL is not configured");
    return NextResponse.json({ message: "No N8N_CALC_URL configured" }, { status: 400 });
  }
  
  dlog("[CALC-BASE] Starting calculation request", {
    hasToken: !!token,
    hasRefreshToken: !!refreshToken,
    n8nUrl: n8nUrl ? "configured" : "NOT SET",
    directusUrl: directusUrl ? "configured" : "NOT SET"
  });

  // ОБЯЗАТЕЛЬНЫЙ REFRESH перед отправкой в n8n для получения свежего токена
  if (refreshToken) {
    dlog("[CALC-BASE] Refreshing token before n8n request...");
    const freshToken = await refreshAccessToken(refreshToken);
    if (freshToken) {
      token = freshToken;
      dlog("[CALC-BASE] Token refreshed successfully");
    } else {
      dwarn("[CALC-BASE] Token refresh failed, using existing token");
    }
  }

  if (!token) {
    return NextResponse.json({ message: "Unauthorized - no valid token" }, { status: 401 });
  }

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const { clientId, name, birthday } = payload || {};
  const publicCode = generatePublicCode();
  if (!name || !birthday) {
    return NextResponse.json({ message: "Нужны name и birthday" }, { status: 400 });
  }

  // 0) Получаем gender из данных клиента, если clientId указан
  let clientGender: string | null = null;
  if (clientId && directusUrl) {
    try {
      const clientRes = await fetch(`${directusUrl}/items/clients/${clientId}?fields=gender`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
      if (clientRes.ok) {
        const clientData = await clientRes.json().catch(() => ({}));
        clientGender = clientData?.data?.gender || null;
      }
    } catch (error) {
      dwarn("[CALC-BASE] Failed to fetch client gender:", error);
    }
  }

  // 1) Пытаемся создать пустой профиль в Directus, чтобы получить profileId для дальнейшего поллинга
  let profileId: number | null = null;
  if (directusUrl) {
    try {
      // Получим текущего пользователя, чтобы проставить owner_user
      let ownerUserId: string | null = null;
      try {
        const meRes = await fetch(`${directusUrl}/users/me`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          cache: "no-store",
        });
        if (meRes.ok) {
          const me = await meRes.json().catch(() => ({}));
          ownerUserId = me?.data?.id || null;
        }
      } catch { }

      const createRes = await fetch(`${directusUrl}/items/profiles`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId ? Number(clientId) : null,
          ...(ownerUserId ? { owner_user: ownerUserId } : {}),
        }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (createRes.ok && createData?.data?.id) {
        profileId = Number(createData.data.id);
        dlog("[CALC-BASE] Profile created, profileId:", profileId);
      }
    } catch (error) {
      console.error("[CALC-BASE] Failed to create profile:", error);
    }
  }

  // 1.1) Best-effort: попробуем записать public_code в профиль, если поле существует
  if (directusUrl && profileId) {
    try {
      await fetch(`${directusUrl}/items/profiles/${profileId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ public_code: publicCode }),
      }).catch(() => { });
    } catch { }
  }

  // 2) Вызываем n8n, передаём profileId (если удалось создать) и publicCode
  let r: Response;
  let data: any = null;
  try {
    // Retry logic for n8n
    let attempts = 0;
    const maxAttempts = 2;

    // Убеждаемся, что directusUrl правильный и без слеша в конце
    const cleanDirectusUrl = directusUrl ? directusUrl.replace(/\/+$/, '') : null;

    const n8nPayload = {
      name,
      birthday,
      clientId,
      type: "base_new", // Новый тип для тестовой среды
      profileId, // важно для последующего обновления профиля n8n
      public_code: publicCode,
      // Gender клиента (если есть)
      gender: clientGender || null,
      // Передаем URL Directus для n8n workflow (без слеша в конце)
      directusUrl: cleanDirectusUrl,
      // Передаем токены в body для n8n workflow
      token: token, // access token (может истечь)
      refreshToken: refreshToken, // refresh token для обновления access token в n8n
    };

    dlog("[CALC-BASE] Payload to n8n:", {
      directusUrl: n8nPayload.directusUrl,
      hasToken: !!n8nPayload.token,
      hasRefreshToken: !!n8nPayload.refreshToken,
      type: n8nPayload.type,
      profileId: n8nPayload.profileId,
      clientId: n8nPayload.clientId,
      name: n8nPayload.name,
      birthday: n8nPayload.birthday
    });

    dlog("[CALC-BASE] Calling n8n workflow:", {
      url: n8nUrl,
      type: "base_new",
      profileId,
      directusUrl: directusUrl ? "configured" : "NOT SET",
      hasDirectusUrl: !!directusUrl,
      hasToken: !!token,
      hasRefreshToken: !!refreshToken
    });

    while (attempts < maxAttempts) {
      attempts++;
      try {
        dlog(`[CALC-BASE] Attempt ${attempts}/${maxAttempts} - Sending request to n8n...`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);

        const fetchStartTime = Date.now();
        r = await fetch(n8nUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(n8nPayload),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        
        const fetchDuration = Date.now() - fetchStartTime;
        dlog(`[CALC-BASE] n8n request completed in ${fetchDuration}ms, status: ${r.status}`);

        // If successful or client error (4xx), break loop
        // Only retry on server errors (5xx)
        if (r.ok || r.status < 500) {
          break;
        }

        dwarn(`[CALC-BASE] n8n attempt ${attempts} failed with status ${r.status}`);
        const errorText = await r.text().catch(() => "");
        dwarn(`[CALC-BASE] n8n error response:`, errorText.substring(0, 500));
      } catch (e: any) {
        console.error(`[CALC-BASE] n8n attempt ${attempts} failed with error:`, {
          message: e?.message || String(e),
          name: e?.name,
          stack: e?.stack?.substring(0, 500)
        });
        if (attempts === maxAttempts) {
          console.error("[CALC-BASE] All attempts failed, throwing error");
          throw e;
        }
      }

      // Wait before retry if not last attempt
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // @ts-ignore
    if (!r) throw new Error("No response from n8n");

    data = await r.json().catch(() => ({}));

    console.log("[CALC-BASE] n8n response:", {
      status: r.status,
      statusText: r.statusText,
      hasData: !!data,
      error: data?.error || data?.message
    });
  } catch (error: any) {
    console.error("[CALC-BASE] Error calling n8n:", {
      message: error?.message || String(error),
      name: error?.name,
      stack: error?.stack?.substring(0, 500),
      n8nUrl: n8nUrl,
      hasN8nUrl: !!n8nUrl
    });
    return NextResponse.json({ 
      message: "Cannot connect to n8n", 
      error: error?.message || String(error),
      n8nUrl: n8nUrl ? "configured" : "not configured"
    }, { status: 502 });
  }

  if (!r.ok) {
    let msg = data?.message || data?.error || "Calculation failed";
    // Улучшенная обработка ошибок n8n
    if (data?.error?.message) {
      msg = data.error.message;
    } else if (data?.error?.name) {
      msg = `${data.error.name}: ${data.error.message || msg}`;
    } else if (typeof data === 'string') {
      msg = data;
    } else if (data?.errors && Array.isArray(data.errors)) {
      msg = data.errors.map((e: any) => e.message || String(e)).join('; ');
    }

    // Логируем полную ошибку для диагностики
    console.error("[CALC-BASE] n8n calculation error:", {
      status: r.status,
      statusText: r.statusText,
      data: data,
      message: msg
    });

    // Специальная обработка ошибки с directus node - показываем детали
    if (msg.includes('directus') || msg.includes('n8n-nodes-directus') || msg.includes('Unrecognized node type')) {
      const detailMsg = data?.error?.message || data?.message || msg;
      msg = `Ошибка в n8n workflow: ${detailMsg}. Проверьте настройки Directus node в n8n workflow (URL: ${directusUrl || 'не указан'}).`;
    }

    return NextResponse.json({
      ...data,
      message: msg,
      errorDetails: data?.error || data?.errors || null
    }, { status: r.status });
  }

  // 3) Гарантируем возврат profileId + publicCode для мгновенного редиректа и отображения
  const returnedId =
    profileId || data?.profileId || data?.data?.profileId || data?.id || data?.data?.id || null;

  if (returnedId) {
    return NextResponse.json({ profileId: Number(returnedId), public_code: publicCode });
  }

  // Fallback: если id так и нет, возвращаем как есть (клиентская логика отправит на список)
  return NextResponse.json({ ...data, public_code: publicCode });
}
