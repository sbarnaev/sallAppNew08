import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

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

/**
 * Обновляет access token через refresh token
 * Возвращает новый access token или null в случае ошибки
 */
async function refreshAccessToken(refreshToken: string, baseUrl: string): Promise<string | null> {
  try {
    const refreshUrl = `${baseUrl}/auth/refresh`;
    const res = await fetch(refreshUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error("[CALC] Token refresh failed:", res.status, res.statusText);
      return null;
    }

    const data = await res.json().catch(() => ({}));
    return data?.data?.access_token || null;
  } catch (error) {
    console.error("[CALC] Error refreshing token:", error);
    return null;
  }
}

export async function POST(req: Request) {
  let token = cookies().get("directus_access_token")?.value;
  const refreshToken = cookies().get("directus_refresh_token")?.value;
  const directusUrl = getDirectusUrl();
  const n8nUrl = process.env.N8N_CALC_URL;
  
  if (!token && !refreshToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!n8nUrl) return NextResponse.json({ message: "No N8N_CALC_URL configured" }, { status: 400 });

  // ОБЯЗАТЕЛЬНЫЙ REFRESH перед отправкой в n8n для получения свежего токена
  if (refreshToken && directusUrl) {
    console.log("[CALC] Refreshing token before n8n request...");
    const freshToken = await refreshAccessToken(refreshToken, directusUrl);
    if (freshToken) {
      token = freshToken;
      console.log("[CALC] Token refreshed successfully");
    } else {
      console.warn("[CALC] Token refresh failed, using existing token");
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

  const { clientId, name, birthday, type, request, clientRequest, query, prompt, partnerName, partnerBirthday, goal } = payload || {};
  const publicCode = generatePublicCode();

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
          const me = await meRes.json().catch(()=>({}));
          ownerUserId = me?.data?.id || null;
        }
      } catch {}

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
      }
    } catch {
      // игнорируем — fallback ниже
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
      }).catch(() => {});
    } catch {}
  }

  // 2) Вызываем n8n, передаём profileId (если удалось создать) и publicCode
  let r: Response;
  let data: any = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    
    // Убеждаемся, что directusUrl правильный и без слеша в конце
    const cleanDirectusUrl = directusUrl ? directusUrl.replace(/\/+$/, '') : null;
    
    const payload = {
      name,
      birthday,
      clientId,
      type: type || "base",
      profileId, // важно для последующего обновления профиля n8n
      public_code: publicCode,
      // Дополнительный запрос пользователя (для целевого расчёта)
      request: request ?? clientRequest ?? query ?? prompt ?? null,
      // Поля для партнерского расчета
      partnerName: type === "partner" ? partnerName : undefined,
      partnerBirthday: type === "partner" ? partnerBirthday : undefined,
      goal: type === "partner" ? goal : undefined,
      // Передаем URL Directus для n8n workflow (без слеша в конце)
      directusUrl: cleanDirectusUrl,
      // Передаем токены в body для n8n workflow
      token: token, // access token (может истечь)
      refreshToken: refreshToken, // refresh token для обновления access token в n8n
    };
    
    console.log("Payload to n8n:", {
      directusUrl: payload.directusUrl,
      hasToken: !!payload.token,
      hasRefreshToken: !!payload.refreshToken,
      type: payload.type
    });
    
    console.log("Calling n8n workflow:", {
      url: n8nUrl,
      type: type || "base",
      profileId,
      directusUrl: directusUrl, // Логируем полный URL для диагностики
      hasDirectusUrl: !!directusUrl,
      hasToken: !!token,
      hasRefreshToken: !!refreshToken
    });
    
    // Проверяем, что directusUrl правильный
    if (directusUrl && !directusUrl.includes('sposobniymaster.online')) {
      console.warn("WARNING: Directus URL might be incorrect:", directusUrl);
    }
    
    r = await fetch(n8nUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    data = await r.json().catch(() => ({}));
    
    console.log("n8n response:", {
      status: r.status,
      statusText: r.statusText,
      hasData: !!data,
      error: data?.error || data?.message
    });
  } catch (error) {
    console.error("Error calling n8n:", error);
    return NextResponse.json({ message: "Cannot connect to n8n", error: String(error), n8nUrl }, { status: 502 });
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
    console.error("n8n calculation error:", {
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
