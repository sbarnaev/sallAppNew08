import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";
import { getValidToken } from "@/lib/guards";
import { logger } from "@/lib/logger";

/**
 * Проверяет доступ пользователя по подписке в API endpoint
 * @returns null если доступ есть, или NextResponse с ошибкой если доступа нет
 */
export async function checkSubscriptionInAPI(): Promise<NextResponse | null> {
  const baseUrl = getDirectusUrl();
  
  if (!baseUrl) {
    return NextResponse.json(
      { message: "Unauthorized", code: "NO_ACCESS" },
      { status: 401 }
    );
  }

  // Получаем валидный токен (с автоматическим обновлением при необходимости)
  const token = await getValidToken();
  
  if (!token) {
    return NextResponse.json(
      { message: "Unauthorized", code: "NO_ACCESS" },
      { status: 401 }
    );
  }

  try {
    const response = await fetch(`${baseUrl}/users/me?fields=id,subscription_expires_at`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      // Если получили 401, возможно токен истек, но getValidToken должен был обновить его
      // В этом случае возвращаем ошибку авторизации
      return NextResponse.json(
        { message: "Unauthorized", code: "NO_ACCESS" },
        { status: 401 }
      );
    }

    const data = await response.json().catch(() => null);
    if (!data?.data) {
      return NextResponse.json(
        { message: "Unauthorized", code: "NO_ACCESS" },
        { status: 401 }
      );
    }

    const expiresAt = data.data.subscription_expires_at;
    
    // Если поле не установлено - доступ есть (для существующих пользователей)
    if (!expiresAt) {
      return null;
    }

    // Проверяем срок
    const expiresDate = new Date(expiresAt);
    const now = new Date();
    
    if (expiresDate <= now) {
      return NextResponse.json(
        { 
          message: "Доступ к системе истёк. Пожалуйста, продлите подписку.",
          code: "SUBSCRIPTION_EXPIRED",
          expiresAt 
        },
        { status: 403 }
      );
    }

    // Доступ есть
    return null;
  } catch (error) {
    // В случае ошибки не блокируем доступ (fail-open для стабильности)
    // Но логируем ошибку для отладки
    logger.error("Error checking subscription:", error);
    return null;
  }
}

