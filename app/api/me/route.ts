import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

export async function GET() {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) return NextResponse.json({ data: null }, { status: 401 });
  // Request minimal user info including contact for PDF exports
  const r = await fetch(`${baseUrl}/users/me?fields=first_name,last_name,email,contact`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  const r = await fetch(`${baseUrl}/users/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await r.json();
  return NextResponse.json(data);
}
