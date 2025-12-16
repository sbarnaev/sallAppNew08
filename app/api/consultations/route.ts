import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";
import { checkSubscriptionInAPI } from "@/lib/subscription-check";
import { logger } from "@/lib/logger";

// Функция для получения текущего пользователя
async function getCurrentUser(token: string, baseUrl: string) {
  try {
    const response = await fetch(`${baseUrl}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return data?.data || null;
    }

    return null;
  } catch (error) {
    logger.error("Error getting current user:", error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  // Проверяем подписку
  const subscriptionCheck = await checkSubscriptionInAPI();
  if (subscriptionCheck) {
    return subscriptionCheck;
  }

  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) {
    return NextResponse.json({ data: [], message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });
  }

  const sp = new URLSearchParams(req.nextUrl.searchParams);
  if (!sp.has("fields")) {
    sp.set(
      "fields",
      [
        "id",
        "client_id",
        "scheduled_at",
        "type",
        "status",
        "duration",
        "base_cost",
        "actual_cost",
        "profile_id",
        "partner_client_id",
        "partner_profile_id",
        "created_at",
      ].join(",")
    );
  }
  if (!sp.has("limit")) sp.set("limit", "20");
  if (!sp.has("offset")) sp.set("offset", "0");
  if (!sp.has("meta")) sp.set("meta", "filter_count");

  const url = `${baseUrl}/items/consultations?${sp.toString()}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await r.json().catch(() => ({ data: [], meta: {} }));
  return NextResponse.json(data, { status: r.status });
}

export async function POST(req: NextRequest) {
  // Проверяем подписку
  const subscriptionCheck = await checkSubscriptionInAPI();
  if (subscriptionCheck) {
    return subscriptionCheck;
  }

  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) {
    return NextResponse.json({ message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ message: "Ошибка обработки данных запроса" }, { status: 400 });
  }
  
  // Валидация обязательных полей
  if (!body.client_id) {
    return NextResponse.json({ message: "client_id is required" }, { status: 400 });
  }

  // Валидация типов данных
  const clientId = Number(body.client_id);
  if (isNaN(clientId) || clientId <= 0 || !Number.isInteger(clientId)) {
    return NextResponse.json({ message: "client_id must be a positive integer" }, { status: 400 });
  }

  // Получаем текущего пользователя
  const currentUser = await getCurrentUser(token, baseUrl);

  if (!currentUser?.id) {
    return NextResponse.json({ message: "Ошибка получения данных пользователя" }, { status: 500 });
  }

  const payload: any = {
    client_id: clientId,
    type: body.type || "base",
    status: body.status || "scheduled",
    owner_user: currentUser.id,
  };

  // Валидация опциональных полей
  if (body.scheduled_at) {
    // Проверяем формат даты (YYYY-MM-DD или ISO 8601)
    const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
    if (typeof body.scheduled_at === 'string' && dateRegex.test(body.scheduled_at)) {
      payload.scheduled_at = body.scheduled_at;
    } else {
      return NextResponse.json({ message: "scheduled_at must be a valid date string" }, { status: 400 });
    }
  }
  
  if (body.duration) {
    const duration = Number(body.duration);
    if (!isNaN(duration) && duration > 0 && Number.isInteger(duration)) {
      payload.duration = duration;
    }
  }
  
  if (body.base_cost) {
    const baseCost = Number(body.base_cost);
    if (!isNaN(baseCost) && baseCost >= 0) {
      payload.base_cost = baseCost;
    }
  }
  
  if (body.actual_cost) {
    const actualCost = Number(body.actual_cost);
    if (!isNaN(actualCost) && actualCost >= 0) {
      payload.actual_cost = actualCost;
    }
  }
  
  if (body.profile_id) {
    const profileId = Number(body.profile_id);
    if (!isNaN(profileId) && profileId > 0 && Number.isInteger(profileId)) {
      payload.profile_id = profileId;
    }
  }
  
  // Для парных консультаций
  if (body.partner_client_id) {
    const partnerClientId = Number(body.partner_client_id);
    if (!isNaN(partnerClientId) && partnerClientId > 0 && Number.isInteger(partnerClientId)) {
      payload.partner_client_id = partnerClientId;
    }
  }
  
  if (body.partner_profile_id) {
    const partnerProfileId = Number(body.partner_profile_id);
    if (!isNaN(partnerProfileId) && partnerProfileId > 0 && Number.isInteger(partnerProfileId)) {
      payload.partner_profile_id = partnerProfileId;
    }
  }

  // Используем return=* чтобы Directus вернул созданную запись
  const url = `${baseUrl}/items/consultations?return=*`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
} 