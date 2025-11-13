import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) return NextResponse.json({ data: [] }, { status: 401 });

  const incomingParams = req.nextUrl.searchParams;
  const searchTerm = (incomingParams.get("search") || "").toString().trim();
  
  // Если есть поиск, сначала находим клиентов
  let clientIds: number[] = [];
  if (searchTerm) {
    try {
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
      
      // Формат ГГГГ (год) - ищем записи в этом году
      let yearFilter: { start?: string; end?: string } = {};
      if (/^\d{4}$/.test(searchTerm)) {
        yearFilter.start = `${searchTerm}-01-01`;
        yearFilter.end = `${searchTerm}-12-31`;
      }
      
      // Собираем все найденные ID клиентов
      const foundIds = new Set<number>();
      
      // Поиск по имени (ищет и по имени и по фамилии, так как они в одном поле)
      const nameSearchParams = new URLSearchParams();
      nameSearchParams.set("filter[name][_icontains]", searchTerm);
      nameSearchParams.set("fields", "id");
      nameSearchParams.set("limit", "1000");
      
      const nameRes = await fetch(`${baseUrl}/items/clients?${nameSearchParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
      
      if (nameRes.ok) {
        const nameData = await nameRes.json().catch(() => ({ data: [] }));
        (nameData?.data || []).forEach((c: any) => {
          if (c.id) foundIds.add(c.id);
        });
      }
      
      // Поиск по дате рождения (если поисковый запрос похож на дату)
      if (dateFormats.length > 0 || yearFilter.start) {
        for (const dateFormat of dateFormats) {
          const dateSearchParams = new URLSearchParams();
          dateSearchParams.set("filter[birth_date][_eq]", dateFormat);
          dateSearchParams.set("fields", "id");
          dateSearchParams.set("limit", "1000");
          
          const dateRes = await fetch(`${baseUrl}/items/clients?${dateSearchParams.toString()}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            cache: "no-store",
          });
          
          if (dateRes.ok) {
            const dateData = await dateRes.json().catch(() => ({ data: [] }));
            (dateData?.data || []).forEach((c: any) => {
              if (c.id) foundIds.add(c.id);
            });
          }
        }
        
        // Поиск по году (диапазон дат)
        if (yearFilter.start && yearFilter.end) {
          const yearSearchParams = new URLSearchParams();
          yearSearchParams.set("filter[birth_date][_gte]", yearFilter.start);
          yearSearchParams.set("filter[birth_date][_lte]", yearFilter.end);
          yearSearchParams.set("fields", "id");
          yearSearchParams.set("limit", "1000");
          
          const yearRes = await fetch(`${baseUrl}/items/clients?${yearSearchParams.toString()}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            cache: "no-store",
          });
          
          if (yearRes.ok) {
            const yearData = await yearRes.json().catch(() => ({ data: [] }));
            (yearData?.data || []).forEach((c: any) => {
              if (c.id) foundIds.add(c.id);
            });
          }
        }
      }
      
      clientIds = Array.from(foundIds);
    } catch (error) {
      console.error("Error searching clients:", error);
    }
    
    // Если клиенты не найдены, возвращаем пустой результат
    if (clientIds.length === 0) {
      return NextResponse.json({ data: [], meta: { filter_count: 0 } }, { status: 200 });
    }
  }
  
  const sp = new URLSearchParams();
  // Копируем все параметры кроме search, page, limit, offset, meta
  incomingParams.forEach((value, key) => {
    if (key !== "search" && key !== "page" && key !== "limit" && key !== "offset" && key !== "meta") {
      sp.append(key, value);
    }
  });
  
  if (!sp.has("fields")) sp.set("fields", "id,client_id,created_at,html,raw_json,digits");
  if (!sp.has("limit")) sp.set("limit", "50");
  if (!sp.has("offset")) sp.set("offset", "0");
  if (!sp.has("meta")) sp.set("meta", "filter_count");
  if (!sp.has("sort")) sp.set("sort", "-created_at");
  
  // Если есть найденные client_ids, фильтруем по ним
  if (clientIds.length > 0) {
    if (clientIds.length === 1) {
      sp.set("filter[client_id][_eq]", String(clientIds[0]));
    } else {
      // Для нескольких ID используем _in (правильный синтаксис для Directus)
      sp.set("filter[client_id][_in]", clientIds.join(','));
    }
  }

  // Проверяем, что URL валидный
  if (!baseUrl || !baseUrl.startsWith('http')) {
    console.error("Invalid Directus URL:", baseUrl);
    return NextResponse.json({ data: [], meta: { filter_count: 0 }, message: "Invalid DIRECTUS_URL" }, { status: 500 });
  }

  const url = `${baseUrl}/items/profiles?${sp.toString()}`;
  console.log("Profiles list URL:", url);

  async function fetchList(accessToken: string) {
    try {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        cache: "no-store",
      });
      const data = await r.json().catch(() => ({ data: [], errors: [] }));
      return { r, data } as const;
    } catch (error) {
      console.error("Error fetching profiles from Directus:", error);
      return { 
        r: new Response(null, { status: 500 }), 
        data: { data: [], meta: { filter_count: 0 }, errors: [{ message: String(error) }] } 
      } as const;
    }
  }

  let { r, data } = await fetchList(token);

  if (r.status === 401 && data?.errors?.[0]?.message === "Token expired.") {
    // Используем заголовки для определения правильного origin
    const headersList = req.headers;
    const host = headersList.get("host") || headersList.get("x-forwarded-host") || "localhost:3000";
    const protocol = headersList.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const origin = `${protocol}://${host}`;
    
    try {
      // Передаем cookies вручную, так как fetch из серверного кода не передает их автоматически
      const allCookies = cookies().getAll();
      const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ');
      
      const refreshRes = await fetch(`${origin}/api/refresh`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cookie": cookieHeader
        },
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json().catch(() => ({}));
        // Используем токен из ответа, а не из cookies (cookies обновятся только в следующем запросе)
        const newToken = refreshData?.access_token || cookies().get("directus_access_token")?.value;
        if (newToken) {
          ({ r, data } = await fetchList(newToken));
        }
      }
    } catch (refreshError) {
      console.error("Error refreshing token:", refreshError);
    }
  }

  // Нормализация на всякий случай — только client_id из relation если вдруг есть
  try {
    if (Array.isArray((data as any)?.data)) {
      (data as any).data = (data as any).data.map((item: any) => {
        const clientId = item?.client_id ?? item?.client?.id ?? null;
        return { ...item, client_id: clientId };
      });
    }
  } catch {}

  // Обработка ошибок
  if (r.status === 404) {
    return NextResponse.json({ data: [], meta: { filter_count: 0 }, upstreamStatus: 404 });
  }
  
  // Если ошибка сети или сервера, возвращаем пустой массив
  if (!r.ok && (!data || !data.data)) {
    console.error("Directus error response:", data);
    return NextResponse.json({ data: [], meta: { filter_count: 0 } }, { status: 200 });
  }
  
  return NextResponse.json(data, { status: r.ok ? 200 : r.status });
}

export async function POST(req: NextRequest) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) {
    return NextResponse.json({ message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  
  const payload: any = {};
  if (body.client_id) payload.client_id = Number(body.client_id);
  if (body.digits !== undefined) payload.digits = body.digits;
  if (body.raw_json !== undefined) payload.raw_json = body.raw_json;
  if (body.html !== undefined) payload.html = body.html;
  if (body.images !== undefined) payload.images = body.images;

  // Проверяем, что URL валидный
  if (!baseUrl || !baseUrl.startsWith('http')) {
    console.error("Invalid Directus URL:", baseUrl);
    return NextResponse.json({ message: "Invalid DIRECTUS_URL" }, { status: 500 });
  }

  const url = `${baseUrl}/items/profiles`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (error) {
    console.error("Error creating profile in Directus:", error);
    return NextResponse.json({ message: "Error connecting to Directus", error: String(error) }, { status: 502 });
  }
}
