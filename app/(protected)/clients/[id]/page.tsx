import Link from "next/link";
import { internalApiFetch } from "@/lib/fetchers";
import DeleteClient from "./DeleteClient";
import { ClientTimeline } from "@/components/ClientTimeline";
import { ClientTestResults } from "@/components/ClientTestResults";
import { calculateSALCodes, getCodeShortLabel } from "@/lib/sal-codes";

async function getClient(id: string) {
  const res = await internalApiFetch(`/api/clients/${id}`);
  const json = await res.json().catch(()=>({}));
  return json?.data || null;
}

async function getClientProfiles(id: string, searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  const page = Number(searchParams.page || 1);
  const limit = Number(searchParams.limit || 20);
  const offset = (page - 1) * limit;
  params.set("filter[client_id][_eq]", id);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("meta", "filter_count");
  // Новое: сортировка по дате создания (сначала новые)
  if (!params.has("sort")) params.set("sort", "-created_at");


  const res = await internalApiFetch(`/api/profiles?${params.toString()}`, { cache: 'no-store' });
  const json = await res.json().catch(()=>({ data: [], meta: {} }));
  return json;
}

async function getClientConsultations(id: string, searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  const consultationPage = Number(searchParams.consultationPage || 1);
  const consultationLimit = Number(searchParams.consultationLimit || 20);
  const offset = (consultationPage - 1) * consultationLimit;
  params.set("filter[client_id][_eq]", id);
  params.set("limit", String(consultationLimit));
  params.set("offset", String(offset));
  params.set("meta", "filter_count");
  if (!params.has("sort")) params.set("sort", "-scheduled_at,-created_at");

  const res = await internalApiFetch(`/api/consultations?${params.toString()}`, { cache: 'no-store' });
  const json = await res.json().catch(()=>({ data: [], meta: {} }));
  return json;
}

