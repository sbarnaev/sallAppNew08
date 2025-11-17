import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDirectusUrl } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Обновляет access token через refresh token
 */
async function refreshAccessToken(refreshToken: string, baseUrl: string): Promise<string | null> {
  try {
    const refreshUrl = `${baseUrl}/auth/refresh`;
    const res = await fetch(refreshUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json().catch(() => ({}));
    return data?.data?.access_token || null;
  } catch (error) {
    logger.error("Error refreshing token:", error);
    return null;
  }
}

/**
 * Создает новую экспресс-консультацию и запускает базовый расчет через n8n
 */
export async function POST(req: NextRequest) {
  let token = cookies().get("directus_access_token")?.value;
  const refreshToken = cookies().get("directus_refresh_token")?.value;
  const baseUrl = getDirectusUrl();
  const n8nUrl = process.env.N8N_CALC_URL;
  
  if (!token && !refreshToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!baseUrl) {
    return NextResponse.json({ message: "DIRECTUS_URL not configured" }, { status: 500 });
  }

  if (!n8nUrl) {
    return NextResponse.json({ message: "N8N_CALC_URL not configured" }, { status: 500 });
  }

  // Обновляем токен перед запросами
  if (refreshToken) {
    const freshToken = await refreshAccessToken(refreshToken, baseUrl);
    if (freshToken) {
      token = freshToken;
    }
  }

  if (!token) {
    return NextResponse.json({ message: "Unauthorized - no valid token" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { client_id } = body;

    if (!client_id) {
      return NextResponse.json({ message: "client_id is required" }, { status: 400 });
    }

    // 1. Получаем данные клиента
    const clientRes = await fetch(`${baseUrl}/items/clients/${client_id}?fields=id,name,birth_date,gender`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });

    if (!clientRes.ok) {
      return NextResponse.json({ message: "Client not found" }, { status: 404 });
    }

    const clientData = await clientRes.json().catch(() => ({}));
    const client = clientData?.data;

    if (!client || !client.birth_date) {
      return NextResponse.json(
        { message: "Client birth date is required for express consultation" },
        { status: 400 }
      );
    }

    // 2. Получаем текущего пользователя (консультанта)
    const meRes = await fetch(`${baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });

    if (!meRes.ok) {
      return NextResponse.json({ message: "Failed to get current user" }, { status: 500 });
    }

    const meData = await meRes.json().catch(() => ({}));
    const ownerUserId = meData?.data?.id;

    if (!ownerUserId) {
      return NextResponse.json({ message: "Failed to get user ID" }, { status: 500 });
    }

    // 3. Сначала создаем экспресс-консультацию (без профиля)
    // Это гарантирует, что консультация будет создана даже если n8n не работает
    const consultationPayload: any = {
      client_id: Number(client_id),
      owner_user: ownerUserId,
      type: "express",
      status: "in_progress",
      scheduled_at: new Date().toISOString(), // Текущая дата/время для обязательного поля
    };

    const url = `${baseUrl}/items/consultations`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(consultationPayload),
      cache: "no-store",
    });

    const consultationData = await r.json().catch(() => ({}));

    if (!r.ok) {
      logger.error("Error creating express consultation:", {
        status: r.status,
        statusText: r.statusText,
        errors: consultationData?.errors,
        data: consultationData,
      });
      
      // Детальное сообщение об ошибке
      const errorMessage = consultationData?.errors?.[0]?.message 
        || consultationData?.message 
        || `Failed to create consultation (${r.status})`;
      
      return NextResponse.json(
        { 
          message: errorMessage,
          details: consultationData?.errors || consultationData,
        },
        { status: r.status }
      );
    }

    const consultationId = consultationData?.data?.id;
    if (!consultationId) {
      logger.error("Consultation created but no ID returned:", consultationData);
      return NextResponse.json(
        { message: "Consultation created but no ID returned" },
        { status: 500 }
      );
    }

    // 4. Запускаем генерацию профиля через n8n в фоне (не блокируем ответ)
    // Это позволяет начать консультацию даже если профиль еще генерируется
    (async () => {
      try {
        // Создаем пустой профиль для получения profileId
        let profileId: number | null = null;
        try {
          const profileRes = await fetch(`${baseUrl}/items/profiles`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              client_id: Number(client_id),
              owner_user: ownerUserId,
            }),
            cache: "no-store",
          });

          if (profileRes.ok) {
            const profileData = await profileRes.json().catch(() => ({}));
            profileId = profileData?.data?.id || null;
          }
        } catch (error) {
          logger.warn("Failed to create profile placeholder:", error);
        }

        // Вызываем n8n для генерации базового расчета
        const n8nPayload = {
          name: client.name || "Клиент",
          birthday: client.birth_date,
          clientId: Number(client_id),
          type: "base", // Базовый расчет для экспресс-консультации
          profileId,
          gender: client.gender || null,
          directusUrl: baseUrl.replace(/\/+$/, ''),
          token: token,
          refreshToken: refreshToken,
        };

        logger.log("Calling n8n for express consultation profile generation...");
        
        const n8nResponse = await fetch(n8nUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(n8nPayload),
          signal: AbortSignal.timeout(60000), // 60 секунд
        });

        let finalProfileId = profileId;
        
        if (n8nResponse.ok) {
          const n8nData = await n8nResponse.json().catch(() => ({}));
          // n8n может вернуть profileId или обновить существующий
          if (n8nData?.profileId) {
            finalProfileId = n8nData.profileId;
          }
          logger.log("Profile generated successfully via n8n");
        } else {
          const n8nError = await n8nResponse.text().catch(() => "");
          logger.warn("n8n profile generation failed:", {
            status: n8nResponse.status,
            error: n8nError.substring(0, 200),
          });
        }

        // Обновляем консультацию с profile_id если он был создан
        if (finalProfileId) {
          try {
            await fetch(`${baseUrl}/items/consultations/${consultationId}`, {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({ profile_id: finalProfileId }),
              cache: "no-store",
            });
            logger.log(`Consultation ${consultationId} updated with profile_id ${finalProfileId}`);
          } catch (updateError) {
            logger.warn("Failed to update consultation with profile_id:", updateError);
          }
        }
      } catch (error: any) {
        logger.error("Background profile generation error:", error);
        // Не блокируем - консультация уже создана
      }
    })(); // Запускаем асинхронно, не ждем завершения

    return NextResponse.json({
      ...consultationData,
      profileId: null, // Профиль еще генерируется
    }, { status: 200 });
  } catch (error: any) {
    logger.error("Express consultation start error:", error);
    return NextResponse.json(
      { message: "Server error", error: error?.message },
      { status: 500 }
    );
  }
}

