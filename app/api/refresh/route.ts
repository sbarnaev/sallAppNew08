import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const refreshToken = cookies().get("directus_refresh_token")?.value;
  const baseUrl = process.env.DIRECTUS_URL;
  
  if (!refreshToken || !baseUrl) {
    return NextResponse.json({ message: "No refresh token or DIRECTUS_URL" }, { status: 401 });
  }

  try {
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data || { message: "Token refresh failed" }, { status: res.status });
    }

    const access = data?.data?.access_token;
    const refresh = data?.data?.refresh_token;

    const response = NextResponse.json({ ok: true });
    const secure = process.env.NODE_ENV === "production";
    
    if (access) {
      response.cookies.set("directus_access_token", access, { 
        httpOnly: true, 
        secure, 
        sameSite: "lax", 
        path: "/" 
      });
    }
    
    if (refresh) {
      response.cookies.set("directus_refresh_token", refresh, { 
        httpOnly: true, 
        secure, 
        sameSite: "lax", 
        path: "/" 
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json({ 
      message: "Cannot connect to Directus", 
      error: String(error) 
    }, { status: 502 });
  }
}
