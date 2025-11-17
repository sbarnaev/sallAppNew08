import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

export async function GET(req: NextRequest) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) {
    return NextResponse.json({ data: [], message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });
  }

  const sp = new URLSearchParams(req.nextUrl.searchParams as any);
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
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) {
    return NextResponse.json({ message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  
  // Валидация обязательных полей
  if (!body.client_id) {
    return NextResponse.json({ message: "client_id is required" }, { status: 400 });
  }

  const payload: any = {
    client_id: Number(body.client_id),
    type: body.type || "base",
    status: body.status || "scheduled",
  };

  if (body.scheduled_at) payload.scheduled_at = body.scheduled_at;
  if (body.duration) payload.duration = Number(body.duration);
  if (body.base_cost) payload.base_cost = Number(body.base_cost);
  if (body.actual_cost) payload.actual_cost = Number(body.actual_cost);
  if (body.profile_id) payload.profile_id = Number(body.profile_id);
  // Для парных консультаций
  if (body.partner_client_id) payload.partner_client_id = Number(body.partner_client_id);
  if (body.partner_profile_id) payload.partner_profile_id = Number(body.partner_profile_id);

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