export default async function ClientDetailPage({ params, searchParams }: { params: { id: string }, searchParams: Record<string, string | string[] | undefined>}) {
  const client = await getClient(params.id);
  const { data: profiles = [], meta = {} } = await getClientProfiles(params.id, searchParams);
  const { data: consultations = [], meta: consultationsMeta = {} } = await getClientConsultations(params.id, searchParams);

  const page = Number(searchParams.page || 1);
  const limit = Number(searchParams.limit || 20);
  const total = meta?.filter_count ?? 0;
  const hasNext = page * limit < total;
  const hasPrev = page > 1;

  const consultationPage = Number(searchParams.consultationPage || 1);
  const consultationLimit = Number(searchParams.consultationLimit || 20);
  const consultationsTotal = consultationsMeta?.filter_count ?? 0;
  const consultationsHasNext = consultationPage * consultationLimit < consultationsTotal;
  const consultationsHasPrev = consultationPage > 1;



  if (!client) {
    return (
      <div className="space-y-6">
        <div className="card">
          <h1 className="text-xl font-semibold text-red-600">Клиент не найден</h1>
          <p className="text-gray-600">Клиент с ID {params.id} не существует или у вас нет прав доступа.</p>
          <Link href="/clients" className="text-brand-600 hover:text-brand-700">← Вернуться к списку клиентов</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок с быстрыми действиями */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-brand-500 to-brand-600 rounded-full flex items-center justify-center text-white text-xl sm:text-2xl font-bold">
            {client.name ? client.name.charAt(0).toUpperCase() : '?'}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {client.name || 'Без имени'}
            </h1>
            <div className="text-sm text-gray-500 mt-1">
              Создан: {new Date(client.created_at).toLocaleDateString('ru-RU')}
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href={`/clients/${params.id}/edit`} className="btn btn-secondary w-full sm:w-auto">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Редактировать
          </Link>
          <DeleteClient id={params.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Основная информация о клиенте */}
        <div className="lg:col-span-2 space-y-6">
          {/* Контактная информация */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Контактная информация
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Полное имя</div>
                    <div className="font-medium">{client.name || 'Не указано'}</div>
                  </div>
                </div>
                
                {client.birth_date && (
                  <>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Дата рождения</div>
                      <div className="font-medium">{new Date(client.birth_date).toLocaleDateString('ru-RU')}</div>
                    </div>
                  </div>
                    {(() => {
                      const codes = calculateSALCodes(client.birth_date);
                      if (!codes) return null;
                      const codeOrder: Array<keyof typeof codes> = ['personality', 'connector', 'realization', 'generator', 'mission'];
                      return (
                        <div className="md:col-span-2 mt-4">
                          <div className="text-sm text-gray-500 mb-3">Коды САЛ</div>
                          <div className="grid grid-cols-5 gap-3">
                            {codeOrder.map((key) => (
                              <div key={key} className="flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                <div className="w-12 h-12 rounded-lg shadow-sm bg-[#1f92aa] text-white font-bold text-xl grid place-items-center">
                                  {codes[key]}
                                </div>
                                <div className="text-xs text-gray-600 text-center font-medium">
                                  {getCodeShortLabel(key)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
                
                {client.email && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Email</div>
                      <div className="font-medium">
                        <a href={`mailto:${client.email}`} className="text-brand-600 hover:text-brand-700">
                          {client.email}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                {client.phone && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Телефон</div>
                      <div className="font-medium">
                        <a href={`tel:${client.phone}`} className="text-brand-600 hover:text-brand-700">
                          {client.phone}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                
                {client.source && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Источник</div>
                      <div className="font-medium">{getSourceLabel(client.source)}</div>
                    </div>
                  </div>
                )}
                
                {client.communication_method && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Способ общения</div>
                      <div className="font-medium">{getCommunicationLabel(client.communication_method)}</div>
                    </div>
                  </div>
                )}
                

              </div>
            </div>
          </div>

{/* АНКЕТА КЛИЕНТА */}

          <div className="card">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Анкета
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="text-sm text-gray-500">Источник</div>
                <div className="font-medium">{getSourceLabel(client.source)}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-gray-500">Способ общения</div>
                <div className="font-medium">{getCommunicationLabel(client.communication_method)}</div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="text-sm text-gray-500">Заметки</div>
                <div className="font-medium whitespace-pre-wrap">{client.notes || '—'}</div>
              </div>
            </div>
          </div>
          

          {/* История взаимодействий */}
          <ClientTimeline clientId={Number(params.id)} />

          {/* Результаты тестирования */}
          <ClientTestResults clientId={Number(params.id)} />

          {/* Консультации клиента */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Консультации
                <span className="text-sm text-gray-500 font-normal">({consultationsTotal})</span>
              </h2>
              <Link href={`/consultations/new?clientId=${params.id}`} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                + Добавить консультацию
              </Link>
            </div>
            
            <div className="space-y-3">
              {consultations.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <div>Пока нет консультаций</div>
                  <div className="text-sm">Создайте первую консультацию для этого клиента</div>
                </div>
              )}
              
              {consultations.map((c: any) => {
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
                
                return (
                  <Link key={c.id} href={`/consultations/${c.id}`} className="block p-4 border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200 hover:border-brand-200">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-medium text-gray-900">Консультация #{c.id}</div>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${statusColors[c.status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                            {statusLabels[c.status] || c.status || "—"}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{typeLabels[c.type] || c.type || "—"}</span>
                            {c.scheduled_at && (
                              <span className="text-gray-500">
                                {new Date(c.scheduled_at).toLocaleString('ru-RU', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            )}
                            {c.duration && (
                              <span className="text-gray-500">· {c.duration} мин</span>
                            )}
                          </div>
                          {c.partner_client_id && (
                            <div className="text-xs text-gray-500">Партнёр: Клиент #{c.partner_client_id}</div>
                          )}
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

            {(consultationsHasPrev || consultationsHasNext) && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="flex items-center gap-2">
                  {consultationsHasPrev && (
                    <Link href={`/clients/${params.id}?consultationPage=${consultationPage-1}&consultationLimit=${consultationLimit}`} className="px-3 py-1 rounded-lg border hover:bg-gray-50 text-sm">
                      ← Назад
                    </Link>
                  )}
                  {consultationsHasNext && (
                    <Link href={`/clients/${params.id}?consultationPage=${consultationPage+1}&consultationLimit=${consultationLimit}`} className="px-3 py-1 rounded-lg border hover:bg-gray-50 text-sm">
                      Вперёд →
                    </Link>
                  )}
                </div>
                <div className="text-sm text-gray-500">Стр. {consultationPage}{consultationsTotal ? ` из ${Math.ceil(consultationsTotal / consultationLimit)}` : ""}</div>
              </div>
            )}
          </div>

          {/* Расчёты клиента */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Расчёты клиента
                <span className="text-sm text-gray-500 font-normal">({total})</span>
              </h2>
              <Link href={`/profiles/new?clientId=${params.id}`} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                + Добавить расчёт
              </Link>
            </div>
            
            <div className="space-y-3">
              {profiles.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <div>Пока нет расчётов</div>
                  <div className="text-sm">Создайте первый расчёт для этого клиента</div>
                </div>
              )}
              
              {profiles.map((p: any) => (
                <Link key={p.id} href={`/profiles/${p.id}`} className="block p-4 border border-gray-200 rounded-xl hover:shadow-md transition-all duration-200 hover:border-brand-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">Расчёт #{p.id}</div>
                      <div className="text-sm text-gray-500">{new Date(p.created_at).toLocaleString('ru-RU')}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {(hasPrev || hasNext) && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="flex items-center gap-2">
                  {hasPrev && (
                    <Link href={`/clients/${params.id}?page=${page-1}&limit=${limit}`} className="px-3 py-1 rounded-lg border hover:bg-gray-50 text-sm">
                      ← Назад
                    </Link>
                  )}
                  {hasNext && (
                    <Link href={`/clients/${params.id}?page=${page+1}&limit=${limit}`} className="px-3 py-1 rounded-lg border hover:bg-gray-50 text-sm">
                      Вперёд →
                    </Link>
                  )}
                </div>
                <div className="text-sm text-gray-500">Стр. {page}{total ? ` из ${Math.ceil(total / limit)}` : ""}</div>
              </div>
            )}
          </div>
        </div>

        {/* Боковая панель с быстрыми действиями */}
        <div className="space-y-6">
          {/* Быстрые действия */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Быстрые действия</h3>
            <div className="space-y-3">
              <Link href={`/forecast/${params.id}`} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium">Прогностика</div>
                  <div className="text-sm text-gray-500">Прогноз ресурсов</div>
                </div>
              </Link>

              <Link href={`/consultations/new?clientId=${params.id}`} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium">Новая консультация</div>
                  <div className="text-sm text-gray-500">Создать консультацию</div>
                </div>
              </Link>

              <Link href={`/profiles/new?clientId=${params.id}`} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium">Новый расчёт</div>
                  <div className="text-sm text-gray-500">Создать профиль</div>
                </div>
              </Link>
              
              <Link href={`/tests?clientId=${params.id}`} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg">🧪</span>
                </div>
                <div className="text-left">
                  <div className="font-medium">Тестирование</div>
                  <div className="text-sm text-gray-500">Психологические тесты</div>
                </div>
              </Link>
              
              <Link href={`/clients/${params.id}/edit`} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium">Редактировать</div>
                  <div className="text-sm text-gray-500">Изменить данные</div>
                </div>
              </Link>
              
              {client.phone && (
                <a href={`tel:${client.phone}`} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Позвонить</div>
                    <div className="text-sm text-gray-500">{client.phone}</div>
                  </div>
                </a>
              )}
              
              {client.email && (
                <a href={`mailto:${client.email}`} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Написать</div>
                    <div className="text-sm text-gray-500">{client.email}</div>
                  </div>
                </a>
              )}
            </div>
          </div>

          {/* Статистика */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Статистика</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Всего консультаций</span>
                <span className="font-semibold">{consultationsTotal}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Всего расчётов</span>
                <span className="font-semibold">{total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Клиент с</span>
                <span className="font-semibold">{new Date(client.created_at).toLocaleDateString('ru-RU')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
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