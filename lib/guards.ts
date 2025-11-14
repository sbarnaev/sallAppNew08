import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDirectusUrl } from "@/lib/env";

/**
 * Проверяет валидность access token и автоматически обновляет его при необходимости
 * @returns валидный access token или null если обновление не удалось
 */
export async function getValidToken(): Promise<string | null> {
  const accessToken = cookies().get("directus_access_token")?.value;
  const refreshToken = cookies().get("directus_refresh_token")?.value;
  const baseUrl = getDirectusUrl();

  // Если нет токенов вообще - редирект на логин
  if (!accessToken && !refreshToken) {
    return null;
  }

  // Если есть только refresh token - пытаемся обновить
  if (!accessToken && refreshToken) {
    return await refreshAccessToken(refreshToken, baseUrl);
  }

  // Если есть access token - проверяем его валидность
  if (accessToken && baseUrl) {
    const isValid = await checkTokenValidity(accessToken, baseUrl);
    
    if (isValid) {
      return accessToken;
    }
    
    // Если токен невалиден, но есть refresh token - обновляем
    if (refreshToken) {
      return await refreshAccessToken(refreshToken, baseUrl);
    }
  }

  return null;
}

/**
 * Проверяет валидность токена через запрос к /users/me
 */
async function checkTokenValidity(token: string, baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/users/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000), // 5 секунд таймаут
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Обновляет access token используя refresh token
 */
async function refreshAccessToken(refreshToken: string, baseUrl: string | null): Promise<string | null> {
  if (!baseUrl) {
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000), // 10 секунд таймаут
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json().catch(() => null);
    const newAccessToken = data?.data?.access_token;
    const newRefreshToken = data?.data?.refresh_token;

    if (!newAccessToken) {
      return null;
    }

    // Сохраняем новые токены в cookies
    const cookieStore = cookies();
    const secure = process.env.NODE_ENV === "production";
    const maxAge = 60 * 60 * 24 * 3; // 3 дня

    cookieStore.set("directus_access_token", newAccessToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    if (newRefreshToken) {
      cookieStore.set("directus_refresh_token", newRefreshToken, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge,
      });
    }

    return newAccessToken;
  } catch {
    return null;
  }
}

/**
 * Middleware для защищённых роутов - проверяет и обновляет токен
 * Если токен невалиден и обновить не удалось - редиректит на логин
 */
export async function requireAuth(): Promise<string> {
  const token = await getValidToken();
  
  if (!token) {
    redirect("/login");
  }
  
  return token;
}

/**
 * Выполняет запрос к Directus API с автоматическим обновлением токена при 401 ошибке
 * @param url - URL для запроса (без baseUrl, он добавится автоматически)
 * @param init - опции для fetch
 * @returns Response от Directus
 */
export async function fetchDirectusWithAuth(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const baseUrl = getDirectusUrl();
  if (!baseUrl) {
    throw new Error("DIRECTUS_URL is not set");
  }

  // Убираем ведущий слэш если есть
  const normalizedUrl = url.startsWith("/") ? url.slice(1) : url;
  const fullUrl = `${baseUrl}/${normalizedUrl}`;

  // Получаем валидный токен
  let token = await getValidToken();
  if (!token) {
    // Если токена нет, возвращаем 401
    return new Response(
      JSON.stringify({ message: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Выполняем запрос
  const response = await fetch(fullUrl, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  // Если получили 401 - пытаемся обновить токен и повторить запрос
  if (response.status === 401) {
    const refreshToken = cookies().get("directus_refresh_token")?.value;
    if (refreshToken) {
      const newToken = await refreshAccessToken(refreshToken, baseUrl);
      if (newToken) {
        // Повторяем запрос с новым токеном
        return fetch(fullUrl, {
          ...init,
          headers: {
            ...init.headers,
            Authorization: `Bearer ${newToken}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });
      }
    }
  }

  return response;
}
