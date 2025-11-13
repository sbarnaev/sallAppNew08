import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: { id: string }}) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) return NextResponse.json({ data: null }, { status: 401 });
  
  // Проверяем, что URL валидный
  if (!baseUrl.startsWith('http')) {
    console.error("Invalid Directus URL:", baseUrl);
    return NextResponse.json({ data: null, message: "Invalid DIRECTUS_URL" }, { status: 500 });
  }
  
  const { id } = ctx.params;
  
  // Проверяем, что ID валидный
  if (!id || isNaN(Number(id))) {
    console.error("[DEBUG] Invalid profile ID:", id);
    return NextResponse.json({ data: null, errors: [{ message: "Invalid profile ID" }] }, { status: 400 });
  }
  
  const url = `${baseUrl}/items/profiles/${id}`;
  console.log("[DEBUG] Profile request URL:", url);
  // Не включаем images в основной запрос, так как может быть 403
  // Загружаем images отдельно после успешного получения профиля
  const fields = [
    "id",
    "client_id",
    "created_at",
    "html",
    "raw_json",
    "ui_state",
    "notes",
    "chat_history",
    "digits",
    // "images" - загружаем отдельно
  ].join(",");
  const urlWithFields = `${url}?fields=${encodeURIComponent(fields)}`;

  async function fetchProfile(accessToken: string) {
    try {
      // Проверяем и исправляем URL если нужно
      let finalUrl = urlWithFields;
      if (baseUrl.startsWith('https://')) {
        const urlObj = new URL(baseUrl);
        if (urlObj.port === '443') {
          urlObj.port = '';
          const correctedBase = urlObj.toString();
          finalUrl = finalUrl.replace(baseUrl, correctedBase);
          console.log("Corrected URL (removed port 443):", finalUrl);
        }
      }
      
      console.log("[DEBUG] Fetching profile from Directus:", finalUrl);
      const r = await fetch(finalUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        cache: "no-store",
      });
      const rawData = await r.text();
      console.log("[DEBUG] Directus raw response status:", r.status, r.statusText);
      console.log("[DEBUG] Directus raw response (first 500 chars):", rawData.substring(0, 500));
      
      // Если статус не 200, логируем полный ответ
      if (!r.ok) {
        console.error("[DEBUG] Directus error - full response:", rawData);
        console.error("[DEBUG] Directus error - URL was:", finalUrl);
      }
      
      let data;
      try {
        // Если ответ не JSON (например, "404 page not found"), создаем структурированный ответ
        if (r.status === 404 && !rawData.trim().startsWith('{') && !rawData.trim().startsWith('[')) {
          console.warn("[DEBUG] Directus returned non-JSON 404, treating as profile not found");
          data = { 
            data: null, 
            errors: [{ 
              message: "Profile not found", 
              extensions: { code: "NOT_FOUND" } 
            }] 
          };
        } else {
          data = JSON.parse(rawData);
        }
      } catch (parseError) {
        console.error("[DEBUG] Failed to parse Directus response:", {
          error: parseError,
          rawData: rawData.substring(0, 200),
          status: r.status,
          url: finalUrl
        });
        // Создаем структурированный ответ для ошибки парсинга
        data = { 
          data: null, 
          errors: [{ 
            message: rawData.includes("404") ? "Profile not found" : "Invalid response from Directus",
            extensions: { code: r.status === 404 ? "NOT_FOUND" : "PARSE_ERROR" }
          }] 
        };
      }
      
      return { r, data } as const;
    } catch (error: any) {
      console.error("Error fetching profile from Directus:", {
        message: error?.message,
        code: error?.code,
        url: urlWithFields,
        baseUrl: baseUrl
      });
      return { 
        r: new Response(null, { status: 500 }), 
        data: { data: null, errors: [{ message: String(error?.message || error) }] } 
      } as const;
    }
  }

  let { r, data } = await fetchProfile(token);
  
  // Пытаемся загрузить images отдельно (если нужно)
  let processedImages: any = null;
  try {
    const imagesOnlyUrl = `${baseUrl}/items/profiles/${id}?fields=images`;
    const imagesOnlyRes = await fetch(imagesOnlyUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (imagesOnlyRes.ok) {
      const imagesOnlyData = await imagesOnlyRes.json().catch(() => ({}));
      if (imagesOnlyData?.data?.images) {
        // Обрабатываем images
        try {
          let imagesObj: any = imagesOnlyData.data.images;
          if (typeof imagesObj === 'string') {
            imagesObj = JSON.parse(imagesObj);
          }
          const imageIds = Object.values(imagesObj).filter((id: any) => id != null && id !== '') as number[];
          if (imageIds.length > 0) {
            const imagesUrl = `${baseUrl}/items/images?filter[id][_in]=${imageIds.join(',')}&fields=id,code`;
            const imagesRes = await fetch(imagesUrl, {
              headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
              cache: "no-store",
            });
            if (imagesRes.ok) {
              const imagesData = await imagesRes.json().catch(() => ({ data: [] }));
              const imagesMap = new Map((imagesData?.data || []).map((img: any) => [img.id, img.code]));
              const sortedKeys = Object.keys(imagesObj).sort((a, b) => parseInt(a) - parseInt(b));
              processedImages = sortedKeys.map((key) => {
                const id = imagesObj[key];
                return {
                  id: id,
                  code: imagesMap.get(id) || null,
                  position: key,
                };
              }).filter((img) => img.code != null);
            }
          }
        } catch (imagesError) {
          console.warn("[DEBUG] Error processing images:", imagesError);
        }
      }
    }
  } catch (imagesError) {
    // Игнорируем ошибки загрузки images
  }
  
  // Если получили 403 из-за поля images (старая логика, на случай если images был в fields)
  if (r.status === 403 && (data as any)?.errors?.[0]?.message?.includes('images')) {
    console.log("[DEBUG] Got 403 for images field, retrying without images field");
    const fieldsWithoutImages = [
      "id",
      "client_id",
      "created_at",
      "html",
      "raw_json",
      "ui_state",
      "notes",
      "chat_history",
      "digits",
    ].join(",");
    const urlWithoutImages = `${baseUrl}/items/profiles/${id}?fields=${encodeURIComponent(fieldsWithoutImages)}`;
    
    try {
      const retryRes = await fetch(urlWithoutImages, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
      const retryDataText = await retryRes.text();
      let retryParsed: any;
      try {
        retryParsed = JSON.parse(retryDataText);
      } catch {
        retryParsed = { data: null, errors: [] };
      }
      
      if (retryRes.ok && retryParsed?.data) {
        r = retryRes;
        data = retryParsed;
        console.log("[DEBUG] Successfully fetched profile without images field");
        
        // Теперь попробуем загрузить images отдельно
        try {
          const imagesOnlyUrl = `${baseUrl}/items/profiles/${id}?fields=images`;
          const imagesOnlyRes = await fetch(imagesOnlyUrl, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            cache: "no-store",
          });
          if (imagesOnlyRes.ok) {
            const imagesOnlyData = await imagesOnlyRes.json().catch(() => ({}));
            if (imagesOnlyData?.data?.images) {
              (retryParsed as any).data.images = imagesOnlyData.data.images;
              console.log("[DEBUG] Successfully loaded images field separately");
            }
          }
        } catch (imagesError) {
          console.warn("[DEBUG] Could not load images separately:", imagesError);
        }
      }
    } catch (retryError) {
      console.error("[DEBUG] Error retrying without images:", retryError);
    }
  }
  
  console.log("[DEBUG] After fetchProfile:", {
    status: r.status,
    statusText: r.statusText,
    hasData: !!data,
    hasErrors: !!(data as any)?.errors,
    firstError: (data as any)?.errors?.[0],
    errorMessage: (data as any)?.errors?.[0]?.message
  });

  if (r.status === 401 && data?.errors?.[0]?.message === "Token expired.") {
    // попробуем освежить токен
    // Используем заголовки для определения правильного origin
    const headersList = req.headers;
    const host = headersList.get("host") || headersList.get("x-forwarded-host") || "localhost:3000";
    const protocol = headersList.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const origin = `${protocol}://${host}`;
    
    console.log("[DEBUG] Token expired, attempting to refresh", {
      origin,
      host,
      protocol,
      requestUrl: req.url,
      forwardedHost: headersList.get("x-forwarded-host"),
      forwardedProto: headersList.get("x-forwarded-proto")
    });
    
    try {
      // Передаем cookies вручную, так как fetch из серверного кода не передает их автоматически
      const allCookies = cookies().getAll();
      const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ');
      
      console.log("[DEBUG] Making refresh request with cookies:", {
        hasCookies: allCookies.length > 0,
        cookieNames: allCookies.map(c => c.name),
        origin
      });
      
      const refreshRes = await fetch(`${origin}/api/refresh`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cookie": cookieHeader
        },
        // Увеличиваем таймаут для refresh запроса
        signal: AbortSignal.timeout(10000), // 10 секунд
      });
      
      console.log("[DEBUG] Refresh response status:", refreshRes.status, refreshRes.statusText);
      
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json().catch(() => ({}));
        console.log("[DEBUG] Refresh response data keys:", Object.keys(refreshData));
        // Используем токен из ответа, а не из cookies
        const newToken = refreshData?.access_token || cookies().get("directus_access_token")?.value;
        const newRefreshToken = refreshData?.refresh_token; // Сохраняем новый refresh token
        
        if (newToken) {
          console.log("[DEBUG] Token refreshed successfully, retrying profile fetch");
          // Обновляем cookies с новыми токенами (если они есть в ответе)
          if (newRefreshToken) {
            console.log("[DEBUG] New refresh token received, updating cookies");
            // Cookies обновятся в ответе от /api/refresh, но для текущего запроса используем новый access token
          }
          ({ r, data } = await fetchProfile(newToken));
          console.log("[DEBUG] After refresh retry - status:", r.status, "hasData:", !!data?.data);
        } else {
          console.warn("[DEBUG] Token refresh returned no access_token", refreshData);
        }
      } else {
        const refreshErrorText = await refreshRes.text().catch(() => '');
        let refreshErrorData: any = {};
        try {
          refreshErrorData = JSON.parse(refreshErrorText);
        } catch {
          refreshErrorData = { raw: refreshErrorText.substring(0, 200) };
        }
        console.error("[DEBUG] Token refresh failed:", {
          status: refreshRes.status,
          statusText: refreshRes.statusText,
          error: refreshErrorData,
          errorText: refreshErrorText.substring(0, 200)
        });
      }
    } catch (refreshError: any) {
      console.error("[DEBUG] Error refreshing token:", {
        message: refreshError?.message,
        code: refreshError?.code,
        cause: refreshError?.cause,
        name: refreshError?.name,
        stack: refreshError?.stack?.substring(0, 500)
      });
      // Не прерываем выполнение - вернем ошибку 401
    }
  }

  // Нормализация client_id из relation, если бы он вернулся
  try {
    if ((data as any)?.data) {
      const item = (data as any).data;
      const clientId = item?.client_id ?? item?.client?.id ?? null;
      
      // Обрабатываем images: это JSON объект {"1": 10, "2": 30, ...} где значения - ID из коллекции images
      let processedImages: any = null;
      if (item?.images) {
        try {
          let imagesObj: any = item.images;
          if (typeof imagesObj === 'string') {
            imagesObj = JSON.parse(imagesObj);
          }
          
          // Получаем все ID изображений из объекта (значения объекта)
          const imageIds = Object.values(imagesObj).filter((id: any) => id != null && id !== '') as number[];
          
          if (imageIds.length > 0) {
            // Запрашиваем изображения из коллекции images по ID
            try {
              const imagesUrl = `${baseUrl}/items/images?filter[id][_in]=${imageIds.join(',')}&fields=id,code`;
              console.log("[DEBUG] Fetching images from collection:", imagesUrl);
              
              const imagesRes = await fetch(imagesUrl, {
                headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
                cache: "no-store",
              });
              
              if (imagesRes.ok) {
                const imagesData = await imagesRes.json().catch(() => ({ data: [] }));
                const imagesMap = new Map((imagesData?.data || []).map((img: any) => [img.id, img.code]));
                
                // Создаем массив изображений в правильном порядке (по ключам объекта: "1", "2", ...)
                const sortedKeys = Object.keys(imagesObj).sort((a, b) => parseInt(a) - parseInt(b));
                processedImages = sortedKeys.map((key) => {
                  const id = imagesObj[key];
                  return {
                    id: id,
                    code: imagesMap.get(id) || null,
                    position: key, // Сохраняем позицию для отображения
                  };
                }).filter((img) => img.code != null); // Фильтруем только те, у которых есть code
                
                console.log("[DEBUG] Loaded images:", {
                  requestedIds: imageIds,
                  loadedCount: processedImages.length,
                  images: processedImages
                });
              } else {
                const errorText = await imagesRes.text().catch(() => '');
                console.warn("[DEBUG] Failed to load images from collection:", imagesRes.status, errorText);
              }
            } catch (imagesError) {
              console.error("[DEBUG] Error loading images:", imagesError);
            }
          } else {
            console.log("[DEBUG] No image IDs found in images object");
          }
        } catch (parseError) {
          console.error("[DEBUG] Error parsing images:", parseError);
        }
      }
      
      (data as any).data = { 
        ...item, 
        client_id: clientId,
        images: processedImages || item.images // Используем обработанные изображения или оригинал
      };
      
      // Логируем данные для диагностики
      console.log("[DEBUG] Profile API response:", {
        id: item?.id,
        hasHtml: !!(item?.html),
        hasRawJson: !!item?.raw_json,
        rawJsonType: typeof item?.raw_json,
        rawJsonLength: item?.raw_json ? (typeof item?.raw_json === 'string' ? item?.raw_json.length : JSON.stringify(item?.raw_json).length) : 0,
        hasDigits: !!item?.digits,
        hasImages: !!item?.images,
        processedImagesCount: processedImages ? processedImages.length : 0,
        fields: Object.keys(item || {})
      });
    } else {
      console.warn("[DEBUG] Profile API: data.data is null or undefined", {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        responseStatus: r.status,
        responseOk: r.ok
      });
    }
  } catch (normalizeError) {
    console.error("[DEBUG] Error normalizing profile data:", normalizeError);
  }
  
  // Если ошибка сети или профиль не найден, возвращаем правильный статус
  if (!r.ok && !data?.data) {
    console.error("[DEBUG] Directus error response:", {
      status: r.status,
      statusText: r.statusText,
      data: data,
      errors: (data as any)?.errors,
      profileId: id,
      url: urlWithFields
    });
    
    // Для 404 возвращаем структурированный ответ
    if (r.status === 404) {
      return NextResponse.json(
        { 
          data: null, 
          errors: [{ 
            message: `Профиль с ID ${id} не найден`,
            extensions: { code: "NOT_FOUND", profileId: id }
          }] 
        },
        { status: 404 }
      );
    }
    
    // Для других ошибок возвращаем структурированный ответ
    return NextResponse.json(
      { 
        data: null, 
        errors: (data as any)?.errors || [{ 
          message: `Ошибка при получении профиля: ${r.statusText}`,
          extensions: { code: "FETCH_ERROR", status: r.status }
        }] 
      },
      { status: r.status || 500 }
    );
  }
  
  // Логируем финальный ответ
  console.log("[DEBUG] Returning profile data:", {
    hasData: !!data?.data,
    dataId: (data as any)?.data?.id,
    status: r.ok ? 200 : r.status
  });
  
  return NextResponse.json(data, { status: r.ok ? 200 : r.status });
}

export async function PATCH(req: Request, ctx: { params: { id: string }}) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) return NextResponse.json({ message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });

  const { id } = ctx.params;
  const body = await req.json().catch(()=>({}));

  // Проверяем, что URL валидный
  if (!baseUrl.startsWith('http')) {
    console.error("Invalid Directus URL:", baseUrl);
    return NextResponse.json({ message: "Invalid DIRECTUS_URL" }, { status: 500 });
  }

  const allowed: Record<string, any> = {};
  if (body.ui_state !== undefined) allowed.ui_state = body.ui_state; // JSON в profiles
  if (typeof body.notes === 'string') allowed.notes = body.notes;    // HTML заметок
  if (Array.isArray(body.chat_history)) allowed.chat_history = body.chat_history; // история чата

  try {
    const r = await fetch(`${baseUrl}/items/profiles/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(allowed),
    });
    const data = await r.json().catch(()=>({}));
    return NextResponse.json(data, { status: r.status });
  } catch (error) {
    console.error("Error updating profile in Directus:", error);
    return NextResponse.json({ message: "Error connecting to Directus", error: String(error) }, { status: 502 });
  }
}
