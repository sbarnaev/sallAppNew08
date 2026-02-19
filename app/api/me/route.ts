import { NextResponse } from "next/server";
import { fetchDirectusWithAuth } from "@/lib/guards";
import { getDirectusUrl } from "@/lib/env";
import { getValidToken } from "@/lib/guards";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    // Получаем базовую информацию о пользователе вместе с subscription_expires_at одним запросом
    const response = await fetchDirectusWithAuth("users/me?fields=id,first_name,last_name,email,contact,subscription_expires_at");
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(data || { data: null }, { status: response.status });
    }

    // Добавляем информацию о доступе
    if (data?.data) {
      const expiresAt: string | null = data.data.subscription_expires_at || null;

      logger.log("Subscription check:", { expiresAt });

      if (expiresAt) {
        const expiresDate = new Date(expiresAt);
        const now = new Date();
        const hasAccess = expiresDate > now;
        const diffMs = expiresDate.getTime() - now.getTime();
        const fullDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const remainingHours = (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60);
        const daysRemaining = hasAccess
          ? (fullDays === 0 && remainingHours > 0 ? 1 : fullDays)
          : 0;

        // Если доступ истёк, возвращаем 403
        if (!hasAccess) {
          return NextResponse.json(
            {
              message: "Доступ к системе истёк. Пожалуйста, продлите подписку.",
              code: "SUBSCRIPTION_EXPIRED",
              data: {
                ...data.data,
                subscription: {
                  expiresAt,
                  hasAccess: false,
                  daysRemaining: 0
                }
              }
            },
            { status: 403 }
          );
        }

        // Доступ активен
        data.data.subscription = {
          expiresAt,
          hasAccess: true,
          daysRemaining
        };
      } else {
        // Поле не установлено — блокируем, не даём безлимит
        return NextResponse.json(
          {
            message: "Доступ к системе истёк. Пожалуйста, продлите подписку.",
            code: "SUBSCRIPTION_EXPIRED",
            data: {
              ...data.data,
              subscription: {
                expiresAt: null,
                hasAccess: false,
                daysRemaining: 0
              }
            }
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(data ?? { data: null });
  } catch (error) {
    return NextResponse.json(
      { message: "Cannot connect to Directus", error: String(error) },
      { status: 502 },
    );
  }
}
