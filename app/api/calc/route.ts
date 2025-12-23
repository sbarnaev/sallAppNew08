import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

import { refreshAccessToken } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  generateBaseConsultation,
  generateTargetConsultation,
  generatePartnerConsultation,
  generateChildConsultation,
  saveConsultationToProfile,
  BaseCalculationInput,
  TargetCalculationInput,
  PartnerCalculationInput,
  ChildCalculationInput,
} from "@/lib/sal-generation";
import { calculateSALCodes } from "@/lib/sal-codes";

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
  logger.debug("[CALC] POST /api/calc");
  
  let token = cookies().get("directus_access_token")?.value;
  const refreshToken = cookies().get("directus_refresh_token")?.value;
  const directusUrl = getDirectusUrl();
  
  // Используем серверную генерацию вместо n8n
  const useServerGeneration = process.env.USE_SERVER_GENERATION !== "false"; // По умолчанию true
  const n8nUrl = process.env.N8N_CALC_URL;

  logger.debug("[CALC] Initial check:", {
    hasToken: !!token,
    hasRefreshToken: !!refreshToken,
    hasDirectusUrl: !!directusUrl,
    hasN8nUrl: !!n8nUrl,
    n8nUrl: n8nUrl ? "configured" : "NOT SET"
  });

  if (!token && !refreshToken) {
    logger.error("[CALC] No tokens found, returning 401");
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  
  if (!directusUrl) {
    return NextResponse.json({ message: "DIRECTUS_URL not configured" }, { status: 500 });
  }
  
  logger.debug("[CALC] Starting calculation request", {
    hasToken: !!token,
    hasRefreshToken: !!refreshToken,
    n8nUrl: n8nUrl ? "configured" : "NOT SET",
    directusUrl: directusUrl ? "configured" : "NOT SET"
  });

  // ОБЯЗАТЕЛЬНЫЙ REFRESH перед отправкой в n8n для получения свежего токена
  if (refreshToken) {
    logger.debug("[CALC] Refreshing token before n8n request...");
    const freshToken = await refreshAccessToken(refreshToken);
    if (freshToken) {
      token = freshToken;
      logger.debug("[CALC] Token refreshed successfully");
    } else {
      logger.warn("[CALC] Token refresh failed, using existing token");
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

  // Функция для очистки текста от переносов строк и специальных символов
  function cleanText(text: string | null | undefined): string | null {
    if (!text || typeof text !== "string") return null;
    return text
      .replace(/\r\n/g, " ") // Windows переносы
      .replace(/\n/g, " ") // Unix переносы
      .replace(/\r/g, " ") // Mac переносы
      .replace(/\t/g, " ") // Табуляции
      .replace(/[^\x20-\x7E\u0400-\u04FF]/g, " ") // Удаляем все непечатаемые символы кроме пробела и кириллицы/латиницы
      .replace(/\s+/g, " ") // Множественные пробелы в один
      .trim();
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
      logger.warn("[CALC] Failed to fetch client gender:", error);
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
      }).catch(() => { });
    } catch { }
  }

  // Если включена серверная генерация, используем её
  if (useServerGeneration) {
    logger.debug("[CALC] Using server-side generation");
    try {
      // Рассчитываем коды
      const codes = calculateSALCodes(birthday);
      if (!codes) {
        throw new Error("Failed to calculate SAL codes");
      }

      const codesArray = [
        codes.personality,
        codes.connector,
        codes.realization,
        codes.generator,
        codes.mission,
      ];

      // Генерируем консультацию в зависимости от типа
      let consultationResult: any;
      const calculationType = type || "base";

      if (calculationType === "base") {
        const input: BaseCalculationInput = {
          name,
          birthday,
          clientId: clientId ? Number(clientId) : undefined,
          gender: clientGender || null,
        };
        consultationResult = await generateBaseConsultation(input);
      } else if (calculationType === "target") {
        const requestText = cleanText(request ?? clientRequest ?? query ?? prompt ?? null) || "";
        const input: TargetCalculationInput = {
          name,
          birthday,
          request: requestText,
          clientId: clientId ? Number(clientId) : undefined,
          gender: clientGender || null,
        };
        consultationResult = await generateTargetConsultation(input);
      } else if (calculationType === "partner") {
        if (!partnerName || !partnerBirthday || !goal) {
          throw new Error("For partner calculation, partnerName, partnerBirthday and goal are required");
        }
        const goalText = cleanText(goal) || "";
        const input: PartnerCalculationInput = {
          name,
          birthday,
          partnerName,
          partnerBirthday,
          goal: goalText,
          clientId: clientId ? Number(clientId) : undefined,
          gender: clientGender || null,
        };
        consultationResult = await generatePartnerConsultation(input);
      } else if (calculationType === "child") {
        const requestText = cleanText(request ?? clientRequest ?? query ?? prompt ?? null);
        const input: ChildCalculationInput = {
          name,
          birthday,
          request: requestText || null, // Опциональный запрос
          clientId: clientId ? Number(clientId) : undefined,
          gender: clientGender || null,
        };
        consultationResult = await generateChildConsultation(input);
      } else {
        throw new Error(`Unknown calculation type: ${calculationType}`);
      }

      // Сохраняем результат в профиль
      if (profileId) {
        if (!token || !directusUrl) {
          throw new Error("Token or directusUrl is missing");
        }
        await saveConsultationToProfile(
          profileId,
          consultationResult,
          calculationType,
          codesArray,
          token,
          directusUrl
        );
      }

      logger.debug("[CALC] Server generation completed successfully");
      return NextResponse.json({ profileId, public_code: publicCode });
    } catch (error: any) {
      logger.error("[CALC] Server generation error:", {
        message: error?.message || String(error),
        stack: error?.stack?.substring(0, 500),
      });
      // Fallback на n8n если настроен
      if (n8nUrl) {
        logger.debug("[CALC] Falling back to n8n after error");
      } else {
        return NextResponse.json(
          { message: "Server generation failed", error: error?.message || String(error) },
          { status: 500 }
        );
      }
    }
  }

  // Fallback на n8n если серверная генерация не используется или не удалась
  if (!n8nUrl) {
    logger.error("[CALC] Neither server generation nor N8N_CALC_URL is configured");
    return NextResponse.json({ message: "No calculation method configured" }, { status: 400 });
  }

  // 2) Вызываем n8n, передаём profileId (если удалось создать) и publicCode
  let r: Response | null = null;
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
      type: type || "base",
      profileId, // важно для последующего обновления профиля n8n
      public_code: publicCode,
      // Gender клиента (если есть)
      gender: clientGender || null,
      // Дополнительный запрос пользователя (для целевого расчёта) - очищаем от переносов строк
      request: cleanText(request ?? clientRequest ?? query ?? prompt ?? null),
      // Поля для партнерского расчета
      partnerName: type === "partner" ? partnerName : undefined,
      partnerBirthday: type === "partner" ? partnerBirthday : undefined,
      goal: type === "partner" ? cleanText(goal) : undefined,
      // Передаем URL Directus для n8n workflow (без слеша в конце)
      directusUrl: cleanDirectusUrl,
      // Передаем токены в body для n8n workflow
      token: token, // access token (может истечь)
      refreshToken: refreshToken, // refresh token для обновления access token в n8n
    };

    logger.debug("[CALC] Payload to n8n:", {
      directusUrl: n8nPayload.directusUrl,
      hasToken: !!n8nPayload.token,
      hasRefreshToken: !!n8nPayload.refreshToken,
      type: n8nPayload.type,
      profileId: n8nPayload.profileId,
      clientId: n8nPayload.clientId,
      name: n8nPayload.name,
      birthday: n8nPayload.birthday
    });

    logger.debug("[CALC] Calling n8n workflow:", {
      url: n8nUrl,
      type: type || "base",
      profileId,
      directusUrl: directusUrl ? "configured" : "NOT SET",
      hasDirectusUrl: !!directusUrl,
      hasToken: !!token,
      hasRefreshToken: !!refreshToken
    });

    // Проверяем, что directusUrl правильный
    if (directusUrl && !directusUrl.includes('sposobniymaster.online')) {
      logger.warn("[CALC] WARNING: Directus URL might be incorrect:", directusUrl);
    }

    while (attempts < maxAttempts) {
      attempts++;
      try {
        logger.debug(`[CALC] Attempt ${attempts}/${maxAttempts} - Sending request to n8n...`);
        
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
        logger.debug(`[CALC] n8n request completed in ${fetchDuration}ms, status: ${r.status}`);

        // If successful or client error (4xx), break loop
        // Only retry on server errors (5xx)
        if (r.ok || r.status < 500) {
          break;
        }

        logger.warn(`[CALC] n8n attempt ${attempts} failed with status ${r.status}`);
        const errorText = await r.text().catch(() => "");
        logger.warn(`[CALC] n8n error response:`, errorText.substring(0, 500));
      } catch (e: any) {
        logger.error(`[CALC] n8n attempt ${attempts} failed with error:`, {
          message: e?.message || String(e),
          name: e?.name,
          stack: e?.stack?.substring(0, 500)
        });
        if (attempts === maxAttempts) {
          logger.error("[CALC] All attempts failed, throwing error");
          throw e;
        }
      }

      // Wait before retry if not last attempt
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!r) throw new Error("No response from n8n");

    data = await r.json().catch(() => ({}));

    logger.debug("n8n response:", {
      status: r.status,
      statusText: r.statusText,
      hasData: !!data,
      error: data?.error || data?.message
    });
  } catch (error: any) {
    logger.error("[CALC] Error calling n8n:", {
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

  // TypeScript guard: после проверки выше r не может быть null
  if (!r || !r.ok) {
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
    logger.error("n8n calculation error:", {
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
