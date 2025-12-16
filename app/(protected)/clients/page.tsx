import Link from "next/link";
import { internalApiFetch } from "@/lib/fetchers";

export const dynamic = "force-dynamic";

function getSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

async function getClients(searchParams: Record<string, string | string[] | undefined>) {
  try {
    const params = new URLSearchParams();
    const page = Math.max(parseInt(getSingleValue(searchParams.page) || "1", 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(getSingleValue(searchParams.limit) || "20", 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    params.set("limit", String(limit));
    params.set("offset", String(offset));
    params.set("meta", "filter_count");

    const searchTerm = getSingleValue(searchParams.search).trim();
    if (searchTerm) {
      params.set("search", searchTerm);
    }

    const res = await internalApiFetch(`/api/clients?${params.toString()}`, { cache: "no-store" });
    
    if (!res.ok) {
      console.error("API error:", res.status, res.statusText);
      return { data: [], meta: { filter_count: 0 } };
    }
    
    const json = await res.json().catch(() => ({ data: [], meta: { filter_count: 0 } }));
    return json;
  } catch (error) {
    console.error("Error in getClients:", error);
    return { data: [], meta: { filter_count: 0 } };
  }
}

export default async function ClientsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined>}) {
  let data: any[] = [];
  let meta: any = {};
  
  try {
    const result = await getClients(searchParams);
    data = result?.data || [];
    meta = result?.meta || {};
  } catch (error) {
    console.error("Error fetching clients:", error);
  }
  
  const page = Math.max(parseInt(getSingleValue(searchParams.page) || "1", 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(getSingleValue(searchParams.limit) || "20", 10) || 20, 1), 100);
  const searchTerm = getSingleValue(searchParams.search).trim();
  const total = meta?.filter_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const displayPage = total === 0 ? 1 : page;
  const hasNext = page * limit < total;
  const hasPrev = page > 1;

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Заголовок с статистикой */}
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <h1 className="page-title">Клиенты</h1>
          <p className="page-subtitle">Всего клиентов: <span className="text-gray-900 font-bold">{total}</span></p>
        </div>
        <div className="flex">
          <Link href="/clients/new" className="btn btn-success w-full sm:w-auto">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Новый клиент</span>
          </Link>
        </div>
      </div>

      {/* Поиск */}
      <div className="surface-muted">
        <form className="flex flex-col sm:flex-row gap-4" action="/clients" method="get">
          <div className="flex-1 relative">
            <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              name="search"
              defaultValue={searchTerm}
              className="w-full pl-12 pr-5 py-4"
              placeholder="Поиск по имени, email..."
            />
          </div>
          <button type="submit" className="btn btn-neutral">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="hidden sm:inline">Искать</span>
            <span className="sm:hidden">Найти</span>
          </button>
        </form>
      </div>

      {/* Список клиентов */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.length === 0 && (
          <div className="surface-muted text-center py-16 col-span-full">
            <svg className="w-20 h-20 mx-auto mb-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Клиенты не найдены</h3>
            <p className="text-gray-600 mb-6 text-base">
              {searchTerm ? "Попробуйте изменить параметры поиска" : "Создайте первого клиента"}
            </p>
            <Link href="/clients/new" className="btn btn-success">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Создать клиента
            </Link>
          </div>
        )}
        
        {data.map((c: any) => (
          <div key={c.id} className="card p-6 hover:shadow-soft-lg hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300 border border-gray-200/80 group bg-gradient-to-br from-white via-gray-50/30 to-white">
            {/* Заголовок с аватаром и именем */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 rounded-3xl flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-lg shadow-brand-500/20 group-hover:shadow-xl group-hover:shadow-brand-500/30 group-hover:scale-110 transition-all duration-300">
                {c.name ? c.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/clients/${c.id}`} className="block">
                  <h3 className="text-lg font-bold text-gray-900 truncate hover:text-brand-600 transition-colors leading-tight">
                    {c.name || 'Без имени'}
                  </h3>
                </Link>
                {c.birth_date && (
                  <span className="inline-block mt-1.5 text-xs text-gray-600 bg-gray-100/80 px-3 py-1 rounded-full whitespace-nowrap font-medium">
                    {new Date(c.birth_date).toLocaleDateString('ru-RU')}
                  </span>
                )}
              </div>
            </div>
            
            {/* Контакты */}
            <div className="flex flex-wrap gap-2.5 text-xs text-gray-600 mb-5">
              {c.email && (
                <div className="flex items-center gap-1 min-w-0">
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${c.email}`} className="hover:text-brand-600 truncate">{c.email}</a>
                </div>
              )}
              {c.phone && (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href={`tel:${c.phone}`} className="hover:text-brand-600">{c.phone}</a>
                </div>
              )}
              {c.source && (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {getSourceLabel(c.source)}
                </div>
              )}
              {c.communication_method && (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {getCommunicationLabel(c.communication_method)}
                </div>
              )}
            </div>
            
            {/* Действия */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
              <Link href={`/clients/${c.id}`} className="px-4 py-2.5 rounded-xl border border-gray-300/80 hover:bg-gradient-to-r hover:from-gray-50 hover:to-white text-xs font-bold transition-all duration-300 text-center hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]">
                Открыть
              </Link>
              <Link href={`/forecast/${c.id}`} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-100 to-purple-50 text-purple-700 hover:from-purple-200 hover:to-purple-100 border border-purple-200/60 text-xs font-bold transition-all duration-300 text-center hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]">
                Прогноз
              </Link>
              <Link href={`/profiles?filter[client_id][_eq]=${c.id}`} className="px-4 py-2.5 rounded-xl border border-gray-300/80 hover:bg-gradient-to-r hover:from-gray-50 hover:to-white text-xs font-bold transition-all duration-300 text-center hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]">
                Расчёты
              </Link>
              <Link href={`/profiles/new?clientId=${c.id}`} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 hover:from-blue-200 hover:to-blue-100 border border-blue-200/60 text-xs font-bold transition-all duration-300 text-center hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]">
                Расчёт
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Пагинация */}
      {(hasPrev || hasNext) && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4">
          <div className="flex items-center gap-3">
            {hasPrev && (
              <Link
                href={`/clients?search=${encodeURIComponent(searchTerm)}&page=${page-1}&limit=${limit}`}
                className="px-5 py-2.5 rounded-xl border border-gray-300/80 hover:bg-gray-50 hover:border-gray-400 text-sm font-bold transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
              >
                ← Назад
              </Link>
            )}
            {hasNext && (
              <Link
                href={`/clients?search=${encodeURIComponent(searchTerm)}&page=${page+1}&limit=${limit}`}
                className="px-5 py-2.5 rounded-xl border border-gray-300/80 hover:bg-gray-50 hover:border-gray-400 text-sm font-bold transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Вперёд →
              </Link>
            )}
          </div>
          <div className="text-sm text-gray-600 text-center font-medium">
            Страница <span className="font-bold text-gray-900">{displayPage}</span> из <span className="font-bold text-gray-900">{totalPages}</span> • Всего <span className="font-bold text-gray-900">{total}</span> клиентов
          </div>
        </div>
      )}
    </div>
  );
}

// Вспомогательные функции для отображения меток
function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    vk: 'VK',
    telegram: 'Telegram',
    website: 'Сайт',
    recommendation: 'Рекомендация',
    advertising: 'Реклама',
    other: 'Другое'
  };
  return labels[source] || source;
}

function getCommunicationLabel(method: string): string {
  const labels: Record<string, string> = {
    phone: 'Телефон',
    email: 'Email',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    vk: 'VK',
    in_person: 'Лично',
    other: 'Другое'
  };
  return labels[method] || method;
}
