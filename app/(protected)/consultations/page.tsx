import Link from "next/link";
import { internalApiFetch } from "@/lib/fetchers";

function formatPrice(price: number | string | null | undefined): string {
  if (!price) return "0";
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return "0";
  // Округляем до целого и форматируем с пробелами для тысяч
  const rounded = Math.round(num);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

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
  params.set("sort", "-scheduled_at,-created_at");

  const res = await internalApiFetch(`/api/consultations?${params.toString()}`);
  const json = await res.json();
  return json;
}

async function getClientsMap(clientIds: number[]) {
  try {
    if (clientIds.length === 0) return {};
    // Загружаем только нужных клиентов по их ID
    const ids = clientIds.join(',');
    const res = await internalApiFetch(`/api/clients?filter[id][_in]=${ids}&fields=id,name&limit=100`, {
      next: { revalidate: 60 }
    });
    const json = await res.json().catch(() => ({ data: [] }));
    const clientsMap: Record<number, string> = {};
    (json?.data || []).forEach((c: any) => {
      if (c.id) clientsMap[c.id] = c.name || `Клиент #${c.id}`;
    });
    return clientsMap;
  } catch {
    return {};
  }
}

export default async function ConsultationsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined>}) {
  const { data = [], meta = {} } = await getConsultations(searchParams);
  // Получаем только уникальные ID клиентов из консультаций
  const clientIdSet = new Set<number>();
  const partnerClientIdSet = new Set<number>();
  
  data.forEach((c: any) => {
    if (c.client_id && typeof c.client_id === 'number') {
      clientIdSet.add(c.client_id);
    }
    if (c.partner_client_id && typeof c.partner_client_id === 'number') {
      partnerClientIdSet.add(c.partner_client_id);
    }
  });
  
  const allClientIds: number[] = Array.from(new Set([...Array.from(clientIdSet), ...Array.from(partnerClientIdSet)]));
  const clientsMap = await getClientsMap(allClientIds);
  const page = Number(searchParams.page || 1);
  const limit = Number(searchParams.limit || 20);
  const total = meta?.filter_count ?? 0;
  const hasNext = page * limit < total;
  const hasPrev = page > 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <h1 className="page-title">Консультации</h1>
          <p className="page-subtitle">Всего: <span className="font-bold text-gray-900">{total}</span></p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href="/consultations/new" className="btn btn-primary w-full sm:w-auto">Новая консультация</Link>
          <Link href="/profiles/new" className="btn btn-secondary w-full sm:w-auto">Новый расчёт</Link>
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
            <select name="status" defaultValue={(searchParams.status as string) || ""} className="w-full">
              <option value="">Все статусы</option>
              <option value="scheduled">Запланирована</option>
              <option value="completed">Завершена</option>
              <option value="cancelled">Отменена</option>
            </select>
        </div>
          <div className="space-y-2">
            <label>С</label>
            <input type="datetime-local" name="dateFrom" defaultValue={(searchParams.dateFrom as string) || ""} className="w-full" />
        </div>
          <div className="space-y-2">
            <label>По</label>
            <input type="datetime-local" name="dateTo" defaultValue={(searchParams.dateTo as string) || ""} className="w-full" />
        </div>
          <div className="md:col-span-5 flex flex-col sm:flex-row gap-2">
            <button className="btn btn-neutral w-full sm:w-auto" type="submit">Фильтровать</button>
            <Link href="/consultations" className="btn btn-secondary w-full sm:w-auto">Сбросить</Link>
        </div>
      </form>
      </div>

      <div className="grid gap-4">
        {data.length === 0 && <div className="surface text-center py-14 text-gray-600">Нет консультаций</div>}
        {data.map((c: any) => {
          const typeLabels: Record<string, string> = {
            base: "Базовая",
            extended: "Расширенная",
            target: "Целевая",
            partner: "Парная"
          };
          const statusLabels: Record<string, string> = {
            scheduled: "Запланирована",
            completed: "Завершена",
            cancelled: "Отменена"
          };
          const statusColors: Record<string, string> = {
            scheduled: "bg-blue-100 text-blue-700 border-blue-200",
            completed: "bg-green-100 text-green-700 border-green-200",
            cancelled: "bg-red-100 text-red-700 border-red-200"
          };
          const clientName = c.client_id ? (clientsMap[c.client_id] || `Клиент #${c.client_id}`) : "Без клиента";
          const partnerName = c.partner_client_id ? (clientsMap[c.partner_client_id] || `Клиент #${c.partner_client_id}`) : null;
          
          return (
            <Link key={c.id} href={`/consultations/${c.id}`} className="card hover:shadow-md transition-all duration-200 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="font-bold text-gray-900">Консультация #{c.id}</div>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${statusColors[c.status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                      {statusLabels[c.status] || c.status || "—"}
                    </span>
                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${c.type === "partner" ? "bg-green-100 text-green-700 border border-green-200" : "bg-blue-100 text-blue-700 border border-blue-200"}`}>
                      {typeLabels[c.type] || c.type || "—"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                      <Link href={`/clients/${c.client_id}`} className="text-brand-600 hover:text-brand-700 font-medium hover:underline">
                        {clientName}
                      </Link>
                      {partnerName && (
                        <>
                          <span className="text-gray-400">+</span>
                          <Link href={`/clients/${c.partner_client_id}`} className="text-brand-600 hover:text-brand-700 font-medium hover:underline">
                            {partnerName}
                          </Link>
                        </>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-3 flex-wrap">
                      {c.scheduled_at ? (
                        <span>{new Date(c.scheduled_at).toLocaleString("ru-RU", {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</span>
                      ) : (
                        <span className="text-gray-400">Без даты</span>
                      )}
                      {c.duration && <span>· {c.duration} мин</span>}
                      {(c.base_cost || c.actual_cost) && (
                        <span>· {formatPrice(c.actual_cost || c.base_cost)} ₽</span>
                      )}
                    </div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>

      {(hasPrev || hasNext) && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {hasPrev && (
              <Link
                href={`/consultations?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).map(([k,v])=>[k,String(v||"")])) as any, page: String(page-1), limit: String(limit) }).toString()}`}
                className="btn btn-secondary flex-1 sm:flex-none"
              >
                ← Назад
              </Link>
            )}
            {hasNext && (
              <Link
                href={`/consultations?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).map(([k,v])=>[k,String(v||"")])) as any, page: String(page+1), limit: String(limit) }).toString()}`}
                className="btn btn-secondary flex-1 sm:flex-none"
              >
                Вперёд →
              </Link>
            )}
          </div>
          <div className="text-sm text-gray-600 font-medium text-center sm:text-left">
            Стр. <span className="font-bold text-gray-900">{page}</span>
            {total ? ` · всего ${total}` : ""}
          </div>
        </div>
      )}
    </div>
  );
} 