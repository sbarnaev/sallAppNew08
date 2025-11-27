import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDirectusUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { internalApiFetch } from "@/lib/fetchers";

export const dynamic = "force-dynamic";

type DirectusItemResponse<T> = { data?: T };

async function fetchJson<T = any>(url: string, token: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.headers || {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn(`Directus request failed (${res.status}): ${text.substring(0, 300)}`);
      return null;
    }
    return await res.json().catch(() => null);
  } catch (error) {
    logger.error("Directus fetch error:", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
    const token = cookies().get("directus_access_token")?.value;
    const baseUrl = getDirectusUrl();

    if (!token || !baseUrl) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const clientId = Number(body?.clientId);
  const explicitProfileId = body?.profileId ? Number(body.profileId) : null;

  if (!clientId) {
    return NextResponse.json({ message: "clientId is required" }, { status: 400 });
        }

  try {
    // 1. Получаем данные клиента (для генерации профиля при необходимости)
    const client = await fetchJson<DirectusItemResponse<any>>(
      `${baseUrl}/items/clients/${clientId}?fields=id,name,birth_date,gender`,
      token
    );

    if (!client?.data) {
      return NextResponse.json({ message: "Client not found" }, { status: 404 });
    }

    // 2. Определяем актуальный profileId
    let profileId = explicitProfileId;

    if (!profileId) {
      const latestProfile = await fetchJson<DirectusItemResponse<any[]>>(
        `${baseUrl}/items/profiles?filter[client_id][_eq]=${clientId}&sort=-created_at&limit=1&fields=id`,
        token
      );
      profileId = latestProfile?.data?.[0]?.id ? Number(latestProfile.data[0].id) : null;
    }

    if (!profileId) {
      if (!client.data.birth_date) {
        return NextResponse.json(
          { message: "Client birth date is required to generate base profile" },
          { status: 400 }
        );
      }

      // Генерируем базовый расчет через /api/calc (n8n)
      const calcRes = await internalApiFetch("/api/calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          name: client.data.name || "Клиент",
          birthday: client.data.birth_date,
          gender: client.data.gender || null,
          type: "base",
        }),
      });

      const calcText = await calcRes.text().catch(() => "");
      let calcData: any = {};
      try {
        calcData = JSON.parse(calcText || "{}");
      } catch {
        calcData = {};
      }

      if (!calcRes.ok) {
        logger.error("Base calculation failed:", calcText.substring(0, 500));
        return NextResponse.json(
          { message: "Failed to generate base profile", details: calcData?.message || calcText },
          { status: calcRes.status || 500 }
        );
      }

      profileId =
        calcData?.profileId ||
        calcData?.data?.profileId ||
        calcData?.id ||
        calcData?.data?.id ||
        null;
    }

    if (!profileId) {
      return NextResponse.json(
        { message: "Profile could not be generated for this client" },
        { status: 500 }
      );
    }

    // 3. Пытаемся найти незавершенную экспресс-консультацию
    const existing = await fetchJson<DirectusItemResponse<any[]>>(
      `${baseUrl}/items/consultations?filter[client_id][_eq]=${clientId}&filter[type][_eq]=express&sort=-created_at&limit=1&fields=id,status,profile_id`,
      token
    );

    const existingConsultation = existing?.data?.[0];

    if (existingConsultation && existingConsultation.status !== "completed") {
      // Привязываем профиль, если его не было
      if (!existingConsultation.profile_id) {
        try {
          await fetch(`${baseUrl}/items/consultations/${existingConsultation.id}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ profile_id: profileId }),
            cache: "no-store",
          });
        } catch (error) {
          logger.warn("Failed to attach profile to consultation:", error);
        }
      }

      return NextResponse.json({
        data: { ...existingConsultation, profile_id: existingConsultation.profile_id || profileId },
        profileId,
      });
        }

    // 4. Получаем текущего пользователя (owner_user)
    const me = await fetchJson<DirectusItemResponse<any>>(`${baseUrl}/users/me`, token);
    const ownerUserId = me?.data?.id || null;

    // 5. Создаем новую экспресс-консультацию
    const payload: Record<string, any> = {
            client_id: clientId,
            profile_id: profileId,
            type: "express",
      status: "in_progress",
      scheduled_at: new Date().toISOString(),
      title: `Экспресс-разбор от ${new Date().toLocaleDateString("ru-RU")}`,
    };

    if (ownerUserId) {
      payload.owner_user = ownerUserId;
    }

    const createRes = await fetch(`${baseUrl}/items/consultations?return=*`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
        Accept: "application/json",
            },
      body: JSON.stringify(payload),
      cache: "no-store",
        });

    const createdData = await createRes.json().catch(() => ({}));

        if (!createRes.ok) {
      logger.error("Failed to create express consultation:", createdData);
      return NextResponse.json(
        { message: createdData?.errors?.[0]?.message || "Failed to create consultation" },
        { status: createRes.status }
      );
        }

    const consultationId =
      createdData?.data?.id ||
      createdData?.id ||
      (Array.isArray(createdData?.data) ? createdData.data[0]?.id : null);

    if (!consultationId) {
      return NextResponse.json(
        { message: "Consultation created but ID is missing" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data: { id: consultationId, profile_id: profileId, status: payload.status },
        profileId,
      },
      { status: 200 }
    );
    } catch (error: any) {
        logger.error("Init consultation error:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
    }
}
