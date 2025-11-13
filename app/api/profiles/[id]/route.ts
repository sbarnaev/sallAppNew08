import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl, getS3ImageUrl } from "@/lib/env";

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
  // Пробуем включить Images ID в основной запрос
  // Если будет 403, обработаем это отдельно
  // В Directus поле может называться "Images ID" (с пробелом), но в API обычно используется snake_case
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
    "images_id", // Пробуем разные варианты названия поля
    "Images ID",
    "images",
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
  
  // Проверяем, получили ли мы Images ID в основном запросе
  // Пробуем разные варианты названия поля
  let imagesFromMainRequest: any = null;
  const profileData = (data as any)?.data;
  if (r.ok && profileData) {
    // Пробуем разные варианты названия поля
    imagesFromMainRequest = profileData["Images ID"] || profileData["images_id"] || profileData["images"] || profileData["Images_ID"];
    if (imagesFromMainRequest) {
      console.log("[DEBUG] Images received in main request:", imagesFromMainRequest);
    }
  } else if (r.status === 403) {
    // Если получили 403, возможно из-за поля images, пробуем запрос без fields
    console.log("[DEBUG] Got 403, trying request without fields restriction");
    try {
      const allFieldsUrl = `${baseUrl}/items/profiles/${id}`;
      const allFieldsRes = await fetch(allFieldsUrl, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
      if (allFieldsRes.ok) {
        const allFieldsData = await allFieldsRes.json().catch(() => ({}));
        const allFieldsProfileData = allFieldsData?.data || {};
        console.log("[DEBUG] All fields response keys:", Object.keys(allFieldsProfileData));
        // Пробуем разные варианты названия поля
        imagesFromMainRequest = allFieldsProfileData["Images ID"] || allFieldsProfileData["images_id"] || allFieldsProfileData["images"] || allFieldsProfileData["Images_ID"];
        if (imagesFromMainRequest) {
          console.log("[DEBUG] Images received from all-fields request:", imagesFromMainRequest);
          // Обновляем data, чтобы использовать его дальше
          data = allFieldsData;
          r = allFieldsRes;
        } else {
          // Пробуем server endpoint (может иметь другие права)
          console.log("[DEBUG] Trying server endpoint for images");
          try {
            // Пробуем разные варианты названия поля
            const fieldVariants = ["Images ID", "images_id", "images", "Images_ID"];
            for (const fieldName of fieldVariants) {
              const serverUrl = `${baseUrl}/server/items/profiles/${id}?fields=${encodeURIComponent(fieldName)}`;
              const serverRes = await fetch(serverUrl, {
                headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
                cache: "no-store",
              });
              if (serverRes.ok) {
                const serverData = await serverRes.json().catch(() => ({}));
                console.log("[DEBUG] Server endpoint response (field:", fieldName, "):", serverData);
                const serverProfileData = serverData?.data || {};
                imagesFromMainRequest = serverProfileData[fieldName] || serverProfileData["Images ID"] || serverProfileData["images_id"] || serverProfileData["images"];
                if (imagesFromMainRequest) {
                  console.log("[DEBUG] Images received from server endpoint:", imagesFromMainRequest);
                  break;
                }
              } else {
                const errorText = await serverRes.text().catch(() => '');
                console.warn("[DEBUG] Server endpoint failed (field:", fieldName, "):", serverRes.status, errorText);
              }
            }
          } catch (serverError) {
            console.warn("[DEBUG] Server endpoint error:", serverError);
          }
          
          // Пробуем GraphQL запрос для получения images
          if (!imagesFromMainRequest) {
            console.log("[DEBUG] Trying GraphQL query for images");
            try {
              const graphqlUrl = `${baseUrl}/graphql`;
              // Пробуем разные варианты названия поля в GraphQL
              const fieldVariants = ["images_id", "images", "Images_ID"];
              for (const fieldName of fieldVariants) {
                const graphqlQuery = {
                  query: `query {
                    profiles_by_id(id: ${id}) {
                      ${fieldName}
                    }
                  }`
                };
              const graphqlRes = await fetch(graphqlUrl, {
                method: 'POST',
                headers: { 
                  Authorization: `Bearer ${token}`, 
                  'Content-Type': 'application/json',
                  Accept: "application/json" 
                },
                body: JSON.stringify(graphqlQuery),
                cache: "no-store",
              });
                if (graphqlRes.ok) {
                  const graphqlData = await graphqlRes.json().catch(() => ({}));
                  console.log("[DEBUG] GraphQL response (field:", fieldName, "):", graphqlData);
                  const graphqlProfileData = graphqlData?.data?.profiles_by_id || {};
                  imagesFromMainRequest = graphqlProfileData[fieldName] || graphqlProfileData["images_id"] || graphqlProfileData["images"];
                  if (imagesFromMainRequest) {
                    console.log("[DEBUG] Images received from GraphQL:", imagesFromMainRequest);
                    break;
                  }
                } else {
                  const errorText = await graphqlRes.text().catch(() => '');
                  console.warn("[DEBUG] GraphQL failed (field:", fieldName, "):", graphqlRes.status, errorText);
                }
              }
            } catch (graphqlError) {
              console.warn("[DEBUG] GraphQL query failed:", graphqlError);
            }
          }
        }
      } else {
        const errorText = await allFieldsRes.text().catch(() => '');
        console.warn("[DEBUG] All-fields request failed:", allFieldsRes.status, errorText);
      }
    } catch (error) {
      console.warn("[DEBUG] Error trying all-fields request:", error);
    }
  }
  
  // Обрабатываем images, если они есть
  // Теперь используем S3 хранилище вместо Directus
  let processedImages: any = null;
  if (imagesFromMainRequest) {
    try {
      let imagesObj: any = imagesFromMainRequest;
      if (typeof imagesObj === 'string') {
        imagesObj = JSON.parse(imagesObj);
      }
      console.log("[DEBUG] Parsed images object:", imagesObj);
      
      // Формируем массив изображений с прямыми ссылками на S3
      const sortedKeys = Object.keys(imagesObj).sort((a, b) => parseInt(a) - parseInt(b));
      processedImages = sortedKeys.map((key) => {
        const imageId = imagesObj[key];
        if (imageId != null && imageId !== '') {
          const s3Url = getS3ImageUrl(imageId);
          return {
            id: imageId,
            url: s3Url,
            position: key,
          };
        }
        return null;
      }).filter((img) => img != null);
      
      console.log("[DEBUG] Processed images from S3:", {
        count: processedImages.length,
        images: processedImages.map(img => ({
          id: img.id,
          url: img.url,
          position: img.position
        }))
      });
    } catch (imagesError) {
      console.warn("[DEBUG] Error processing images:", imagesError);
    }
  } else {
    console.warn("[DEBUG] No images field found in profile data.");
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
        
        // Теперь попробуем загрузить Images ID отдельно
        try {
          // Пробуем разные варианты названия поля
          const fieldVariants = ["Images ID", "images_id", "images", "Images_ID"];
          for (const fieldName of fieldVariants) {
            const imagesOnlyUrl = `${baseUrl}/items/profiles/${id}?fields=${encodeURIComponent(fieldName)}`;
            const imagesOnlyRes = await fetch(imagesOnlyUrl, {
              headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
              cache: "no-store",
            });
            if (imagesOnlyRes.ok) {
              const imagesOnlyData = await imagesOnlyRes.json().catch(() => ({}));
              const imagesOnlyProfileData = imagesOnlyData?.data || {};
              const imagesValue = imagesOnlyProfileData[fieldName] || imagesOnlyProfileData["Images ID"] || imagesOnlyProfileData["images_id"] || imagesOnlyProfileData["images"];
              if (imagesValue) {
                (retryParsed as any).data["Images ID"] = imagesValue;
                (retryParsed as any).data["images_id"] = imagesValue;
                (retryParsed as any).data["images"] = imagesValue;
                console.log("[DEBUG] Successfully loaded Images ID field separately (as:", fieldName, ")");
                break;
              }
            }
          }
        } catch (imagesError) {
          console.warn("[DEBUG] Could not load Images ID separately:", imagesError);
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
      
      // Используем processedImages из первого блока, если они были загружены
      // Если нет, пробуем обработать Images ID из item
      // Пробуем разные варианты названия поля
      const itemImages = item?.["Images ID"] || item?.["images_id"] || item?.images || item?.["Images_ID"];
      if (!processedImages && itemImages) {
        try {
          let imagesObj: any = itemImages;
          if (typeof imagesObj === 'string') {
            imagesObj = JSON.parse(imagesObj);
          }
          
          // Формируем массив изображений с прямыми ссылками на S3
          const sortedKeys = Object.keys(imagesObj).sort((a, b) => parseInt(a) - parseInt(b));
          processedImages = sortedKeys.map((key) => {
            const imageId = imagesObj[key];
            if (imageId != null && imageId !== '') {
              const s3Url = getS3ImageUrl(imageId);
              return {
                id: imageId,
                url: s3Url,
                position: key,
              };
            }
            return null;
          }).filter((img) => img != null);
          
          console.log("[DEBUG] Loaded images from S3 (fallback):", {
            loadedCount: processedImages.length,
            images: processedImages
          });
        } catch (parseError) {
          console.error("[DEBUG] Error parsing images:", parseError);
        }
      }
      
      (data as any).data = { 
        ...item, 
        client_id: clientId,
        // Всегда используем processedImages, если они есть (с URL из S3)
        images: processedImages || (itemImages ? [itemImages] : []),
        images_id: processedImages || itemImages, // Дублируем для совместимости
        "Images ID": processedImages || itemImages, // Дублируем для совместимости
      };
      
      // Логируем финальный формат images для отладки
      console.log("[DEBUG] Final images in response:", {
        processedImagesCount: processedImages ? processedImages.length : 0,
        hasItemImages: !!itemImages,
        finalImages: (data as any).data.images
      });
      
      // Логируем данные для диагностики
      console.log("[DEBUG] Profile API response:", {
        id: item?.id,
        hasHtml: !!(item?.html),
        hasRawJson: !!item?.raw_json,
        rawJsonType: typeof item?.raw_json,
        rawJsonLength: item?.raw_json ? (typeof item?.raw_json === 'string' ? item?.raw_json.length : JSON.stringify(item?.raw_json).length) : 0,
        hasDigits: !!item?.digits,
        hasImages: !!(processedImages || itemImages),
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
    
    // Для 401 (неавторизован) возвращаем структурированный ответ
    if (r.status === 401) {
      const errorMessage = (data as any)?.errors?.[0]?.message || "Требуется авторизация";
      return NextResponse.json(
        { 
          data: null, 
          errors: [{ 
            message: errorMessage,
            extensions: { code: "UNAUTHORIZED", status: 401 }
          }] 
        },
        { status: 401 }
      );
    }
    
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
