import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

export async function POST() {
  const refreshToken = cookies().get("directus_refresh_token")?.value;
  const baseUrl = getDirectusUrl();

  if (!refreshToken || !baseUrl) {
    return NextResponse.json({ message: "No refresh token or DIRECTUS_URL" }, { status: 401 });
  }

  // Проверяем, что URL валидный
  if (!baseUrl.startsWith('http')) {
    return NextResponse.json({ message: "Invalid DIRECTUS_URL" }, { status: 500 });
  }

  // Проверяем, что URL действительно валидный для HTTPS
  let finalBaseUrl = baseUrl;
  if (baseUrl.startsWith('https://')) {
    // Убираем порт если он указан неправильно (например, :443 для HTTPS)
    try {
      const urlObj = new URL(baseUrl);
      if (urlObj.port === '443') {
        urlObj.port = '';
        finalBaseUrl = urlObj.toString();
      }
    } catch (urlError) {
    }
  }

  try {
    const refreshUrl = `${finalBaseUrl}/auth/refresh`;
    const requestBody = { refresh_token: refreshToken };
    
    const res = await fetch(refreshUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(requestBody),
      // Увеличиваем таймаут
      signal: AbortSignal.timeout(10000), // 10 секунд
    });
    
    const responseText = await res.text();
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Invalid JSON response from Directus`);
    }

    if (!res.ok) {
      return NextResponse.json(data || { message: "Token refresh failed" }, { status: res.status });
    }

    const access = data?.data?.access_token;
    const refresh = data?.data?.refresh_token;

    const response = NextResponse.json({ 
      ok: true, 
      access_token: access, // Возвращаем токен в ответе для использования в том же запросе
      refresh_token: refresh 
    });
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
  } catch (error: any) {
    // Если это SSL ошибка, даем более понятное сообщение
    if (error?.code === 'ERR_SSL_PACKET_LENGTH_TOO_LONG' || error?.message?.includes('SSL')) {
      return NextResponse.json({ 
        message: "SSL connection error. Check DIRECTUS_URL format (should be https://...)", 
        code: error?.code
      }, { status: 502 });
    }
    
    return NextResponse.json({ 
      message: "Cannot connect to Directus"
    }, { status: 502 });
  }
}
