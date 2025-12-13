import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  logger.debug("[LOGIN] POST /api/login");
  
  let email: string = "";
  let password: string = "";
  
  try {
    const body = await req.json();
    email = String(body?.email || "").trim();
    password = String(body?.password || "");
    // Никогда не логируем пароль. Даже длину.
    logger.debug("[LOGIN] Received credentials:", {
      hasEmail: !!email,
      emailLength: email.length,
      hasPassword: !!password,
      emailPrefix: email ? email.substring(0, 3) + "***" : ""
    });
  } catch (error: any) {
    logger.error("[LOGIN] Error parsing request body:", {
      message: error?.message || String(error)
    });
    return NextResponse.json({ message: "Ошибка обработки данных запроса" }, { status: 400 });
  }

  // Валидация обязательных полей
  if (!email || !email.includes("@")) {
    logger.warn("[LOGIN] Validation failed: invalid email");
    return NextResponse.json({ message: "Некорректный email" }, { status: 400 });
  }
  if (!password || password.length < 1) {
    logger.warn("[LOGIN] Validation failed: empty password");
    return NextResponse.json({ message: "Пароль обязателен для заполнения" }, { status: 400 });
  }

  const baseUrl = getDirectusUrl();
  if (!baseUrl) {
    logger.error("[LOGIN] DIRECTUS_URL is not set");
    return NextResponse.json({ message: "DIRECTUS_URL is not set" }, { status: 500 });
  }

  const loginUrl = `${baseUrl}/auth/login`;
  logger.debug("[LOGIN] Calling Directus login");

  let res: Response;
  let data: any;
  try {
    res = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    
    logger.debug("[LOGIN] Directus response status:", res.status, res.statusText);
    
    const responseText = await res.text();
    logger.debug("[LOGIN] Directus response preview:", responseText.substring(0, 200));
    
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      logger.error("[LOGIN] Failed to parse Directus response:", parseError);
      data = { error: "Invalid response from Directus", raw: responseText.substring(0, 200) };
    }
    
    logger.debug("[LOGIN] Parsed response data:", {
      hasData: !!data?.data,
      hasAccessToken: !!data?.data?.access_token,
      hasRefreshToken: !!data?.data?.refresh_token,
      hasErrors: !!data?.errors,
      errorMessage: data?.errors?.[0]?.message || data?.message
    });
  } catch (error: any) {
    logger.error("[LOGIN] Error connecting to Directus:", {
      message: error?.message || String(error),
      name: error?.name,
      code: error?.code,
      stack: error?.stack?.substring(0, 500)
    });
    return NextResponse.json({ message: "Cannot connect to Directus", error: String(error) }, { status: 502 });
  }

  if (!res.ok) {
    const errorMessage = data?.errors?.[0]?.message || data?.message || "Unknown error";
    
    logger.error("[LOGIN] Login failed:", {
      status: res.status,
      statusText: res.statusText,
      data: data,
      errorMessage: errorMessage
    });
    
    // Проверяем, не связана ли ошибка с suspended статусом
    // Directus может вернуть разные сообщения, но обычно это "Invalid user credentials" или "User is suspended"
    let userFriendlyMessage = errorMessage;
    
    // Если это 401 и есть информация о статусе пользователя, проверяем его
    if (res.status === 401) {
      // Пытаемся получить информацию о пользователе для проверки статуса
      try {
        // Используем публичный endpoint для проверки статуса (если доступен)
        // Или просто проверяем текст ошибки
        const lowerError = errorMessage.toLowerCase();
        if (lowerError.includes("suspended") || lowerError.includes("приостановлен") || lowerError.includes("заблокирован")) {
          userFriendlyMessage = "Ваш аккаунт приостановлен. Обратитесь к администратору для восстановления доступа.";
        } else if (lowerError.includes("invalid") || lowerError.includes("credentials") || lowerError.includes("неверный")) {
          userFriendlyMessage = "Неверный email или пароль. Проверьте правильность введенных данных.";
        } else {
          userFriendlyMessage = "Ошибка авторизации. Проверьте правильность email и пароля.";
        }
      } catch (statusCheckError) {
        // Если не удалось проверить статус, используем оригинальное сообщение
        logger.warn("[LOGIN] Could not check user status:", statusCheckError);
      }
    }
    
    return NextResponse.json(
      { 
        ...data, 
        message: userFriendlyMessage,
        originalError: errorMessage // Сохраняем оригинальное сообщение для отладки
      }, 
      { status: res.status }
    );
  }

  const access = data?.data?.access_token;
  const refresh = data?.data?.refresh_token;

  logger.debug("[LOGIN] Tokens extracted:", { hasAccessToken: !!access, hasRefreshToken: !!refresh });

  if (!access) {
    logger.error("[LOGIN] No access token in response!");
    return NextResponse.json({ message: "No access token received from Directus" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  // Время жизни токенов: 3 дня
  const maxAge = 60 * 60 * 24 * 3; // 3 дня в секундах
  
  logger.debug("[LOGIN] Setting cookies:", { secure, maxAge, nodeEnv: process.env.NODE_ENV });
  
  if (access) {
    response.cookies.set("directus_access_token", access, { 
      httpOnly: true, 
      secure, 
      sameSite: "lax", 
      path: "/",
      maxAge: maxAge
    });
    logger.debug("[LOGIN] Access token cookie set");
  }
  if (refresh) {
    response.cookies.set("directus_refresh_token", refresh, { 
      httpOnly: true, 
      secure, 
      sameSite: "lax", 
      path: "/",
      maxAge: maxAge
    });
    logger.debug("[LOGIN] Refresh token cookie set");
  }
  
  logger.debug("[LOGIN] Login successful");
  return response;
}
