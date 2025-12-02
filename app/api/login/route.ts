import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

export async function POST(req: NextRequest) {
  console.log("[LOGIN] ===== POST /api/login called =====");
  
  let email: string = "";
  let password: string = "";
  
  try {
    const body = await req.json();
    email = String(body?.email || "").trim();
    password = String(body?.password || "");
    console.log("[LOGIN] Received credentials:", {
      hasEmail: !!email,
      emailLength: email.length,
      hasPassword: !!password,
      passwordLength: password.length,
      emailPrefix: email.substring(0, 3) + "***"
    });
  } catch (error: any) {
    console.error("[LOGIN] Error parsing request body:", {
      message: error?.message || String(error)
    });
    return NextResponse.json({ message: "Ошибка обработки данных запроса" }, { status: 400 });
  }

  // Валидация обязательных полей
  if (!email || !email.includes("@")) {
    console.warn("[LOGIN] Validation failed: invalid email");
    return NextResponse.json({ message: "Некорректный email" }, { status: 400 });
  }
  if (!password || password.length < 1) {
    console.warn("[LOGIN] Validation failed: empty password");
    return NextResponse.json({ message: "Пароль обязателен для заполнения" }, { status: 400 });
  }

  const baseUrl = getDirectusUrl();
  if (!baseUrl) {
    console.error("[LOGIN] DIRECTUS_URL is not set");
    return NextResponse.json({ message: "DIRECTUS_URL is not set" }, { status: 500 });
  }

  console.log("[LOGIN] Directus URL:", baseUrl);
  const loginUrl = `${baseUrl}/auth/login`;
  console.log("[LOGIN] Calling Directus login:", loginUrl);

  let res: Response;
  let data: any;
  try {
    res = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    
    console.log("[LOGIN] Directus response status:", res.status, res.statusText);
    
    const responseText = await res.text();
    console.log("[LOGIN] Directus response (first 500 chars):", responseText.substring(0, 500));
    
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("[LOGIN] Failed to parse Directus response:", parseError);
      data = { error: "Invalid response from Directus", raw: responseText.substring(0, 200) };
    }
    
    console.log("[LOGIN] Parsed response data:", {
      hasData: !!data?.data,
      hasAccessToken: !!data?.data?.access_token,
      hasRefreshToken: !!data?.data?.refresh_token,
      hasErrors: !!data?.errors,
      errorMessage: data?.errors?.[0]?.message || data?.message
    });
  } catch (error: any) {
    console.error("[LOGIN] Error connecting to Directus:", {
      message: error?.message || String(error),
      name: error?.name,
      code: error?.code,
      stack: error?.stack?.substring(0, 500)
    });
    return NextResponse.json({ message: "Cannot connect to Directus", error: String(error) }, { status: 502 });
  }

  if (!res.ok) {
    console.error("[LOGIN] Login failed:", {
      status: res.status,
      statusText: res.statusText,
      data: data,
      errorMessage: data?.errors?.[0]?.message || data?.message || "Unknown error"
    });
    return NextResponse.json(data || { message: "Login failed" }, { status: res.status });
  }

  const access = data?.data?.access_token;
  const refresh = data?.data?.refresh_token;

  console.log("[LOGIN] Tokens extracted:", {
    hasAccessToken: !!access,
    hasRefreshToken: !!refresh,
    accessTokenLength: access?.length || 0,
    refreshTokenLength: refresh?.length || 0
  });

  if (!access) {
    console.error("[LOGIN] No access token in response!");
    return NextResponse.json({ message: "No access token received from Directus" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  // Время жизни токенов: 3 дня
  const maxAge = 60 * 60 * 24 * 3; // 3 дня в секундах
  
  console.log("[LOGIN] Setting cookies:", {
    secure,
    maxAge,
    nodeEnv: process.env.NODE_ENV
  });
  
  if (access) {
    response.cookies.set("directus_access_token", access, { 
      httpOnly: true, 
      secure, 
      sameSite: "lax", 
      path: "/",
      maxAge: maxAge
    });
    console.log("[LOGIN] Access token cookie set");
  }
  if (refresh) {
    response.cookies.set("directus_refresh_token", refresh, { 
      httpOnly: true, 
      secure, 
      sameSite: "lax", 
      path: "/",
      maxAge: maxAge
    });
    console.log("[LOGIN] Refresh token cookie set");
  }
  
  console.log("[LOGIN] Login successful, returning response");
  return response;
}
