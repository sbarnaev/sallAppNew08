import { NextResponse } from "next/server";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Получаем базовый URL из заголовков запроса
  const headersList = headers();
  const host = headersList.get("host") || headersList.get("x-forwarded-host") || "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const baseUrl = `${protocol}://${host}`;
  
  const res = NextResponse.redirect(new URL("/login", baseUrl));
  res.cookies.set("directus_access_token", "", { httpOnly: true, expires: new Date(0), path: "/" });
  res.cookies.set("directus_refresh_token", "", { httpOnly: true, expires: new Date(0), path: "/" });
  return res;
}
