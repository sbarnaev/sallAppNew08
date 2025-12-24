import Link from "next/link";
import { fetchJson } from "@/lib/fetchers";
import nextDynamic from "next/dynamic";

export const dynamic = "force-dynamic";

const ClientSearchButton = nextDynamic(() => import("./ClientSearchButton").then(mod => ({ default: mod.ClientSearchButton })), {
  ssr: false
});

const DeleteProfile = nextDynamic(() => import("./DeleteProfile").then(mod => ({ default: mod.default })), {
  ssr: false
});

async function getProfiles(searchParams: Record<string, string | string[] | undefined>) {
  try {
    const params = new URLSearchParams();
    const q = (searchParams.search as string) || "";
    const clientId = (searchParams["filter[client_id][_eq]"] as string) || "";
    const page = Number(searchParams.page || 1);
    const limit = Number(searchParams.limit || 20);
    const offset = (page - 1) * limit;
    if (q) params.set("search", q);
    if (clientId) params.set("filter[client_id][_eq]", clientId);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    params.set("meta", "filter_count");

    const { status, data } = await fetchJson(`/api/profiles?${params.toString()}`, { 
      next: { revalidate: 10 },
      signal: AbortSignal.timeout(10000), // 10 секунд таймаут
    });
    
    if (status === 401 || status === 404 || !data) {
      console.error("API error:", status, data);
      return { data: [], meta: { filter_count: 0 } };
    }
    
    // Проверяем структуру данных
    if (!data || typeof data !== 'object') {
      console.error("Invalid data structure from API:", data);
      return { data: [], meta: { filter_count: 0 } };
    }
    
    return {
      data: Array.isArray(data.data) ? data.data : [],
      meta: data.meta || { filter_count: 0 }
    };
  } catch (error: any) {
    console.error("Error in getProfiles:", error?.message || error);
    // Возвращаем пустые данные вместо выброса ошибки
    return { data: [], meta: { filter_count: 0 } };
  }
}

async function getClientsMap(clientIds: number[]) {
  if (clientIds.length === 0) return {};
  try {
    const ids = clientIds.join(',');
    const { status, data } = await fetchJson(`/api/clients?filter[id][_in]=${ids}&fields=id,name,birth_date&limit=100`, { 
      cache: 'no-store',
      signal: AbortSignal.timeout(10000), // 10 секунд таймаут
    });
    if (status === 200 && data?.data && Array.isArray(data.data)) {
      const map: Record<number, { name: string; birth_date?: string }> = {};
      (data.data as any[]).forEach((c: any) => {
        if (c && c.id) {
          map[c.id] = { 
            name: c.name || '', 
            birth_date: c.birth_date || undefined 
          };
        }
      });
      return map;
    }
  } catch (error: any) {
    console.error("Error fetching clients:", error?.message || error);
    // Возвращаем пустой объект вместо выброса ошибки
  }
  return {};
}

