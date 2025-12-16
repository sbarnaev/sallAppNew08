import { NextResponse } from "next/server";
import { fetchDirectusWithAuth } from "@/lib/guards";

export async function GET() {
  try {
    const response = await fetchDirectusWithAuth("users/me?fields=id,first_name,last_name,email,contact,subscription_expires_at");
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(data || { data: null }, { status: response.status });
    }

    // Логируем что вернул Directus
    console.log("[API /api/me] Directus response:", {
      hasData: !!data?.data,
      dataKeys: data?.data ? Object.keys(data.data) : [],
      subscriptionExpiresAt: data?.data?.subscription_expires_at,
      rawData: JSON.stringify(data?.data).substring(0, 500)
    });

    // Добавляем информацию о доступе
    if (data?.data) {
      // Пробуем разные варианты названия поля
      const expiresAt = data.data.subscription_expires_at 
        || data.data["subscription_expires_at"]
        || data.data["Subscription Expires At"]
        || data.data.subscriptionExpiresAt;
      
      console.log("[API /api/me] Found expiresAt:", expiresAt);
      
      // Всегда создаем объект subscription для единообразия
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
        
        // Доступ активен - возвращаем информацию о подписке
        data.data.subscription = {
          expiresAt,
          hasAccess: true,
          daysRemaining
        };
      } else {
        // Для пользователей без поля subscription_expires_at - безлимит
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
