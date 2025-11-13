import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

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
  const baseUrl = getDirectusUrl();
  
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

  const incomingParams = req.nextUrl.searchParams;
  const searchTerm = (incomingParams.get("search") || "").toString().trim();
  const page = Math.max(parseInt(incomingParams.get("page") || "1", 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(incomingParams.get("limit") || "20", 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  let sp = new URLSearchParams();
  incomingParams.forEach((value, key) => {
    if (key === "page" || key === "limit" || key === "offset" || key === "meta" || key === "search") {
      return;
    }
    sp.append(key, value);
  });

  sp.set("limit", String(limit));
  sp.set("offset", String(offset));
  if (!sp.has("meta")) sp.set("meta", "filter_count");
  if (!sp.has("fields")) {
    sp.set("fields", "id,name,birth_date,email,phone,source,communication_method,created_at");
  }
  if (!sp.has("sort")) sp.set("sort", "-created_at");

  const hasExplicitFilter = Array.from(sp.keys()).some((k) => k.startsWith("filter["));
  if (!hasExplicitFilter && currentUserId) {
    sp.set("filter[owner_user][_eq]", currentUserId);
  }

  // Если есть поиск, делаем два запроса и объединяем результаты
  let allClientIds = new Set<number>();
  let finalData: any = null;
  
  if (searchTerm) {
    // Пробуем преобразовать поисковый запрос в формат даты
    let dateFormats: string[] = [];
    
    // Формат ДД.ММ.ГГГГ -> YYYY-MM-DD
    const ddmmyyyy = searchTerm.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (ddmmyyyy) {
      const [, dd, mm, yyyy] = ddmmyyyy;
      dateFormats.push(`${yyyy}-${mm}-${dd}`);
    }
    
    // Формат ДД-ММ-ГГГГ -> YYYY-MM-DD
    const ddmmyyyyDash = searchTerm.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyyDash) {
      const [, dd, mm, yyyy] = ddmmyyyyDash;
      dateFormats.push(`${yyyy}-${mm}-${dd}`);
    }
    
    // Формат YYYY-MM-DD (уже правильный)
    if (/^\d{4}-\d{2}-\d{2}$/.test(searchTerm)) {
      dateFormats.push(searchTerm);
    }
    
    // Формат ГГГГ (год)
    let yearFilter: { start?: string; end?: string } = {};
    if (/^\d{4}$/.test(searchTerm) && !ddmmyyyy && !ddmmyyyyDash) {
      yearFilter.start = `${searchTerm}-01-01`;
      yearFilter.end = `${searchTerm}-12-31`;
    }
    
    // 1. Поиск по имени, email, телефону
    const nameSearchParams = new URLSearchParams(sp);
    nameSearchParams.set("filter[_or][0][name][_icontains]", searchTerm);
    nameSearchParams.set("filter[_or][1][email][_icontains]", searchTerm);
    nameSearchParams.set("filter[_or][2][phone][_icontains]", searchTerm);
    nameSearchParams.delete("search"); // Убираем общий search параметр
    nameSearchParams.set("limit", "1000"); // Получаем все результаты для объединения
    nameSearchParams.set("offset", "0");
    // Сохраняем фильтр owner_user если был
    if (currentUserId && !hasExplicitFilter) {
      nameSearchParams.set("filter[owner_user][_eq]", currentUserId);
    }
    
    const nameUrl = `${baseUrl}/items/clients?${nameSearchParams.toString()}`;
    try {
      const nameRes = await fetch(nameUrl, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
      if (nameRes.ok) {
        const nameData = await nameRes.json().catch(() => ({ data: [] }));
        (nameData?.data || []).forEach((c: any) => {
          if (c.id) allClientIds.add(c.id);
        });
      }
    } catch (error) {
      console.error("Error searching clients by name:", error);
    }
    
    // 2. Поиск по дате рождения (если поисковый запрос похож на дату)
    if (dateFormats.length > 0) {
      for (const dateFormat of dateFormats) {
        const dateSearchParams = new URLSearchParams(sp);
        dateSearchParams.set("filter[birth_date][_eq]", dateFormat);
        dateSearchParams.delete("search");
        dateSearchParams.delete("filter[_or][0][name][_icontains]");
        dateSearchParams.delete("filter[_or][1][email][_icontains]");
        dateSearchParams.delete("filter[_or][2][phone][_icontains]");
        dateSearchParams.set("limit", "1000");
        dateSearchParams.set("offset", "0");
        // Сохраняем фильтр owner_user если был
        if (currentUserId && !hasExplicitFilter) {
          dateSearchParams.set("filter[owner_user][_eq]", currentUserId);
        }
        
        const dateUrl = `${baseUrl}/items/clients?${dateSearchParams.toString()}`;
        try {
          const dateRes = await fetch(dateUrl, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            cache: "no-store",
          });
          if (dateRes.ok) {
            const dateData = await dateRes.json().catch(() => ({ data: [] }));
            (dateData?.data || []).forEach((c: any) => {
              if (c.id) allClientIds.add(c.id);
            });
          }
        } catch (error) {
          console.error("Error searching clients by date:", error);
        }
      }
    }
    
    // 3. Поиск по году (диапазон дат)
    if (yearFilter.start && yearFilter.end) {
      const yearSearchParams = new URLSearchParams(sp);
      yearSearchParams.set("filter[birth_date][_gte]", yearFilter.start);
      yearSearchParams.set("filter[birth_date][_lte]", yearFilter.end);
      yearSearchParams.delete("search");
      yearSearchParams.delete("filter[_or][0][name][_icontains]");
      yearSearchParams.delete("filter[_or][1][email][_icontains]");
      yearSearchParams.delete("filter[_or][2][phone][_icontains]");
      yearSearchParams.set("limit", "1000");
      yearSearchParams.set("offset", "0");
      // Сохраняем фильтр owner_user если был
      if (currentUserId && !hasExplicitFilter) {
        yearSearchParams.set("filter[owner_user][_eq]", currentUserId);
      }
      
      const yearUrl = `${baseUrl}/items/clients?${yearSearchParams.toString()}`;
      try {
        const yearRes = await fetch(yearUrl, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          cache: "no-store",
        });
        if (yearRes.ok) {
          const yearData = await yearRes.json().catch(() => ({ data: [] }));
          (yearData?.data || []).forEach((c: any) => {
            if (c.id) allClientIds.add(c.id);
          });
        }
      } catch (error) {
        console.error("Error searching clients by year:", error);
      }
    }
    
    // Если нашли клиентов, делаем финальный запрос с фильтром по ID
    if (allClientIds.size > 0) {
      const clientIdsArray = Array.from(allClientIds);
      // Создаем новый URLSearchParams с базовыми параметрами
      const finalSearchParams = new URLSearchParams();
      finalSearchParams.set("limit", String(limit));
      finalSearchParams.set("offset", String(offset));
      finalSearchParams.set("meta", "filter_count");
      if (sp.has("fields")) finalSearchParams.set("fields", sp.get("fields")!);
      if (sp.has("sort")) finalSearchParams.set("sort", sp.get("sort")!);
      // Сохраняем фильтр owner_user если был
      if (currentUserId && !hasExplicitFilter) {
        finalSearchParams.set("filter[owner_user][_eq]", currentUserId);
      }
      
      if (clientIdsArray.length === 1) {
        finalSearchParams.set("filter[id][_eq]", String(clientIdsArray[0]));
      } else {
        finalSearchParams.set("filter[id][_in]", clientIdsArray.join(','));
      }
      
      // Переопределяем sp для финального запроса
      sp = finalSearchParams;
    } else {
      // Если ничего не найдено, возвращаем пустой результат
      return NextResponse.json({ data: [], meta: { filter_count: 0 } }, { status: 200 });
    }
  }

  const url = `${baseUrl}/items/clients?${sp.toString()}`;
  console.log("Getting clients - Directus URL:", url);

  async function fetchList(accessToken: string) {
    try {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        cache: "no-store",
      });
      const data = await r.json().catch(() => ({ data: [], meta: {}, errors: [] }));
      return { r, data } as const;
    } catch (error) {
      console.error("Error fetching from Directus:", error);
      return { 
        r: new Response(null, { status: 500 }), 
        data: { data: [], meta: { filter_count: 0 }, errors: [{ message: String(error) }] } 
      } as const;
    }
  }

  let { r, data } = await fetchList(token);

  // Автообновление токена при истёкшей сессии
  if (r.status === 401 && data?.errors?.[0]?.message === "Token expired.") {
    const origin = req.nextUrl.origin;
    const refreshRes = await fetch(`${origin}/api/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (refreshRes.ok) {
      const refreshData = await refreshRes.json().catch(() => ({}));
      // Используем токен из ответа, а не из cookies
      const newToken = refreshData?.access_token || cookies().get("directus_access_token")?.value;
      if (newToken) {
        ({ r, data } = await fetchList(newToken));
      }
    }
  }

  console.log("Getting clients - Directus response status:", r.status);
  console.log("Getting clients - Directus response data:", data);

  // Обработка различных статусов
  if (r.status === 404) {
    return NextResponse.json({ data: [], meta: { filter_count: 0 }, upstreamStatus: 404 });
  }
  
  // Если ошибка, но есть данные - возвращаем пустой массив
  if (!r.ok && (!data || !data.data)) {
    console.error("Directus error response:", data);
    return NextResponse.json({ data: [], meta: { filter_count: 0 } }, { status: 200 });
  }
  
  return NextResponse.json(data, { status: r.ok ? 200 : r.status });
}

export async function POST(req: NextRequest) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  
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
      const origin = req.nextUrl.origin;
      const refreshRes = await fetch(`${origin}/api/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (refreshRes.ok) {
        console.log("Creating client - Token refreshed, retrying...");
        
        // Получим новый токен из ответа
        const refreshData = await refreshRes.json().catch(() => ({}));
        const newToken = refreshData?.access_token || cookies().get("directus_access_token")?.value;
        
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