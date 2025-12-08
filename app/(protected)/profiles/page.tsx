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
      cache: 'no-store',
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
    const { status, data } = await fetchJson(`/api/clients?filter[id][_in]=${ids}&fields=id,name,birth_date&limit=1000`, { 
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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold">Расчёты</h1>
        <ClientSearchButton />
      </div>

      <div className="card bg-gradient-to-br from-white to-gray-50 border border-gray-200">
        <form className="flex flex-col sm:flex-row gap-3" action="/profiles" method="get">
          <div className="flex-1">
            <label className="block text-sm mb-1 font-medium text-gray-700">Поиск по имени или дате рождения</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input 
                name="search" 
                defaultValue={(searchParams.search as string) || ""} 
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 text-base transition-all duration-200 bg-white" 
                placeholder="Имя, фамилия или дата..." 
              />
            </div>
          </div>
          <div className="flex gap-2 sm:flex-col sm:justify-end">
            <button type="submit" className="flex-1 sm:flex-none rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 text-white px-4 py-3 h-[42px] text-sm md:text-base whitespace-nowrap hover:from-gray-800 hover:to-gray-700 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 font-semibold">Искать</button>
            {(searchParams.search as string) && (
              <Link href="/profiles" className="flex-1 sm:flex-none rounded-xl border border-gray-300 px-4 py-3 h-[42px] flex items-center justify-center hover:bg-gray-50 text-sm md:text-base whitespace-nowrap transition-all duration-200 hover:shadow-md font-semibold">
                Сбросить
              </Link>
            )}
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.length === 0 && <div className="col-span-full card">Нет данных</div>}
        {profiles.map((p:any) => {
          // Определяем тип расчета из raw_json
          let consultationType = "Базовый";
          try {
            let payload: any = p.raw_json;
            if (typeof payload === "string") payload = JSON.parse(payload);
            const item = Array.isArray(payload) ? payload[0] : payload;
            if (item) {
              if (item.compatibility || item.firstParticipantCodes || item.secondParticipantCodes || 
                  item.partnerCodes || 
                  (item.currentDiagnostics && (item.currentDiagnostics.firstParticipant || item.currentDiagnostics.secondParticipant))) {
                consultationType = "Партнерский";
              } else if ((item.goalDecomposition || item.warnings || item.plan123 || item.request) && 
                         !item.opener && !item.personalitySummary) {
                consultationType = "Целевой";
              }
            }
          } catch {}
          
          const client = p.client_id ? clientsMap[p.client_id] : null;
          const clientName = client?.name || (p.client_id ? `Клиент #${p.client_id}` : "Без клиента");
          const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString("ru-RU") : "";
          const birthDateStr = client?.birth_date ? new Date(client.birth_date).toLocaleDateString("ru-RU") : null;
          
          return (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300 hover:border-blue-400 relative group bg-gradient-to-br from-white to-gray-50">
              <Link href={`/profiles/${p.id}`} className="block space-y-3">
                <div className="font-semibold text-lg text-gray-900 break-words group-hover:text-blue-700 transition-colors">{clientName}</div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Дата расчета: {dateStr}</span>
                  </div>
                  {birthDateStr && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Дата рождения: {birthDateStr}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-100 to-blue-50 text-blue-800 border border-blue-200">
                    {consultationType}
                  </span>
                </div>
              </Link>
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <DeleteProfile id={p.id} />
              </div>
            </div>
          );
        })}
      </div>

      {(hasPrev || hasNext) && (
        <div className="flex items-center gap-2">
          {hasPrev && <Link href={`/profiles?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).map(([k,v])=>[k,String(v||"")])) as any, page: String(page-1), limit: String(limit) }).toString()}`} className="px-3 py-1 rounded-lg border">Назад</Link>}
          <div className="text-sm text-gray-500">Стр. {page}{total ? ` · всего ${total}` : ""}</div>
          {hasNext && <Link href={`/profiles?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).map(([k,v])=>[k,String(v||"")])) as any, page: String(page+1), limit: String(limit) }).toString()}`} className="px-3 py-1 rounded-lg border">Вперёд</Link>}
        </div>
      )}
    </div>
  );
}
