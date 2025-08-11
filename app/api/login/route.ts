import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!process.env.DIRECTUS_URL) {
    return NextResponse.json({ message: "DIRECTUS_URL is not set" }, { status: 500 });
  }

  let res: Response;
  let data: any;
  try {
    res = await fetch(`${process.env.DIRECTUS_URL}/auth/login`, {
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
  if (access) response.cookies.set("directus_access_token", access, { httpOnly: true, secure, sameSite: "lax", path: "/" });
  if (refresh) response.cookies.set("directus_refresh_token", refresh, { httpOnly: true, secure, sameSite: "lax", path: "/" });
  return response;
}
