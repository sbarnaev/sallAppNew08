/**
 * Серверная генерация консультаций САЛ (замена n8n)
 * Поддерживает базовый, целевой и партнерский расчеты
 */

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

export async function POST(req: Request) {
  logger.debug("[CALC-SERVER] POST /api/calc-server");

  let token = cookies().get("directus_access_token")?.value;
  const refreshToken = cookies().get("directus_refresh_token")?.value;
  const directusUrl = getDirectusUrl();

  if (!token && !refreshToken) {
    logger.error("[CALC-SERVER] No tokens found, returning 401");
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Обновляем токен перед запросами
  if (refreshToken) {
    logger.debug("[CALC-SERVER] Refreshing token...");
    const freshToken = await refreshAccessToken(refreshToken);
    if (freshToken) {
      token = freshToken;
      logger.debug("[CALC-SERVER] Token refreshed successfully");
    } else {
      logger.warn("[CALC-SERVER] Token refresh failed, using existing token");
    }
  }

  if (!token) {
    return NextResponse.json({ message: "Unauthorized - no valid token" }, { status: 401 });
  }

  if (!directusUrl) {
    return NextResponse.json({ message: "DIRECTUS_URL not configured" }, { status: 500 });
  }

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const { clientId, name, birthday, type, request, clientRequest, query, prompt, partnerName, partnerBirthday, goal, gender } = payload || {};
  const publicCode = generatePublicCode();

  // Определяем тип расчета
  const calculationType = type || "base";

  // Валидация обязательных полей
  if (!name || !birthday) {
    return NextResponse.json({ message: "name и birthday обязательны" }, { status: 400 });
  }

  // Для партнерского расчета нужны дополнительные поля
  if (calculationType === "partner") {
    if (!partnerName || !partnerBirthday || !goal) {
      return NextResponse.json(
        { message: "Для партнерского расчета нужны partnerName, partnerBirthday и goal" },
        { status: 400 }
      );
    }
  }

  // Для целевого расчета нужен request
  if (calculationType === "target") {
    const requestText = cleanText(request ?? clientRequest ?? query ?? prompt ?? null);
    if (!requestText) {
      return NextResponse.json(
        { message: "Для целевого расчета нужен request" },
        { status: 400 }
      );
    }
  }

  // Для детского расчета request опционален (общий расчет или с запросом)

  try {
    // 1. Создаем профиль в Directus
    let profileId: number | null = null;
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
    } catch (error) {
      logger.warn("[CALC-SERVER] Failed to get current user:", error);
    }

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
        public_code: publicCode,
      }),
    });

    const createData = await createRes.json().catch(() => ({}));
    if (createRes.ok && createData?.data?.id) {
      profileId = Number(createData.data.id);
      logger.debug("[CALC-SERVER] Profile created, profileId:", profileId);
    } else {
      logger.error("[CALC-SERVER] Failed to create profile:", createData);
      return NextResponse.json(
        { message: "Failed to create profile", error: createData },
        { status: createRes.status || 500 }
      );
    }

    // 2. Рассчитываем коды САЛ
    const codes = calculateSALCodes(birthday);
    if (!codes) {
      logger.error("[CALC-SERVER] Failed to calculate SAL codes");
      return NextResponse.json(
        { message: "Failed to calculate SAL codes" },
        { status: 400 }
      );
    }

    const codesArray = [
      codes.personality,
      codes.connector,
      codes.realization,
      codes.generator,
      codes.mission,
    ];

    // 3. Генерируем консультацию
    let consultationResult: any;

    try {
      if (calculationType === "base") {
        const input: BaseCalculationInput = {
          name,
          birthday,
          clientId: clientId ? Number(clientId) : undefined,
          gender: gender || null,
        };
        consultationResult = await generateBaseConsultation(input);
      } else if (calculationType === "target") {
        const requestText = cleanText(request ?? clientRequest ?? query ?? prompt ?? null) || "";
        const input: TargetCalculationInput = {
          name,
          birthday,
          request: requestText,
          clientId: clientId ? Number(clientId) : undefined,
          gender: gender || null,
        };
        consultationResult = await generateTargetConsultation(input);
      } else if (calculationType === "partner") {
        const goalText = cleanText(goal) || "";
        const input: PartnerCalculationInput = {
          name,
          birthday,
          partnerName,
          partnerBirthday,
          goal: goalText,
          clientId: clientId ? Number(clientId) : undefined,
          gender: gender || null,
        };
        consultationResult = await generatePartnerConsultation(input);
      } else if (calculationType === "child") {
        const requestText = cleanText(request ?? clientRequest ?? query ?? prompt ?? null);
        const input: ChildCalculationInput = {
          name,
          birthday,
          request: requestText || null, // Опциональный запрос
          clientId: clientId ? Number(clientId) : undefined,
          gender: gender || null,
        };
        consultationResult = await generateChildConsultation(input);
      } else {
        return NextResponse.json(
          { message: `Unknown calculation type: ${calculationType}` },
          { status: 400 }
        );
      }

      logger.debug("[CALC-SERVER] Consultation generated successfully");
    } catch (error: any) {
      logger.error("[CALC-SERVER] Error generating consultation:", {
        message: error?.message || String(error),
        type: calculationType,
      });
      return NextResponse.json(
        {
          message: "Failed to generate consultation",
          error: error?.message || String(error),
        },
        { status: 500 }
      );
    }

    // 4. Сохраняем результат в профиль
    try {
      await saveConsultationToProfile(
        profileId,
        consultationResult,
        calculationType,
        codesArray,
        token,
        directusUrl
      );
      logger.debug("[CALC-SERVER] Consultation saved to profile successfully");
    } catch (error: any) {
      logger.error("[CALC-SERVER] Error saving consultation:", {
        message: error?.message || String(error),
        profileId,
        type: calculationType,
      });
      // Возвращаем ошибку, так как сохранение критично
      // Но профиль уже создан, можно попробовать сохранить позже вручную
      return NextResponse.json(
        {
          message: "Консультация сгенерирована, но не удалось сохранить в профиль",
          error: error?.message || String(error),
          profileId,
          suggestion: "Попробуйте сохранить результат вручную через API",
        },
        { status: 500 }
      );
    }

    // 5. Возвращаем результат
    return NextResponse.json({
      profileId,
      public_code: publicCode,
      success: true,
    });
  } catch (error: any) {
    logger.error("[CALC-SERVER] Unexpected error:", {
      message: error?.message || String(error),
      stack: error?.stack?.substring(0, 500),
    });
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

