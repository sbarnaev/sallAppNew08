import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = process.env.DIRECTUS_URL;
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