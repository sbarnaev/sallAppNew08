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
    console.error("Invalid Directus URL in refresh:", baseUrl);
    return NextResponse.json({ message: "Invalid DIRECTUS_URL" }, { status: 500 });
  }

  console.log("🔍 ===== TOKEN REFRESH DEBUG =====");
  console.log("🔍 Refreshing token, Directus URL:", baseUrl);
  console.log("🔍 Refresh token present:", !!refreshToken, "Length:", refreshToken?.length);
  console.log("🔍 URL type check:", {
    startsWithHttps: baseUrl.startsWith('https://'),
    startsWithHttp: baseUrl.startsWith('http://'),
    containsPort: baseUrl.includes(':'),
    rawUrl: baseUrl
  });

  // Проверяем, что URL действительно валидный для HTTPS
  if (baseUrl.startsWith('https://')) {
    // Убираем порт если он указан неправильно (например, :443 для HTTPS)
    const urlObj = new URL(baseUrl);
    if (urlObj.port === '443') {
      urlObj.port = '';
      baseUrl = urlObj.toString();
      console.log("Removed port 443 from HTTPS URL, new URL:", baseUrl);
    }
  }

  try {
    const refreshUrl = `${baseUrl}/auth/refresh`;
    console.log("Making refresh request to:", refreshUrl);
    
    const res = await fetch(refreshUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      // Увеличиваем таймаут
      signal: AbortSignal.timeout(10000), // 10 секунд
    });
    
    console.log("Refresh response status:", res.status, res.statusText);

    const responseText = await res.text();
    console.log("Refresh response body (first 200 chars):", responseText.substring(0, 200));
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse refresh response:", parseError, "Response:", responseText);
      throw new Error(`Invalid JSON response from Directus: ${responseText.substring(0, 100)}`);
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
    // Устанавливаем очень долгое время жизни для cookies (10 лет)
    const maxAge = 60 * 60 * 24 * 365 * 10; // 10 лет в секундах
    
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
    console.error("Error refreshing token in Directus:", {
      message: error?.message,
      code: error?.code,
      cause: error?.cause,
      directusUrl: baseUrl,
      stack: error?.stack?.substring(0, 500)
    });
    
    // Если это SSL ошибка, даем более понятное сообщение
    if (error?.code === 'ERR_SSL_PACKET_LENGTH_TOO_LONG' || error?.message?.includes('SSL')) {
      return NextResponse.json({ 
        message: "SSL connection error. Check DIRECTUS_URL format (should be https://...)", 
        error: error?.message,
        code: error?.code,
        directusUrl: baseUrl
      }, { status: 502 });
    }
    
    return NextResponse.json({ 
      message: "Cannot connect to Directus", 
      error: String(error?.message || error),
      code: error?.code
    }, { status: 502 });
  }
}
