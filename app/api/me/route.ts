import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const token = cookies().get("directus_access_token")?.value;
  if (!token || !process.env.DIRECTUS_URL) return NextResponse.json({ data: null }, { status: 401 });
  const r = await fetch(`${process.env.DIRECTUS_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await r.json();
  return NextResponse.json(data);
}
