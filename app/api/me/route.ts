import { NextResponse } from "next/server";
import { fetchDirectusWithAuth } from "@/lib/guards";
import { getDirectusUrl } from "@/lib/env";
import { getValidToken } from "@/lib/guards";

export async function GET() {
  try {
    // Получаем базовую информацию о пользователе
    const response = await fetchDirectusWithAuth("users/me?fields=id,first_name,last_name,email,contact");
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(data || { data: null }, { status: response.status });
    }

    // Делаем отдельный запрос для subscription_expires_at (как в checkSubscriptionInAPI)
    let expiresAt: string | null = null;
    try {
      const token = await getValidToken();
      const baseUrl = getDirectusUrl();
      
      if (token && baseUrl) {
        const subscriptionResponse = await fetch(`${baseUrl}/users/me?fields=id,subscription_expires_at`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (subscriptionResponse.ok) {
          const subscriptionData = await subscriptionResponse.json().catch(() => null);
          expiresAt = subscriptionData?.data?.subscription_expires_at || null;
          
          console.log("[API /api/me] Subscription check:", {
            hasSubscriptionData: !!subscriptionData?.data,
            expiresAt,
            subscriptionDataKeys: subscriptionData?.data ? Object.keys(subscriptionData.data) : []
          });
        }
      }
    } catch (error) {
      console.error("[API /api/me] Error fetching subscription:", error);
    }

    // Добавляем информацию о доступе
    if (data?.data) {
      
      // Всегда создаем объект subscription для единообразия
      if (expiresAt) {
        console.log("[API /api/me] Processing expiresAt:", expiresAt);
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
