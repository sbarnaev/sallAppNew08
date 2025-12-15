import { NextResponse } from "next/server";
import { fetchDirectusWithAuth } from "@/lib/guards";

export async function GET() {
  try {
    const response = await fetchDirectusWithAuth("users/me?fields=id,first_name,last_name,email,contact,subscription_expires_at");
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(data || { data: null }, { status: response.status });
    }

    // Добавляем информацию о доступе
    if (data?.data) {
      const expiresAt = data.data.subscription_expires_at;
      if (expiresAt) {
        const expiresDate = new Date(expiresAt);
        const now = new Date();
        const hasAccess = expiresDate > now;
        const daysRemaining = hasAccess 
          ? Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
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
        
        data.data.subscription = {
          expiresAt,
          hasAccess,
          daysRemaining
        };
      } else {
        // Для существующих пользователей без поля - считаем что доступ есть
        data.data.subscription = {
          expiresAt: null,
          hasAccess: true,
          daysRemaining: null
        };
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
