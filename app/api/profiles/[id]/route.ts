import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(_req: Request, ctx: { params: { id: string }}) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = process.env.DIRECTUS_URL;
  if (!token || !baseUrl) return NextResponse.json({ data: null }, { status: 401 });
  const { id } = ctx.params;
  const url = `${baseUrl}/items/profiles/${id}`;
  const fields = [
    "id",
    "client_id",
    "created_at",
    "html",
    "raw_json",
    "ui_state",
    "notes",
    "digits",
  ].join(",");
  const urlWithFields = `${url}?fields=${encodeURIComponent(fields)}`;

  async function fetchProfile(accessToken: string) {
    const r = await fetch(urlWithFields, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({ data: null }));
    return { r, data } as const;
  }

  let { r, data } = await fetchProfile(token);

  if (r.status === 401 && data?.errors?.[0]?.message === "Token expired.") {
    // попробуем освежить токен
    const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (refreshRes.ok) {
      const newToken = cookies().get("directus_access_token")?.value;
      if (newToken) {
        ({ r, data } = await fetchProfile(newToken));
      }
    }
  }

  // Нормализация client_id из relation, если бы он вернулся
  try {
    if ((data as any)?.data) {
      const item = (data as any).data;
      const clientId = item?.client_id ?? item?.client?.id ?? null;
      (data as any).data = { ...item, client_id: clientId };
    }
  } catch {}
  return NextResponse.json(data, { status: r.status });
}

export async function PATCH(req: Request, ctx: { params: { id: string }}) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = process.env.DIRECTUS_URL;
  if (!token || !baseUrl) return NextResponse.json({ message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });

  const { id } = ctx.params;
  const body = await req.json().catch(()=>({}));

  const allowed: Record<string, any> = {};
  if (body.ui_state !== undefined) allowed.ui_state = body.ui_state; // JSON в profiles
  if (typeof body.notes === 'string') allowed.notes = body.notes;    // Markdown в profiles

  const r = await fetch(`${baseUrl}/items/profiles/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(allowed),
  });
  const data = await r.json().catch(()=>({}));
  return NextResponse.json(data, { status: r.status });
}
