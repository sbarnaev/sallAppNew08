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

    // Запрашиваем создание консультации
    // Пробуем несколько вариантов URL для максимальной совместимости
    // Вариант 1: с return=* и fields
    let url = `${baseUrl}/items/consultations?fields=id,client_id,type,status,scheduled_at,owner_user&return=*`;
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

    // Обрабатываем разные статусы ответа от Directus
    let consultationId: number | null = null;
    let consultationData: any = {};

    // Статус 204 (No Content) - успешное создание без тела ответа
    if (r.status === 204) {
      logger.log("Directus returned 204 (No Content), fetching created consultation with retry...");
      
      // Запрашиваем последнюю созданную консультацию для этого клиента
      // Используем фильтр по client_id, owner_user и type для точности
      // Добавляем retry с задержкой, так как Directus может еще не успеть сохранить запись
      const fetchUrl = `${baseUrl}/items/consultations?filter[client_id][_eq]=${client_id}&filter[owner_user][_eq]=${ownerUserId}&filter[type][_eq]=express&sort=-created_at&limit=1&fields=id,client_id,type,status,scheduled_at,owner_user`;
      
      let retries = 3;
      let delay = 500; // Начинаем с 500мс
      
      while (retries > 0 && !consultationId) {
        try {
          // Небольшая задержка перед запросом
          if (retries < 3) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Увеличиваем задержку с каждой попыткой
          }
          
          logger.log(`Attempting to fetch consultation (${4 - retries}/3)...`);
          
          const fetchRes = await fetch(fetchUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
          });

          logger.log(`Fetch response status: ${fetchRes.status}`);

          if (fetchRes.ok) {
            const fetchData = await fetchRes.json().catch(() => ({}));
            logger.log("Fetch data:", {
              hasData: !!fetchData?.data,
              isArray: Array.isArray(fetchData?.data),
              length: Array.isArray(fetchData?.data) ? fetchData.data.length : 0,
              firstItem: Array.isArray(fetchData?.data) && fetchData.data.length > 0 ? fetchData.data[0] : null,
            });
            
            if (fetchData?.data && Array.isArray(fetchData.data) && fetchData.data.length > 0) {
              consultationId = fetchData.data[0]?.id;
              consultationData = { data: fetchData.data[0] };
              logger.log("Successfully fetched consultation ID after 204:", consultationId);
              break; // Успешно получили ID, выходим из цикла
            }
          } else {
            const errorText = await fetchRes.text().catch(() => "");
            logger.warn(`Fetch failed with status ${fetchRes.status}:`, errorText.substring(0, 200));
          }
        } catch (fetchError: any) {
          logger.error(`Failed to fetch consultation after 204 (attempt ${4 - retries}):`, fetchError?.message || fetchError);
        }
        
        retries--;
      }

      // Если не удалось получить ID после всех попыток, пробуем более широкий поиск
      if (!consultationId) {
        logger.warn("Could not retrieve consultation ID with filters, trying broader search...");
        
        try {
          // Вариант 1: Более широкий поиск - только по client_id и типу, без owner_user
          const broaderUrl1 = `${baseUrl}/items/consultations?filter[client_id][_eq]=${client_id}&filter[type][_eq]=express&sort=-created_at&limit=5&fields=id,client_id,type,status,scheduled_at,owner_user`;
          
          const broaderRes1 = await fetch(broaderUrl1, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
          });

          if (broaderRes1.ok) {
            const broaderData1 = await broaderRes1.json().catch(() => ({}));
            if (broaderData1?.data && Array.isArray(broaderData1.data) && broaderData1.data.length > 0) {
              // Берем самую свежую консультацию
              const latest = broaderData1.data[0];
              consultationId = latest?.id;
              consultationData = { data: latest };
              logger.log("Found consultation with broader search (without owner_user):", consultationId);
            }
          }
          
          // Вариант 2: Еще более широкий - только по client_id, без type
          if (!consultationId) {
            logger.warn("Trying even broader search - only by client_id...");
            const broaderUrl2 = `${baseUrl}/items/consultations?filter[client_id][_eq]=${client_id}&sort=-created_at&limit=10&fields=id,client_id,type,status,scheduled_at,owner_user`;
            
            const broaderRes2 = await fetch(broaderUrl2, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
              },
              cache: "no-store",
              signal: AbortSignal.timeout(5000),
            });

            if (broaderRes2.ok) {
              const broaderData2 = await broaderRes2.json().catch(() => ({}));
              if (broaderData2?.data && Array.isArray(broaderData2.data) && broaderData2.data.length > 0) {
                // Ищем экспресс-консультацию среди последних
                const expressConsultation = broaderData2.data.find((c: any) => c.type === "express");
                if (expressConsultation) {
                  consultationId = expressConsultation.id;
                  consultationData = { data: expressConsultation };
                  logger.log("Found consultation with very broad search:", consultationId);
                }
              }
            }
          }
        } catch (broaderError: any) {
          logger.error("Broader search also failed:", broaderError?.message || broaderError);
        }
      }

      // Если все еще не удалось получить ID, возвращаем ошибку
      if (!consultationId) {
        logger.error("Could not retrieve consultation ID after 204 response and all retries", {
          clientId: client_id,
          ownerUserId,
          fetchUrl,
        });
        return NextResponse.json(
          { 
            message: "Consultation created but could not retrieve ID",
            details: { 
              status: 204, 
              suggestion: "The consultation was created but we couldn't find it. Please check the consultations list.",
              clientId: client_id,
            },
          },
          { status: 500 }
        );
      }
    } else {
      // Для других статусов пытаемся парсить JSON
      const responseText = await r.text().catch(() => "");
      
      if (responseText) {
        try {
          consultationData = JSON.parse(responseText);
        } catch (parseError) {
          logger.error("Failed to parse Directus response as JSON:", {
            status: r.status,
            statusText: r.statusText,
            responseText: responseText.substring(0, 500),
          });
          
          if (r.ok) {
            // Если статус успешный, но не можем распарсить - пробуем получить через запрос
            return NextResponse.json(
              { 
                message: "Invalid response format from Directus",
                details: { status: r.status, responseText: responseText.substring(0, 500) },
              },
              { status: 500 }
            );
          }
        }
      }

      if (!r.ok) {
        logger.error("Error creating express consultation:", {
          status: r.status,
          statusText: r.statusText,
          errors: consultationData?.errors,
          data: consultationData,
        });
        
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

      // Извлекаем ID из ответа
      consultationId = consultationData?.data?.id 
        || consultationData?.id 
        || consultationData?.data?.data?.id
        || (Array.isArray(consultationData?.data) && consultationData.data[0]?.id)
        || (Array.isArray(consultationData) && consultationData[0]?.id);
        
      if (!consultationId) {
        logger.error("Consultation created but no ID in response:", {
          status: r.status,
          statusText: r.statusText,
          fullResponse: consultationData,
          keys: Object.keys(consultationData || {}),
        });
        
        return NextResponse.json(
          { 
            message: "Consultation created but no ID returned",
            details: {
              response: consultationData,
              status: r.status,
            },
          },
          { status: 500 }
        );
      }
    }
    
    logger.log("Consultation created successfully:", {
      consultationId,
      clientId: client_id,
      type: "express",
    });

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

