import Link from "next/link";
import { fetchJson } from "@/lib/fetchers";

async function getProfiles(searchParams: Record<string, string | string[] | undefined>) {
  try {
    const params = new URLSearchParams();
    const q = (searchParams.search as string) || "";
    const type = (searchParams.type as string) || "";
    const clientId = (searchParams["filter[client_id][_eq]"] as string) || (searchParams.clientId as string) || "";
    const page = Number(searchParams.page || 1);
    const limit = Number(searchParams.limit || 20);
    const offset = (page - 1) * limit;
    if (q) params.set("search", q);
    if (type) params.set("filter[type][_eq]", type);
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

export default async function ProfilesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined>}) {
  let profiles: any[] = [];
  let meta: any = {};
  
  try {
    const result = await getProfiles(searchParams);
    profiles = result?.data || [];
    meta = result?.meta || {};
  } catch (error) {
    console.error("Error fetching profiles:", error);
    // Продолжаем с пустыми данными
  }
  
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

      <form className="flex flex-wrap gap-2 items-end" action="/profiles" method="get">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-sm mb-1">Поиск</label>
          <input name="search" defaultValue={(searchParams.search as string) || ""} className="rounded-xl border p-3 w-full" placeholder="Поиск по тексту профиля" />
        </div>
        <div>
          <label className="block text-sm mb-1">Тип расчёта</label>
          <select name="type" defaultValue={(searchParams.type as string) || ""} className="rounded-xl border p-3">
            <option value="">Все</option>
            <option value="birthdate">Дата рождения</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">ID клиента</label>
          <input name="filter[client_id][_eq]" defaultValue={(searchParams["filter[client_id][_eq]"] as string) || ""} className="rounded-xl border p-3 w-36" placeholder="123" />
        </div>
        <button className="rounded-2xl bg-gray-900 text-white px-4 py-2">Фильтровать</button>
      </form>

      <div className="grid gap-4">
        {profiles.length === 0 && <div className="card">Нет данных</div>}
        {profiles.map((p:any)=>(
          <Link key={p.id} href={`/profiles/${p.id}`} className="card hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">ID: {p.id}</div>
                <div className="text-sm text-gray-500">{new Date(p.created_at).toLocaleString()}</div>
              </div>
              <div className="text-sm text-gray-500">{p.client_id ? `Клиент #${p.client_id}` : ""}</div>
            </div>
          </Link>
        ))}
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
