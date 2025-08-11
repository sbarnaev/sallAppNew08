import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Функция для получения текущего пользователя
async function getCurrentUser(token: string, baseUrl: string) {
  try {
    console.log("Getting current user - URL:", `${baseUrl}/users/me`);
    console.log("Getting current user - Token:", token ? "Present" : "Missing");
    
    const response = await fetch(`${baseUrl}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });
    
    console.log("Getting current user - Response status:", response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log("Getting current user - Response data:", data);
      return data?.data;
    }
    
    const errorData = await response.json().catch(() => ({}));
    console.log("Getting current user - Error response:", errorData);
    return null;
  } catch (error) {
    console.log("Getting current user - Fetch error:", error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = process.env.DIRECTUS_URL;
  
  console.log("Getting clients - Token:", token ? "Present" : "Missing");
  console.log("Getting clients - Base URL:", baseUrl);
  
  if (!token || !baseUrl) {
    console.log("Getting clients - Unauthorized: no token or base URL");
    return NextResponse.json({ data: [], message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });
  }

  // Пытаемся получить текущего пользователя (если не получится — не фильтруем, дадим отработать правам Directus)
  let currentUserId: string | null = null;
  try {
    const meRes = await fetch(`${baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (meRes.ok) {
      const meData = await meRes.json().catch(() => ({}));
      currentUserId = meData?.data?.id || null;
    }
    console.log("Getting clients - Resolved currentUserId:", currentUserId);
  } catch {
    console.log("Getting clients - Could not resolve current user id, proceeding without explicit filter");
  }

  const sp = new URLSearchParams(req.nextUrl.searchParams as any);
  // Безопасные поля, на которые точно есть права
  if (!sp.has("fields")) {
    sp.set("fields", "id,name,birth_date,email,phone,source,communication_method,created_at");
  }
  // Добавим фильтр по владельцу, если знаем id пользователя и фильтры не заданы явно
  const hasAnyFilter = Array.from(sp.keys()).some((k) => k.startsWith("filter["));
  if (!hasAnyFilter && currentUserId) {
    sp.set("filter[owner_user][_eq]", currentUserId);
  }
  if (!sp.has("sort")) sp.set("sort", "-created_at");
  if (!sp.has("limit")) sp.set("limit", "20");
  if (!sp.has("offset")) sp.set("offset", "0");
  if (!sp.has("meta")) sp.set("meta", "filter_count");

  const url = `${baseUrl}/items/clients?${sp.toString()}`;
  console.log("Getting clients - Directus URL:", url);

  async function fetchList(accessToken: string) {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({ data: [], meta: {} }));
    return { r, data } as const;
  }

  let { r, data } = await fetchList(token);

  // Автообновление токена при истёкшей сессии
  if (r.status === 401 && data?.errors?.[0]?.message === "Token expired.") {
    const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (refreshRes.ok) {
      const newToken = cookies().get("directus_access_token")?.value;
      if (newToken) {
        ({ r, data } = await fetchList(newToken));
      }
    }
  }

  console.log("Getting clients - Directus response status:", r.status);
  console.log("Getting clients - Directus response data:", data);

  if (r.status === 404) {
    return NextResponse.json({ data: [], meta: { filter_count: 0 }, upstreamStatus: 404 });
  }
  return NextResponse.json(data, { status: r.status });
}

export async function POST(req: NextRequest) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = process.env.DIRECTUS_URL;
  
  console.log("Creating client - Token:", token ? "Present" : "Missing");
  console.log("Creating client - Base URL:", baseUrl);
  
  if (!token || !baseUrl) {
    console.log("Creating client - Unauthorized: no token or base URL");
    return NextResponse.json({ message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });
  }

  const body = await req.json();
  console.log("Creating client - Request body:", body);
  
  // Валидация обязательных полей
  if (!body.first_name?.trim()) {
    console.log("Creating client - Validation error: missing first_name");
    return NextResponse.json({ message: "Имя обязательно для заполнения" }, { status: 400 });
  }
  if (!body.last_name?.trim()) {
    console.log("Creating client - Validation error: missing last_name");
    return NextResponse.json({ message: "Фамилия обязательна для заполнения" }, { status: 400 });
  }

  // Получаем текущего пользователя
  const currentUser = await getCurrentUser(token, baseUrl);
  console.log("Creating client - Current user:", currentUser);
  console.log("Creating client - Current user ID:", currentUser?.id);
  
  if (!currentUser?.id) {
    console.log("Creating client - Error: could not get current user ID");
    return NextResponse.json({ message: "Ошибка получения данных пользователя" }, { status: 500 });
  }

  // Подготовка данных для отправки в Directus
  const clientData = {
    name: `${body.first_name.trim()} ${body.last_name.trim()}`.trim(),
    birth_date: body.birth_date || null,
    phone: body.phone?.trim() || null,
    email: body.email?.trim() || null,
    source: body.source?.trim() || null,
    communication_method: body.communication_method?.trim() || null,
    notes: body.notes?.trim?.() || body.notes || null,
    owner_user: currentUser.id,
  };

  console.log("Creating client - Prepared data:", clientData);
  console.log("Creating client - Owner user being set:", currentUser.id);

  const url = `${baseUrl}/items/clients`;
  console.log("Creating client - Directus URL:", url);
  
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${token}`, 
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(clientData),
    });
    
    console.log("Creating client - Directus response status:", r.status);
    
    const data = await r.json().catch(()=>({}));
    console.log("Creating client - Directus response data:", data);
    console.log("Creating client - Created client fields:", data?.data);
    
    // Логируем ошибки более детально
    if (!r.ok) {
      console.log("Creating client - Error details:", {
        status: r.status,
        statusText: r.statusText,
        data: data,
        errors: data?.errors,
        message: data?.message
      });
    }
    
    // Если токен истек, попробуем обновить его
    if (r.status === 401 && data?.errors?.[0]?.message === "Token expired.") {
      console.log("Creating client - Token expired, attempting refresh...");
      
      // Попробуем обновить токен
      const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (refreshRes.ok) {
        console.log("Creating client - Token refreshed, retrying...");
        
        // Получим новый токен
        const newToken = cookies().get("directus_access_token")?.value;
        
        if (newToken) {
          // Повторим запрос с новым токеном
          const retryRes = await fetch(url, {
            method: "POST",
            headers: { 
              Authorization: `Bearer ${newToken}`, 
              "Content-Type": "application/json",
              Accept: "application/json"
            },
            body: JSON.stringify(clientData),
          });
          
          const retryData = await retryRes.json().catch(()=>({}));
          console.log("Creating client - Retry response status:", retryRes.status);
          console.log("Creating client - Retry response data:", retryData);
          
          return NextResponse.json(retryData, { status: retryRes.status });
        }
      }
    }
    
    return NextResponse.json(data, { status: r.status });
  } catch (error) {
    console.log("Creating client - Fetch error:", error);
    return NextResponse.json({ message: "Ошибка соединения с Directus", error: String(error) }, { status: 502 });
  }
} 