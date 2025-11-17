import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDirectusUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { internalApiFetch } from "@/lib/fetchers";

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

    // Directus может вернуть ID в разных форматах
    const consultationId = consultationData?.data?.id 
      || consultationData?.id 
      || consultationData?.data?.data?.id;
      
    if (!consultationId) {
      logger.error("Consultation created but no ID returned:", {
        fullResponse: consultationData,
        keys: Object.keys(consultationData || {}),
      });
      return NextResponse.json(
        { 
          message: "Consultation created but no ID returned",
          details: consultationData,
        },
        { status: 500 }
      );
    }

    // 4. Запускаем генерацию базового расчета через существующий /api/calc endpoint
    // Это позволяет использовать уже реализованный функционал и создавать полноценный профиль
    (async () => {
      try {
        logger.log("Starting base calculation via /api/calc for express consultation...");
        
        // Вызываем существующий endpoint для создания базового расчета
        // Он сам создаст профиль, вызовет n8n и вернет profileId
        // Используем internalApiFetch для правильной передачи cookies
        const calcResponse = await internalApiFetch("/api/calc", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientId: Number(client_id),
            name: client.name || "Клиент",
            birthday: client.birth_date,
            type: "base", // Базовый расчет
            gender: client.gender || null,
          }),
          signal: AbortSignal.timeout(90000), // 90 секунд для генерации
        });

        if (calcResponse.ok) {
          const calcData = await calcResponse.json().catch(() => ({}));
          const profileId = calcData?.profileId;
          
          if (profileId) {
            // Обновляем консультацию с profile_id
            try {
              await fetch(`${baseUrl}/items/consultations/${consultationId}`, {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify({ profile_id: Number(profileId) }),
                cache: "no-store",
              });
              logger.log(`Consultation ${consultationId} updated with profile_id ${profileId}`);
            } catch (updateError) {
              logger.warn("Failed to update consultation with profile_id:", updateError);
            }
          } else {
            logger.warn("Base calculation completed but no profileId returned:", calcData);
          }
        } else {
          const calcError = await calcResponse.text().catch(() => "");
          logger.warn("Base calculation failed:", {
            status: calcResponse.status,
            error: calcError.substring(0, 300),
          });
        }
      } catch (error: any) {
        logger.error("Background base calculation error:", error);
        // Не блокируем - консультация уже создана
      }
    })(); // Запускаем асинхронно, не ждем завершения

    return NextResponse.json({
      data: {
        id: consultationId,
        ...consultationData?.data,
      },
      profileId: null, // Профиль генерируется в фоне через /api/calc
    }, { status: 200 });
  } catch (error: any) {
    logger.error("Express consultation start error:", error);
    return NextResponse.json(
      { message: "Server error", error: error?.message },
      { status: 500 }
    );
  }
}

