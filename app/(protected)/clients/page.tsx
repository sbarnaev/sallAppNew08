import Link from "next/link";
import { internalApiFetch } from "@/lib/fetchers";

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
    <div className="space-y-4 md:space-y-6">
      {/* Заголовок с статистикой */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Клиенты</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">Всего клиентов: {total}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/clients/new" className="rounded-xl bg-green-600 text-white px-4 md:px-6 py-2 md:py-3 hover:bg-green-700 flex items-center gap-2 text-sm md:text-base whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="hidden sm:inline">Новый клиент</span>
            <span className="sm:hidden">Новый</span>
          </Link>
        </div>
      </div>

      {/* Поиск */}
      <div className="card">
        <form className="flex flex-col sm:flex-row gap-3" action="/clients" method="get">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              name="search"
              defaultValue={searchTerm}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-base"
              placeholder="Поиск по имени, email..."
            />
          </div>
          <button type="submit" className="rounded-xl bg-gray-900 text-white px-4 md:px-6 py-3 hover:bg-gray-800 flex items-center justify-center gap-2 whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="hidden sm:inline">Искать</span>
            <span className="sm:hidden">Найти</span>
          </button>
        </form>
      </div>

      {/* Список клиентов */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.length === 0 && (
          <div className="card text-center py-12 col-span-full">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Клиенты не найдены</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? "Попробуйте изменить параметры поиска" : "Создайте первого клиента"}
            </p>
            <Link href="/clients/new" className="inline-flex items-center gap-2 rounded-xl bg-green-100 text-green-700 px-4 py-2 hover:bg-green-200 border border-green-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Создать клиента
            </Link>
          </div>
        )}
        
        {data.map((c: any) => (
          <div key={c.id} className="card p-4 hover:shadow-md transition">
            {/* Заголовок с аватаром и именем */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-full flex items-center justify-center text-white font-semibold text-base shrink-0">
                {c.name ? c.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/clients/${c.id}`} className="block">
                  <h3 className="text-base font-semibold text-gray-900 truncate hover:text-brand-600">
                    {c.name || 'Без имени'}
                  </h3>
                </Link>
                {c.birth_date && (
                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
                    {new Date(c.birth_date).toLocaleDateString('ru-RU')}
                  </span>
                )}
              </div>
            </div>
            
            {/* Контакты */}
            <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-3">
              {c.email && (
                <div className="flex items-center gap-1 min-w-0">
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${c.email}`} className="hover:text-brand-600 truncate" onClick={(e) => e.stopPropagation()}>{c.email}</a>
                </div>
              )}
              {c.phone && (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <a href={`tel:${c.phone}`} className="hover:text-brand-600" onClick={(e) => e.stopPropagation()}>{c.phone}</a>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Link href={`/clients/${c.id}`} className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium transition-colors text-center">
                Открыть
              </Link>
              <Link href={`/forecast/${c.id}`} className="px-3 py-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200 text-sm font-medium transition-colors text-center">
                Прогноз
              </Link>
              <Link href={`/profiles?filter[client_id][_eq]=${c.id}`} className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium transition-colors text-center">
                Расчёты
              </Link>
              <Link href={`/profiles/new?clientId=${c.id}`} className="px-3 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200 text-sm font-medium transition-colors text-center">
                Расчёт
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Пагинация */}
      {(hasPrev || hasNext) && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {hasPrev && (
              <Link
                href={`/clients?search=${encodeURIComponent(searchTerm)}&page=${page-1}&limit=${limit}`}
                className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                ← Назад
              </Link>
            )}
            {hasNext && (
              <Link
                href={`/clients?search=${encodeURIComponent(searchTerm)}&page=${page+1}&limit=${limit}`}
                className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                Вперёд →
              </Link>
            )}
          </div>
          <div className="text-xs sm:text-sm text-gray-500 text-center">
            Страница {displayPage} из {totalPages} • Всего {total} клиентов
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
