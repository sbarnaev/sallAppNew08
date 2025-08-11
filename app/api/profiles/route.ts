import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

export async function GET(req: NextRequest) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) return NextResponse.json({ data: [] }, { status: 401 });

  const sp = new URLSearchParams(req.nextUrl.searchParams as any);
  if (!sp.has("fields")) sp.set("fields", "id,client_id,created_at,html,raw_json,digits");
  if (!sp.has("limit")) sp.set("limit", "50");
  if (!sp.has("offset")) sp.set("offset", "0");
  if (!sp.has("meta")) sp.set("meta", "filter_count");
  if (!sp.has("sort")) sp.set("sort", "-created_at");

  const url = `${baseUrl}/items/profiles?${sp.toString()}`;
  // Debug URL (visible в серверных логах)
  // console.log("Profiles list URL:", url);

  async function fetchList(accessToken: string) {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({ data: [] }));
    return { r, data } as const;
  }

  let { r, data } = await fetchList(token);

  if (r.status === 401 && data?.errors?.[0]?.message === "Token expired.") {
    const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (refreshRes.ok) {
      const newToken = cookies().get("directus_access_token")?.value;
      if (newToken) {
        ({ r, data } = await fetchList(newToken));
      }
    }
  }

  // Нормализация на всякий случай — только client_id из relation если вдруг есть
  try {
    if (Array.isArray((data as any)?.data)) {
      (data as any).data = (data as any).data.map((item: any) => {
        const clientId = item?.client_id ?? item?.client?.id ?? null;
        return { ...item, client_id: clientId };
      });
    }
  } catch {}

  if (r.status === 404) {
    return NextResponse.json({ data: [], meta: { filter_count: 0 }, upstreamStatus: 404 });
  }
  return NextResponse.json(data, { status: r.status });
}
