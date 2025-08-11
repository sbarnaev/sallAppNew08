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