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
        "created_at",
        "consultation_number",
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

  if (!body.scheduled_at) {
    return NextResponse.json({ message: "scheduled_at is required" }, { status: 400 });
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

  // Валидация и обработка scheduled_at (обязательное поле)
  let scheduledDate: string | null = null;
  
  if (typeof body.scheduled_at === 'string') {
    // Формат datetime-local: "YYYY-MM-DDTHH:mm" -> конвертируем в ISO
    if (body.scheduled_at.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
      scheduledDate = body.scheduled_at + ':00.000Z';
    }
    // Формат ISO с секундами: "YYYY-MM-DDTHH:mm:ss" -> добавляем миллисекунды
    else if (body.scheduled_at.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
      scheduledDate = body.scheduled_at + '.000Z';
    }
    // Уже полный ISO формат
    else if (body.scheduled_at.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/)) {
      scheduledDate = body.scheduled_at.endsWith('Z') ? body.scheduled_at : body.scheduled_at + 'Z';
    }
    // Пробуем распарсить как Date
    else {
      const parsedDate = new Date(body.scheduled_at);
      if (!isNaN(parsedDate.getTime())) {
        scheduledDate = parsedDate.toISOString();
      }
    }
  }
  
  if (!scheduledDate) {
    return NextResponse.json({ message: "scheduled_at must be a valid date string" }, { status: 400 });
  }

  // Генерируем кастомный номер консультации: CONS-{client_id}-{timestamp}
  // Используем последние 6 цифр timestamp для уникальности
  const timestamp = Date.now().toString().slice(-6);
  const consultationNumber = `CONS-${clientId}-${timestamp}`;
  
  const payload: any = {
    client_id: clientId,
    type: body.type || "base",
    status: body.status || "scheduled",
    owner_user: currentUser.id,
    scheduled_at: scheduledDate,
    // Добавляем кастомный номер, если поле существует в Directus
    // Если поля нет - Directus просто проигнорирует его
    consultation_number: consultationNumber,
  };

  
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

  // Используем return=* и fields=id чтобы Directus вернул созданную запись с ID
  const url = `${baseUrl}/items/consultations?return=*&fields=id,client_id,type,status,scheduled_at,created_at,owner_user`;
  
  // Логируем в консоль для отладки
  console.log("[POST /api/consultations] Creating consultation:", { 
    consultationNumber,
    clientId,
    ownerUser: currentUser.id,
    payload: { ...payload, scheduled_at: scheduledDate },
    url 
  });
  
  logger.log("Creating consultation:", { 
    consultationNumber,
    payload: { ...payload, scheduled_at: scheduledDate },
    url 
  });
  
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

  // Логируем статус и заголовки
  console.log("[POST /api/consultations] Directus response status:", { 
    status: r.status, 
    statusText: r.statusText
  });
  
  logger.log("Directus response:", { 
    status: r.status, 
    statusText: r.statusText,
    headers: Object.fromEntries(r.headers.entries())
  });

  // Получаем ответ как текст сначала
  const responseText = await r.text();
  let data: any = {};
  
  try {
    if (responseText) {
      data = JSON.parse(responseText);
    }
  } catch (e) {
    logger.error("Failed to parse Directus response:", { 
      status: r.status, 
      text: responseText.substring(0, 500),
      error: e 
    });
    
    // Если статус успешный, но нет JSON - это странно
    if (r.status >= 200 && r.status < 300) {
      return NextResponse.json({ 
        message: "Консультация создана, но ответ от сервера не содержит данных. Проверьте список консультаций.",
        data: null,
        debug: { status: r.status, responseText: responseText.substring(0, 200) }
      }, { status: 200 });
    }
    
    return NextResponse.json({ 
      message: "Ошибка создания консультации",
      errors: [{ message: responseText || "Неизвестная ошибка" }]
    }, { status: r.status });
  }

  // Логируем полный ответ
  console.log("[POST /api/consultations] Directus response data:", { 
    status: r.status,
    hasData: !!data?.data,
    hasId: !!(data?.data?.id || data?.id),
    consultationId: data?.data?.id || data?.id,
    data: data?.data ? { 
      id: data.data.id, 
      client_id: data.data.client_id,
      owner_user: data.data.owner_user 
    } : null,
    errors: data?.errors,
    fullData: JSON.stringify(data).substring(0, 500)
  });
  
  logger.log("Directus response data:", { 
    status: r.status,
    hasData: !!data?.data,
    hasId: !!(data?.data?.id || data?.id),
    data: data?.data ? { id: data.data.id, client_id: data.data.client_id } : null,
    errors: data?.errors
  });

  // Если есть ошибки от Directus
  if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    logger.error("Directus errors:", data.errors);
    return NextResponse.json({ 
      message: data.errors[0].message || "Ошибка создания консультации",
      errors: data.errors
    }, { status: r.status >= 400 ? r.status : 400 });
  }

  // Проверяем статус ответа
  if (!r.ok) {
    logger.error("Directus returned error status:", { 
      status: r.status, 
      data 
    });
    return NextResponse.json({ 
      message: data?.message || "Ошибка создания консультации",
      errors: data?.errors || [{ message: `HTTP ${r.status}: ${r.statusText}` }]
    }, { status: r.status });
  }

  // Проверяем, что данные действительно есть
  if (!data?.data) {
    logger.warn("Consultation created but no data in response:", { 
      status: r.status, 
      response: data 
    });
    
    // Если нет данных, но статус успешный - это проблема
    return NextResponse.json({ 
      message: "Консультация создана, но сервер не вернул данные. Проверьте список консультаций.",
      data: null,
      debug: { status: r.status, response: data }
    }, { status: 200 });
  }

  // Проверяем, что есть ID
  if (!data.data.id) {
    logger.error("Consultation created but no ID in response:", data);
    return NextResponse.json({ 
      message: "Консультация создана, но ID не получен. Проверьте список консультаций.",
      data: null,
      debug: { response: data }
    }, { status: 200 });
  }

  // Все хорошо, возвращаем данные
  logger.log("Consultation created successfully:", { 
    id: data.data.id,
    client_id: data.data.client_id 
  });
  
  return NextResponse.json(data, { status: r.status });
} 