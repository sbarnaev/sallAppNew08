import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = process.env.DIRECTUS_URL;
  if (!token || !baseUrl) return NextResponse.json({ data: [] }, { status: 401 });

  const fields = ["id", "section", "content", "consultation_id"].join(",");
  const url = `${baseUrl}/items/consultation_details?filter[consultation_id][_eq]=${ctx.params.id}&fields=${encodeURIComponent(fields)}&limit=1000`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await r.json().catch(() => ({ data: [] }));
  return NextResponse.json(data, { status: r.status });
} 