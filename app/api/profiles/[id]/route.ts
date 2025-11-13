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
      console.log("Fetching profile from Directus:", urlWithFields);
      const r = await fetch(urlWithFields, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        cache: "no-store",
      });
      const rawData = await r.text();
      console.log("Directus raw response status:", r.status);
      console.log("Directus raw response (first 500 chars):", rawData.substring(0, 500));
      
      let data;
      try {
        data = JSON.parse(rawData);
      } catch (parseError) {
        console.error("Failed to parse Directus response:", parseError, "Raw data:", rawData);
        data = { data: null, errors: [] };
      }
      
      return { r, data } as const;
    } catch (error) {
      console.error("Error fetching profile from Directus:", error);
      return { 
        r: new Response(null, { status: 500 }), 
        data: { data: null, errors: [{ message: String(error) }] } 
      } as const;
    }
  }

  let { r, data } = await fetchProfile(token);

  if (r.status === 401 && data?.errors?.[0]?.message === "Token expired.") {
    // попробуем освежить токен
    const origin = new URL(req.url).origin;
    try {
      console.log("Attempting to refresh token, origin:", origin);
      const refreshRes = await fetch(`${origin}/api/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Увеличиваем таймаут для refresh запроса
        signal: AbortSignal.timeout(10000), // 10 секунд
      });
      
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json().catch(() => ({}));
        // Используем токен из ответа, а не из cookies
        const newToken = refreshData?.access_token || cookies().get("directus_access_token")?.value;
        if (newToken) {
          console.log("Token refreshed successfully, retrying profile fetch");
          ({ r, data } = await fetchProfile(newToken));
        } else {
          console.warn("Token refresh returned no access_token");
        }
      } else {
        const refreshErrorData = await refreshRes.json().catch(() => ({}));
        console.error("Token refresh failed:", refreshRes.status, refreshErrorData);
      }
    } catch (refreshError: any) {
      console.error("Error refreshing token:", {
        message: refreshError?.message,
        code: refreshError?.code,
        cause: refreshError?.cause,
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
      console.log("Profile API response:", {
        id: item?.id,
        hasHtml: !!(item?.html),
        hasRawJson: !!item?.raw_json,
        rawJsonType: typeof item?.raw_json,
        rawJsonLength: item?.raw_json ? (typeof item?.raw_json === 'string' ? item?.raw_json.length : JSON.stringify(item?.raw_json).length) : 0,
        hasDigits: !!item?.digits,
        fields: Object.keys(item || {})
      });
    }
  } catch {}
  
  // Если ошибка сети, возвращаем null
  if (!r.ok && !data?.data) {
    console.error("Directus error response:", data);
    return NextResponse.json({ data: null }, { status: 200 });
  }
  
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
