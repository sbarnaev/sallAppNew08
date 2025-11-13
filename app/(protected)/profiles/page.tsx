import Link from "next/link";
import { fetchJson } from "@/lib/fetchers";

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

    const { status, data } = await fetchJson(`/api/profiles?${params.toString()}`, { cache: 'no-store' });
    if (status === 401 || status === 404 || !data) {
      console.error("API error:", status);
      return { data: [], meta: { filter_count: 0 } };
    }
    return data as any;
  } catch (error) {
    console.error("Error in getProfiles:", error);
    return { data: [], meta: { filter_count: 0 } };
  }
}

async function getClientsMap(clientIds: number[]) {
  if (clientIds.length === 0) return {};
  try {
    const ids = clientIds.join(',');
    const { status, data } = await fetchJson(`/api/clients?filter[id][_in]=${ids}&fields=id,name,birth_date&limit=1000`, { cache: 'no-store' });
    if (status === 200 && data?.data) {
      const map: Record<number, { name: string; birth_date?: string }> = {};
      (data.data as any[]).forEach((c: any) => {
        if (c.id) map[c.id] = { name: c.name || '', birth_date: c.birth_date };
      });
      return map;
    }
  } catch (error) {
    console.error("Error fetching clients:", error);
  }
  return {};
}

export default async function ProfilesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined>}) {
  let profiles: any[] = [];
  let meta: any = {};
  
  try {
    const result = await getProfiles(searchParams);
    profiles = result?.data || [];
    meta = result?.meta || {};
  } catch (error) {
    console.error("Error fetching profiles:", error);
  }
  
  // Загружаем данные клиентов отдельно
  const clientIds = profiles.map(p => p.client_id).filter((id): id is number => !!id);
  const clientsMap = await getClientsMap(clientIds);
  
  const page = Number(searchParams.page || 1);
  const limit = Number(searchParams.limit || 20);
  const total = (meta as any)?.filter_count ?? 0;
  const hasNext = page * limit < total;
  const hasPrev = page > 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Расчёты</h1>
        <Link href="/profiles/new" className="rounded-2xl bg-brand-600 text-white px-4 py-2 hover:bg-brand-700">Новый расчёт</Link>
      </div>

      <form className="flex gap-3 items-end" action="/profiles" method="get">
        <div className="flex-1">
          <label className="block text-sm mb-1">Поиск по имени клиента</label>
          <input 
            name="search" 
            defaultValue={(searchParams.search as string) || ""} 
            className="rounded-xl border p-3 w-full" 
            placeholder="Имя или фамилия клиента..." 
          />
        </div>
        <button type="submit" className="rounded-2xl bg-gray-900 text-white px-4 py-2 h-[42px]">Искать</button>
        {(searchParams.search as string) && (
          <Link href="/profiles" className="rounded-2xl border border-gray-300 px-4 py-2 h-[42px] flex items-center hover:bg-gray-50">
            Сбросить
          </Link>
        )}
      </form>

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
            <Link key={p.id} href={`/profiles/${p.id}`} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all hover:border-blue-300">
              <div className="space-y-3">
                <div className="font-semibold text-lg text-gray-900 break-words">{clientName}</div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span>📅 Дата расчета: {dateStr}</span>
                  </div>
                  {birthDateStr && (
                    <div className="flex items-center gap-2">
                      <span>🎂 Дата рождения: {birthDateStr}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {consultationType}
                  </span>
                </div>
              </div>
            </Link>
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
