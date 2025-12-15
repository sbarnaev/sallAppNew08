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
    <div className="space-y-8 md:space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <h1 className="page-title">Расчёты</h1>
        <ClientSearchButton />
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
          <div className="flex gap-3 sm:flex-col sm:justify-end">
            <button type="submit" className="btn btn-neutral flex-1 sm:flex-none">Искать</button>
          {(searchParams.search as string) && (
              <Link href="/profiles" className="btn btn-secondary flex-1 sm:flex-none">
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
            <div key={p.id} className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm hover:shadow-soft-lg hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300 hover:border-blue-300 relative group bg-gradient-to-br from-white via-gray-50/30 to-white">
              <Link href={`/profiles/${p.id}`} className="block space-y-4">
                <div className="font-bold text-lg text-gray-900 break-words group-hover:text-blue-700 transition-colors leading-tight">{clientName}</div>
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
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-blue-100 to-blue-50 text-blue-800 border border-blue-200/60">
                    {consultationType}
                  </span>
                </div>
              </Link>
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <DeleteProfile id={p.id} />
              </div>
            </div>
          );
        })}
      </div>

      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between gap-6 pt-4">
          <div className="flex items-center gap-3">
            {hasPrev && (
              <Link 
                href={`/profiles?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).map(([k,v])=>[k,String(v||"")])) as any, page: String(page-1), limit: String(limit) }).toString()}`} 
                className="px-5 py-2.5 rounded-xl border border-gray-300/80 hover:bg-gray-50 hover:border-gray-400 text-sm font-bold transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Назад
              </Link>
            )}
            {hasNext && (
              <Link 
                href={`/profiles?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).map(([k,v])=>[k,String(v||"")])) as any, page: String(page+1), limit: String(limit) }).toString()}`} 
                className="px-5 py-2.5 rounded-xl border border-gray-300/80 hover:bg-gray-50 hover:border-gray-400 text-sm font-bold transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Вперёд
              </Link>
            )}
          </div>
          <div className="text-sm text-gray-600 font-medium">
            Стр. <span className="font-bold text-gray-900">{page}</span>{total ? ` · всего <span className="font-bold text-gray-900">${total}</span>` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
