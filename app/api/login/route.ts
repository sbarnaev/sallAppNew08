import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const baseUrl = getDirectusUrl();
  if (!baseUrl) {
    return NextResponse.json({ message: "DIRECTUS_URL is not set" }, { status: 500 });
  }

  let res: Response;
  let data: any;
  try {
    res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    data = await res.json().catch(() => ({}));
  } catch (error) {
    return NextResponse.json({ message: "Cannot connect to Directus", error: String(error) }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json(data || { message: "Login failed" }, { status: res.status });
  }

  const access = data?.data?.access_token;
  const refresh = data?.data?.refresh_token;

  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  // Время жизни токенов: 3 дня
  const maxAge = 60 * 60 * 24 * 3; // 3 дня в секундах
  
  if (access) {
    response.cookies.set("directus_access_token", access, { 
      httpOnly: true, 
      secure, 
      sameSite: "lax", 
      path: "/",
      maxAge: maxAge
    });
  }
  if (refresh) {
    response.cookies.set("directus_refresh_token", refresh, { 
      httpOnly: true, 
      secure, 
      sameSite: "lax", 
      path: "/",
      maxAge: maxAge
    });
  }
  return response;
}
