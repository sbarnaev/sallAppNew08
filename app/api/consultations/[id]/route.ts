import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";
import { checkSubscriptionInAPI } from "@/lib/subscription-check";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) return NextResponse.json({ data: null }, { status: 401 });

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
  ].join(",");
  const url = `${baseUrl}/items/consultations/${ctx.params.id}?fields=${encodeURIComponent(fields)}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await r.json().catch(() => ({ data: null }));
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
  if (body.scheduled_at !== undefined) payload.scheduled_at = body.scheduled_at || null;
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