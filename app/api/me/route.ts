import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

export async function GET() {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) return NextResponse.json({ data: null }, { status: 401 });
  const r = await fetch(`${baseUrl}/users/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await r.json();
  return NextResponse.json(data);
}
