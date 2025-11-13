import Link from "next/link";
import { internalApiFetch } from "@/lib/fetchers";

async function getConsultations(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  const page = Number(searchParams.page || 1);
  const limit = Number(searchParams.limit || 20);
  const offset = (page - 1) * limit;
  const clientId = (searchParams.clientId as string) || "";
  const type = (searchParams.type as string) || "";
  const status = (searchParams.status as string) || "";
  const dateFrom = (searchParams.dateFrom as string) || "";
  const dateTo = (searchParams.dateTo as string) || "";

  if (clientId) params.set("filter[client_id][_eq]", clientId);
  if (type) params.set("filter[type][_eq]", type);
  if (status) params.set("filter[status][_eq]", status);
  if (dateFrom && dateTo) params.set("filter[scheduled_at][_between]", `${dateFrom},${dateTo}`);
  else if (dateFrom) params.set("filter[scheduled_at][_gte]", dateFrom);
  else if (dateTo) params.set("filter[scheduled_at][_lte]", dateTo);

  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("meta", "filter_count");
  params.set("sort", "-scheduled_at");

  const res = await internalApiFetch(`/api/consultations?${params.toString()}`);
  const json = await res.json();
  return json;
}

export default async function ConsultationsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined>}) {
  const { data = [], meta = {} } = await getConsultations(searchParams);
  const page = Number(searchParams.page || 1);
  const limit = Number(searchParams.limit || 20);
  const total = meta?.filter_count ?? 0;
  const hasNext = page * limit < total;
  const hasPrev = page > 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Консультации</h1>
        <div className="flex gap-2">
          <Link href="/consultations/new" className="rounded-2xl bg-brand-600 text-white px-4 py-2 hover:bg-brand-700">Новая консультация</Link>
          <Link href="/profiles/new" className="rounded-2xl border px-4 py-2 hover:bg-gray-50">Новый расчёт</Link>
        </div>
      </div>

      <form className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end" action="/consultations" method="get">
        <div>
          <label className="block text-sm mb-1">ID клиента</label>
          <input name="clientId" defaultValue={(searchParams.clientId as string) || ""} className="rounded-xl border p-3 w-full" placeholder="123" />
        </div>
        <div>
          <label className="block text-sm mb-1">Тип</label>
          <select name="type" defaultValue={(searchParams.type as string) || ""} className="rounded-xl border p-3 w-full">
            <option value="">Все типы</option>
            <option value="base">Базовая</option>
            <option value="extended">Расширенная</option>
            <option value="target">Целевая</option>
            <option value="partner">Парная</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Статус</label>
          <input name="status" defaultValue={(searchParams.status as string) || ""} className="rounded-xl border p-3 w-full" placeholder="scheduled" />
        </div>
        <div>
          <label className="block text-sm mb-1">С</label>
          <input type="datetime-local" name="dateFrom" defaultValue={(searchParams.dateFrom as string) || ""} className="rounded-xl border p-3 w-full" />
        </div>
        <div>
          <label className="block text-sm mb-1">По</label>
          <input type="datetime-local" name="dateTo" defaultValue={(searchParams.dateTo as string) || ""} className="rounded-xl border p-3 w-full" />
        </div>
        <div className="md:col-span-5">
          <button className="rounded-2xl bg-gray-900 text-white px-4 py-2">Фильтровать</button>
        </div>
      </form>

      <div className="grid gap-4">
        {data.length === 0 && <div className="card">Нет консультаций</div>}
        {data.map((c: any) => (
          <Link key={c.id} href={`/consultations/${c.id}`} className="card hover:shadow-md transition">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">Консультация #{c.id}</div>
                <div className="text-sm text-gray-500">{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : "Без даты"}</div>
              </div>
              <div className="text-sm text-gray-500">
                Клиент #{c.client_id}
                {c.partner_client_id && ` + Партнёр #${c.partner_client_id}`}
              </div>
              <div className="text-sm text-gray-500">
                {c.type === 'partner' ? '👥 Парная' : c.type || ""} · {c.status || ""}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {(hasPrev || hasNext) && (
        <div className="flex items-center gap-2">
          {hasPrev && <Link href={`/consultations?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).map(([k,v])=>[k,String(v||"")])) as any, page: String(page-1), limit: String(limit) }).toString()}`} className="px-3 py-1 rounded-lg border">Назад</Link>}
          <div className="text-sm text-gray-500">Стр. {page}{total ? ` · всего ${total}` : ""}</div>
          {hasNext && <Link href={`/consultations?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).map(([k,v])=>[k,String(v||"")])) as any, page: String(page+1), limit: String(limit) }).toString()}`} className="px-3 py-1 rounded-lg border">Вперёд</Link>}
        </div>
      )}
    </div>
  );
} 