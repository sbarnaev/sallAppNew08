import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDirectusUrl } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Получает данные экспресс-консультации со всеми шагами
 */
export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();

  if (!token || !baseUrl) {
    return NextResponse.json({ message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });
  }

  const { id } = ctx.params;

  // Валидация ID
  if (!id || isNaN(Number(id)) || Number(id) <= 0) {
    return NextResponse.json({ message: "Invalid consultation ID" }, { status: 400 });
  }

  try {
    // Параллельно получаем консультацию и шаги
    const consultationUrl = `${baseUrl}/items/consultations/${id}?fields=*`;
    const stepsUrl = `${baseUrl}/items/consultation_details?filter[consultation_id][_eq]=${id}&sort=section`;

    const [consultationRes, stepsRes] = await Promise.all([
      fetch(consultationUrl, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        next: { revalidate: 30 },
      }),
      fetch(stepsUrl, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        next: { revalidate: 30 },
      }),
    ]);

    if (!consultationRes.ok) {
      return NextResponse.json(
        { message: "Consultation not found" },
        { status: 404 }
      );
    }

    const [consultationData, stepsData] = await Promise.all([
      consultationRes.json().catch(() => ({})),
      stepsRes.json().catch(() => ({ data: [] })),
    ]);

    // Парсим шаги из content
    const steps = (stepsData?.data || []).map((step: any) => {
      try {
        const parsed = JSON.parse(step.content || "{}");
        return {
          id: step.id,
          ...parsed,
        };
      } catch {
        return {
          id: step.id,
          section: step.section,
          content: step.content,
        };
      }
    });

    // Получаем трактовки и opener из профиля, если есть profile_id
    let bookInformation = null;
    let profileOpener = null;
    const consultation = consultationData?.data;
    if (consultation?.profile_id) {
      try {
        const profileUrl = `${baseUrl}/items/profiles/${consultation.profile_id}?fields=book_information,raw_json`;
        const profileRes = await fetch(profileUrl, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          next: { revalidate: 120 },
        });

        if (profileRes.ok) {
          const profileData = await profileRes.json().catch(() => ({}));
          bookInformation = profileData?.data?.book_information || null;

          // Извлекаем opener из raw_json
          try {
            const rawJson = profileData?.data?.raw_json;
            if (rawJson) {
              const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
              profileOpener = parsed?.opener || null;
            }
          } catch {
            // Игнорируем ошибки парсинга
          }
        }
      } catch (error) {
        logger.error("Error fetching profile data:", error);
      }
    }

    return NextResponse.json({
      consultation: consultation,
      steps,
      bookInformation,
      profileOpener,
    }, { status: 200 });
  } catch (error: any) {
    logger.error("Get express consultation error:", error);
    return NextResponse.json(
      { message: "Server error" },
      { status: 500 }
    );
  }
}

/**
 * Завершает экспресс-консультацию и сохраняет результат продажи
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();

  if (!token || !baseUrl) {
    return NextResponse.json({ message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });
  }

  const { id } = ctx.params;

  // Валидация ID
  if (!id || isNaN(Number(id)) || Number(id) <= 0) {
    return NextResponse.json({ message: "Invalid consultation ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { status, sold_product, importance_rating } = body;

    const updatePayload: any = {};

    if (status) updatePayload.status = status;
    if (sold_product !== undefined) updatePayload.sold_product = sold_product;
    if (importance_rating) updatePayload.importance_rating = Number(importance_rating);

    if (status === "completed") {
      updatePayload.completed_at = new Date().toISOString();
    }

    const url = `${baseUrl}/items/consultations/${id}`;
    const r = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(updatePayload),
      cache: "no-store",
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      logger.error("Error updating consultation:", data);
      return NextResponse.json(
        { message: data?.errors?.[0]?.message || "Failed to update consultation" },
        { status: r.status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    logger.error("Update express consultation error:", error);
    return NextResponse.json(
      { message: "Server error" },
      { status: 500 }
    );
  }
}

