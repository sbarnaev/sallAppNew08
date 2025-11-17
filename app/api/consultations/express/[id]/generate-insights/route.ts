import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDirectusUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { calculateSALCodes } from "@/lib/sal-codes";

export const dynamic = "force-dynamic";

/**
 * Генерирует AI-инсайты для экспресс-консультации на основе данных клиента
 * Использует n8n workflow для генерации контента
 */
export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const token = cookies().get("directus_access_token")?.value;
  const refreshToken = cookies().get("directus_refresh_token")?.value;
  const baseUrl = getDirectusUrl();
  const n8nUrl = process.env.N8N_CALC_URL;
  
  if (!token || !baseUrl) {
    return NextResponse.json({ message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });
  }

  if (!n8nUrl) {
    return NextResponse.json({ message: "N8N_CALC_URL not configured" }, { status: 500 });
  }

  const { id } = ctx.params;

  // Валидация ID
  if (!id || isNaN(Number(id)) || Number(id) <= 0) {
    return NextResponse.json({ message: "Invalid consultation ID" }, { status: 400 });
  }

  try {
    // 1. Получаем данные консультации
    const consultationRes = await fetch(`${baseUrl}/items/consultations/${id}?fields=*,client_id.*`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });

    if (!consultationRes.ok) {
      return NextResponse.json({ message: "Consultation not found" }, { status: 404 });
    }

    const consultationData = await consultationRes.json().catch(() => ({}));
    const consultation = consultationData?.data;
    const client = consultation?.client_id;

    if (!client) {
      return NextResponse.json({ message: "Client not found" }, { status: 404 });
    }

    // 2. Получаем шаги консультации
    const stepsRes = await fetch(`${baseUrl}/items/consultation_details?filter[consultation_id][_eq]=${id}&sort=section`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });

    const stepsData = await stepsRes.json().catch(() => ({ data: [] }));
    const steps = (stepsData?.data || []).map((step: any) => {
      try {
        return JSON.parse(step.content || "{}");
      } catch {
        return { section: step.section, content: step.content };
      }
    });

    const pointA = steps.find((s: any) => s.step_type === "point_a");
    const pointB = steps.find((s: any) => s.step_type === "point_b");

    if (!pointA || !pointB) {
      return NextResponse.json(
        { message: "Не все шаги консультации заполнены" },
        { status: 400 }
      );
    }

    // 3. Получаем коды САЛ из профиля консультации
    let codes: any = null;
    let profileData: any = null;
    
    // Сначала пытаемся получить из profile_id консультации
    if (consultation.profile_id) {
      const profileRes = await fetch(`${baseUrl}/items/profiles/${consultation.profile_id}?fields=id,digits,raw_json`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });

      if (profileRes.ok) {
        const profileDataRes = await profileRes.json().catch(() => ({}));
        profileData = profileDataRes?.data;
        
        // Пытаемся получить коды из digits или raw_json
        if (profileData?.digits) {
          const digitsArray = Array.isArray(profileData.digits) 
            ? profileData.digits 
            : (typeof profileData.digits === 'string' ? profileData.digits.split(',').map(Number) : []);
          if (digitsArray.length >= 5) {
            codes = [
              { num: digitsArray[0], description: `Код Личности: ${digitsArray[0]}` },
              { num: digitsArray[1], description: `Код Коннектора: ${digitsArray[1]}` },
              { num: digitsArray[2], description: `Код Реализации: ${digitsArray[2]}` },
              { num: digitsArray[3], description: `Код Генератора: ${digitsArray[3]}` },
              { num: digitsArray[4], description: `Код Миссии: ${digitsArray[4]}` },
            ];
          }
        }
      }
    }

    // Если кодов нет, ищем последний профиль клиента
    if (!codes) {
      const profilesRes = await fetch(`${baseUrl}/items/profiles?filter[client_id][_eq]=${client.id}&sort=-created_at&limit=1&fields=id,digits,raw_json`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });

      if (profilesRes.ok) {
        const profilesData = await profilesRes.json().catch(() => ({}));
        if (profilesData?.data && profilesData.data.length > 0) {
          profileData = profilesData.data[0];
          if (profileData.digits) {
            const digitsArray = Array.isArray(profileData.digits) 
              ? profileData.digits 
              : (typeof profileData.digits === 'string' ? profileData.digits.split(',').map(Number) : []);
            if (digitsArray.length >= 5) {
              codes = [
                { num: digitsArray[0], description: `Код Личности: ${digitsArray[0]}` },
                { num: digitsArray[1], description: `Код Коннектора: ${digitsArray[1]}` },
                { num: digitsArray[2], description: `Код Реализации: ${digitsArray[2]}` },
                { num: digitsArray[3], description: `Код Генератора: ${digitsArray[3]}` },
                { num: digitsArray[4], description: `Код Миссии: ${digitsArray[4]}` },
              ];
            }
          }
        }
      }
    }

    // Если кодов все еще нет, рассчитываем по дате рождения
    if (!codes && client.birth_date) {
      const calculatedCodes = calculateSALCodes(client.birth_date);
      if (calculatedCodes) {
        codes = [
          { num: calculatedCodes.personality, description: `Код Личности: ${calculatedCodes.personality}` },
          { num: calculatedCodes.connector, description: `Код Коннектора: ${calculatedCodes.connector}` },
          { num: calculatedCodes.realization, description: `Код Реализации: ${calculatedCodes.realization}` },
          { num: calculatedCodes.generator, description: `Код Генератора: ${calculatedCodes.generator}` },
          { num: calculatedCodes.mission, description: `Код Миссии: ${calculatedCodes.mission}` },
        ];
      }
    }

    // 4. Формируем запрос к n8n для генерации инсайтов
    // Используем промпт из 1.json (базовая консультация)
    // Формат кодов должен соответствовать ожидаемому n8n формату
    const formattedCodes = codes?.map((c: any) => ({
      num: c.num,
      description: c.description || `Код: ${c.num}`,
    })) || [];

    const n8nPayload = {
      name: client.name || "Клиент",
      birthday: client.birth_date || "",
      codes: formattedCodes,
      consultationData: {
        pointA: pointA.response,
        pointB: pointB.response,
      },
      directusUrl: baseUrl,
      token: token,
      refreshToken: refreshToken,
      type: "express",
      consultationId: Number(id),
      profileId: profileData?.id || null,
    };

    // 5. Вызываем n8n workflow
    const n8nResponse = await fetch(n8nUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(n8nPayload),
      signal: AbortSignal.timeout(60000), // 60 секунд для генерации
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text().catch(() => "");
      logger.error("N8N error:", { status: n8nResponse.status, error: errorText });
      return NextResponse.json(
        { message: "Ошибка генерации инсайтов", error: errorText.substring(0, 200) },
        { status: n8nResponse.status }
      );
    }

    const n8nData = await n8nResponse.json().catch(() => ({}));

    // 6. Сохраняем сгенерированные инсайты в consultation_details
    if (n8nData && typeof n8nData === "object") {
      const insightsData = {
        consultation_id: Number(id),
        section: "ai_insights",
        content: JSON.stringify({
          generated_at: new Date().toISOString(),
          insights: n8nData,
        }),
      };

      const saveRes = await fetch(`${baseUrl}/items/consultation_details`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(insightsData),
        cache: "no-store",
      });

      if (!saveRes.ok) {
        logger.warn("Failed to save insights, but generation succeeded");
      }
    }

    return NextResponse.json({
      success: true,
      insights: n8nData,
    }, { status: 200 });
  } catch (error: any) {
    logger.error("Generate insights error:", error);
    return NextResponse.json(
      { message: "Server error", error: error?.message },
      { status: 500 }
    );
  }
}