export default async function ProfilesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined>}) {
  let profiles: any[] = [];
  let meta: any = {};
  
  try {
    const result = await getProfiles(searchParams);
    profiles = Array.isArray(result?.data) ? result.data : [];
    meta = result?.meta || { filter_count: 0 };
  } catch (error: any) {
    console.error("Error fetching profiles:", error?.message || error);
    // Продолжаем с пустыми данными
    profiles = [];
    meta = { filter_count: 0 };
  }
  
  // Загружаем данные клиентов отдельно
  const clientIds = profiles
    .map(p => p?.client_id)
    .filter((id): id is number => typeof id === 'number' && id > 0);
  
  let clientsMap: Record<number, { name: string; birth_date?: string }> = {};
  try {
    clientsMap = await getClientsMap(clientIds);
  } catch (error: any) {
    console.error("Error loading clients map:", error?.message || error);
    // Продолжаем с пустым маппингом
  }
  
  const page = Number(searchParams.page || 1);
  const limit = Number(searchParams.limit || 20);
  const total = (meta as any)?.filter_count ?? 0;
  const hasNext = page * limit < total;
  const hasPrev = page > 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="page-title">Расчёты</h1>
        <div className="flex">
          <ClientSearchButton />
        </div>
      </div>

      <div className="surface-muted">
        <form className="flex flex-col sm:flex-row gap-4" action="/profiles" method="get">
        <div className="flex-1">
            <label className="block text-sm mb-2 font-bold text-gray-700">Поиск по имени или дате рождения</label>
            <div className="relative">
              <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
          <input 
            name="search" 
            defaultValue={(searchParams.search as string) || ""} 
                className="w-full pl-12 pr-5 py-4" 
            placeholder="Имя, фамилия или дата..." 
          />
        </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="submit" className="btn btn-neutral w-full sm:w-auto">Искать</button>
          {(searchParams.search as string) && (
              <Link href="/profiles" className="btn btn-secondary w-full sm:w-auto">
              Сбросить
            </Link>
          )}
        </div>
      </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.length === 0 && (
          <div className="col-span-full card text-center py-16 bg-gradient-to-br from-white via-gray-50/50 to-white">
            <p className="text-lg font-bold text-gray-900">Нет данных</p>
          </div>
        )}
        {profiles.map((p:any) => {
          // Определяем тип расчета из target_json или raw_json и извлекаем запрос
          let consultationType = "Базовый";
          let requestText = "";
          
          // Сначала проверяем target_json (новый формат)
          try {
            const targetJson = p.target_json;
            if (targetJson) {
              let parsed: any;
              try {
                parsed = typeof targetJson === 'string' ? JSON.parse(targetJson) : targetJson;
              } catch {
                parsed = null;
              }
              
              if (parsed) {
                if (parsed.type === "target") {
                  consultationType = "Целевой";
                  // Формируем текст запроса из всех полей
                  const parts: string[] = [];
                  if (parsed.current) parts.push(`Что есть сейчас: ${parsed.current}`);
                  if (parsed.want) parts.push(`Что клиент хочет: ${parsed.want}`);
                  if (parsed.additional) parts.push(`Дополнительно: ${parsed.additional}`);
                  requestText = parts.join(" ");
                } else if (parsed.type === "partner") {
                  consultationType = "Партнерский";
                  if (parsed.goal) {
                    requestText = parsed.goal;
                  }
                } else if (parsed.type === "child") {
                  consultationType = "Детский";
                  if (parsed.request) {
                    requestText = parsed.request;
                  }
                }
              }
            }
          } catch {}
          
          // Если не нашли в target_json, проверяем raw_json (старый формат)
          if (!requestText) {
            try {
              let payload: any = p.raw_json;
              if (typeof payload === "string") payload = JSON.parse(payload);
              const item = Array.isArray(payload) ? payload[0] : payload;
              if (item) {
                if (item.compatibility || item.firstParticipantCodes || item.secondParticipantCodes || 
                    item.partnerCodes || 
                    (item.currentDiagnostics && (item.currentDiagnostics.firstParticipant || item.currentDiagnostics.secondParticipant))) {
                  consultationType = "Партнерский";
                  // Для партнерского - берем goal
                  if (item.goal && typeof item.goal === "string") {
                    requestText = item.goal;
                  }
                } else if ((item.goalDecomposition || item.warnings || item.plan123 || item.request) && 
                           !item.opener && !item.personalitySummary) {
                  consultationType = "Целевой";
                  // Для целевого - берем request
                  if (item.request && typeof item.request === "string") {
                    requestText = item.request;
                  }
                } else if (item.childPotential || item.upbringingRecommendations || item.developmentFeatures) {
                  consultationType = "Детский";
                  // Для детского - берем request (если есть)
                  if (item.request && typeof item.request === "string") {
                    requestText = item.request;
                  }
                }
              }
            } catch {}
          }
          
          const client = p.client_id ? clientsMap[p.client_id] : null;
          const clientName = client?.name || (p.client_id ? `Клиент #${p.client_id}` : "Без клиента");
          const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString("ru-RU") : "";
          const birthDateStr = client?.birth_date ? new Date(client.birth_date).toLocaleDateString("ru-RU") : null;
          
          // Обрезаем запрос, если слишком длинный
          const displayRequest = requestText ? (requestText.length > 100 ? requestText.substring(0, 100) + "..." : requestText) : "";
          
          return (
            <div key={p.id} className="card p-5 hover:shadow-md transition-all duration-200 border border-gray-200 relative group">
              <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <DeleteProfile id={p.id} />
              </div>
              <Link href={`/profiles/${p.id}`} className="block space-y-3 pr-20">
                <div className="font-bold text-base text-gray-900 break-words group-hover:text-brand-600 transition-colors leading-tight">{clientName}</div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-gray-600">Дата расчета: {dateStr}</span>
                  </div>
                  {birthDateStr && (
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-gray-600">Дата рождения: {birthDateStr}</span>
                    </div>
                  )}
                  {displayRequest && (
                    <div className="flex items-start gap-2.5 pt-1">
                      <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-gray-700 italic text-xs leading-relaxed">{displayRequest}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    {consultationType}
                  </span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {(hasPrev || hasNext) && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {hasPrev && (
              <Link 
                href={`/profiles?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).map(([k,v])=>[k,String(v||"")])) as any, page: String(page-1), limit: String(limit) }).toString()}`} 
                className="btn btn-secondary flex-1 sm:flex-none"
              >
                Назад
              </Link>
            )}
            {hasNext && (
              <Link 
                href={`/profiles?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).map(([k,v])=>[k,String(v||"")])) as any, page: String(page+1), limit: String(limit) }).toString()}`} 
                className="btn btn-secondary flex-1 sm:flex-none"
              >
                Вперёд
              </Link>
            )}
          </div>
          <div className="text-sm text-gray-600 font-medium text-center sm:text-left">
            Стр. <span className="font-bold text-gray-900">{page}</span>{total ? ` · всего <span className="font-bold text-gray-900">${total}</span>` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
