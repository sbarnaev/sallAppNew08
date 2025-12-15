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
    <div className="space-y-8 md:space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div className="space-y-2">
          <h1 className="page-title">Консультации</h1>
          <p className="page-subtitle">Всего: <span className="font-bold text-gray-900">{total}</span></p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link href="/consultations/new" className="btn btn-primary">Новая консультация</Link>
          <Link href="/profiles/new" className="btn btn-secondary">Новый расчёт</Link>
        </div>
      </div>

      <div className="surface-muted">
        <form className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end" action="/consultations" method="get">
          <div className="space-y-2">
            <label>ID клиента</label>
            <input name="clientId" defaultValue={(searchParams.clientId as string) || ""} className="w-full" placeholder="123" />
          </div>
          <div className="space-y-2">
            <label>Тип</label>
            <select name="type" defaultValue={(searchParams.type as string) || ""} className="w-full">
              <option value="">Все типы</option>
              <option value="base">Базовая</option>
              <option value="extended">Расширенная</option>
              <option value="target">Целевая</option>
              <option value="partner">Парная</option>
            </select>
          </div>
          <div className="space-y-2">
            <label>Статус</label>
            <input name="status" defaultValue={(searchParams.status as string) || ""} className="w-full" placeholder="scheduled" />
          </div>
          <div className="space-y-2">
            <label>С</label>
            <input type="datetime-local" name="dateFrom" defaultValue={(searchParams.dateFrom as string) || ""} className="w-full" />
          </div>
          <div className="space-y-2">
            <label>По</label>
            <input type="datetime-local" name="dateTo" defaultValue={(searchParams.dateTo as string) || ""} className="w-full" />
          </div>
          <div className="md:col-span-5 flex gap-3">
            <button className="btn btn-neutral" type="submit">Фильтровать</button>
            <Link href="/consultations" className="btn btn-secondary">Сбросить</Link>
          </div>
        </form>
      </div>

      <div className="grid gap-4">
        {data.length === 0 && <div className="surface text-center py-14 text-gray-600">Нет консультаций</div>}
        {data.map((c: any) => (
          <Link key={c.id} href={`/consultations/${c.id}`} className="surface hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="font-bold text-gray-900">Консультация #{c.id}</div>
                <div className="text-sm text-gray-600">
                  {c.scheduled_at ? new Date(c.scheduled_at).toLocaleString("ru-RU") : "Без даты"}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="badge badge-gray">
                  Клиент #{c.client_id}
                  {c.partner_client_id && ` + Партнёр #${c.partner_client_id}`}
                </span>
                <span className={c.type === "partner" ? "badge badge-green" : "badge badge-blue"}>
                  {c.type === "partner" ? "Парная" : c.type || "—"}
                </span>
                <span className="badge badge-gray">{c.status || "—"}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between gap-6 pt-2">
          <div className="flex items-center gap-3">
            {hasPrev && (
              <Link
                href={`/consultations?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).map(([k,v])=>[k,String(v||"")])) as any, page: String(page-1), limit: String(limit) }).toString()}`}
                className="btn btn-secondary btn-sm"
              >
                ← Назад
              </Link>
            )}
            {hasNext && (
              <Link
                href={`/consultations?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).map(([k,v])=>[k,String(v||"")])) as any, page: String(page+1), limit: String(limit) }).toString()}`}
                className="btn btn-secondary btn-sm"
              >
                Вперёд →
              </Link>
            )}
          </div>
          <div className="text-sm text-gray-600 font-medium">
            Стр. <span className="font-bold text-gray-900">{page}</span>
            {total ? ` · всего ${total}` : ""}
          </div>
        </div>
      )}
    </div>
  );
} 