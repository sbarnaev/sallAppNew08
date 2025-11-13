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
  const url = `${baseUrl}/items/profiles/${id}`;
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
      }
      
      let data;
      try {
        data = JSON.parse(rawData);
      } catch (parseError) {
        console.error("Failed to parse Directus response:", parseError, "Raw data:", rawData);
        data = { data: null, errors: [] };
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
      (data as any).data = { ...item, client_id: clientId };
      
      // Логируем данные для диагностики
      console.log("[DEBUG] Profile API response:", {
        id: item?.id,
        hasHtml: !!(item?.html),
        hasRawJson: !!item?.raw_json,
        rawJsonType: typeof item?.raw_json,
        rawJsonLength: item?.raw_json ? (typeof item?.raw_json === 'string' ? item?.raw_json.length : JSON.stringify(item?.raw_json).length) : 0,
        hasDigits: !!item?.digits,
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
  
  // Если ошибка сети, возвращаем null
  if (!r.ok && !data?.data) {
    console.error("[DEBUG] Directus error response:", {
      status: r.status,
      statusText: r.statusText,
      data: data,
      errors: (data as any)?.errors
    });
    return NextResponse.json({ data: null }, { status: 200 });
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
