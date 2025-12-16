import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";
import { checkSubscriptionInAPI } from "@/lib/subscription-check";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  // Проверяем подписку
  const subscriptionCheck = await checkSubscriptionInAPI();
  if (subscriptionCheck) {
    return subscriptionCheck;
  }

  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) return NextResponse.json({ data: null }, { status: 401 });

  // Получаем текущего пользователя для дополнительной проверки
  let currentUserId: string | null = null;
  try {
    const meRes = await fetch(`${baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (meRes.ok) {
      const meData = await meRes.json().catch(() => ({}));
      currentUserId = meData?.data?.id || null;
    }
  } catch {
    // Игнорируем ошибку
  }

  const fields = [
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
    "owner_user",
  ].join(",");
  
  // Получаем консультацию - Directus сам отфильтрует по owner_user через permissions
  const url = `${baseUrl}/items/consultations/${ctx.params.id}?fields=${encodeURIComponent(fields)}`;
  
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  
  const data = await r.json().catch(() => ({ data: null, errors: [] }));
  
  // Если получили ошибку доступа или консультация не найдена
  if (r.status === 403 || r.status === 404 || !data?.data) {
    // Если есть owner_user в ответе и он не совпадает с текущим пользователем
    if (data?.data?.owner_user && currentUserId && String(data.data.owner_user) !== String(currentUserId)) {
      return NextResponse.json({ 
        data: null, 
        message: "Консультация не найдена или у вас нет прав доступа" 
      }, { status: 404 });
    }
    
    // Если есть ошибки от Directus
    if (data?.errors && data.errors.length > 0) {
      return NextResponse.json({ 
        data: null, 
        message: data.errors[0].message || "Консультация не найдена или у вас нет прав доступа",
        errors: data.errors
      }, { status: r.status });
    }
    
    return NextResponse.json({ 
      data: null, 
      message: "Консультация не найдена или у вас нет прав доступа" 
    }, { status: 404 });
  }
  
  // Автоматически обновляем статус если дата прошла
  if (data?.data && data.data.scheduled_at && data.data.status === "scheduled") {
    const scheduledDate = new Date(data.data.scheduled_at);
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    if (scheduledDate < oneHourAgo) {
      // Обновляем статус в фоне (не ждем результата)
      fetch(`${baseUrl}/items/consultations/${ctx.params.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "completed" }),
      }).catch(() => {});
      
      data.data.status = "completed";
    }
  }
  
  return NextResponse.json(data, { status: r.status });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
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

  const payload: any = {};

  // Обновляем только переданные поля
  if (body.type !== undefined) payload.type = body.type;
  if (body.status !== undefined) payload.status = body.status;
  if (body.scheduled_at !== undefined) {
    if (body.scheduled_at) {
      // Конвертируем datetime-local в ISO формат если нужно
      let scheduledDate: string | null = null;
      if (typeof body.scheduled_at === 'string') {
        // Формат datetime-local: "YYYY-MM-DDTHH:mm"
        if (body.scheduled_at.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
          scheduledDate = body.scheduled_at + ':00.000Z';
        }
        // Формат с секундами
        else if (body.scheduled_at.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
          scheduledDate = body.scheduled_at + '.000Z';
        }
        // Уже ISO формат
        else if (body.scheduled_at.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/)) {
          scheduledDate = body.scheduled_at.endsWith('Z') ? body.scheduled_at : body.scheduled_at + 'Z';
        }
        // Пробуем распарсить
        else {
          const parsedDate = new Date(body.scheduled_at);
          if (!isNaN(parsedDate.getTime())) {
            scheduledDate = parsedDate.toISOString();
          }
        }
      }
      payload.scheduled_at = scheduledDate || null;
    } else {
      payload.scheduled_at = null;
    }
  }
  if (body.duration !== undefined) payload.duration = body.duration ? Number(body.duration) : null;
  if (body.base_cost !== undefined) payload.base_cost = body.base_cost ? Number(body.base_cost) : null;
  if (body.actual_cost !== undefined) payload.actual_cost = body.actual_cost ? Number(body.actual_cost) : null;
  if (body.profile_id !== undefined) payload.profile_id = body.profile_id ? Number(body.profile_id) : null;
  if (body.partner_client_id !== undefined) payload.partner_client_id = body.partner_client_id ? Number(body.partner_client_id) : null;
  if (body.partner_profile_id !== undefined) payload.partner_profile_id = body.partner_profile_id ? Number(body.partner_profile_id) : null;

  const url = `${baseUrl}/items/consultations/${ctx.params.id}?return=*`;
  const r = await fetch(url, {
    method: "PATCH",
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

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
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

  const url = `${baseUrl}/items/consultations/${ctx.params.id}`;
  const r = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (r.status === 204 || r.status === 200) {
    return NextResponse.json({ message: "Консультация удалена" }, { status: 200 });
  }

  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
} 