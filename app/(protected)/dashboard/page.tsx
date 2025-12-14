import Link from "next/link";
import { internalApiFetch } from "@/lib/fetchers";

async function getStats() {
  try {
    // Параллельно загружаем статистику
    const [clientsRes, profilesRes, consultationsRes] = await Promise.all([
      internalApiFetch("/api/clients?limit=1&meta=filter_count", { cache: "no-store" }),
      internalApiFetch("/api/profiles?limit=1&meta=filter_count", { cache: "no-store" }),
      internalApiFetch("/api/consultations?limit=1&meta=filter_count", { cache: "no-store" }),
    ]);

    // Параллельно парсим все ответы
    const [clients, profiles, consultations] = await Promise.all([
      clientsRes.json().catch(() => ({ meta: { filter_count: 0 } })),
      profilesRes.json().catch(() => ({ meta: { filter_count: 0 } })),
      consultationsRes.json().catch(() => ({ meta: { filter_count: 0 } })),
    ]);

    return {
      clients: clients?.meta?.filter_count || 0,
      profiles: profiles?.meta?.filter_count || 0,
      consultations: consultations?.meta?.filter_count || 0,
    };
  } catch {
    return { clients: 0, profiles: 0, consultations: 0 };
  }
}

async function getRecentProfiles() {
  try {
    const res = await internalApiFetch("/api/profiles?limit=5&sort=-created_at", { cache: "no-store" });
    const data = await res.json().catch(() => ({ data: [] }));
    return data?.data || [];
  } catch {
    return [];
  }
}

async function getClientsMap(clientIds: number[]) {
  try {
    if (clientIds.length === 0) return {};
    const ids = clientIds.join(',');
    const res = await internalApiFetch(`/api/clients?filter[id][_in]=${ids}&fields=id,name,birth_date&limit=1000`, { 
      cache: "no-store"
    });
    if (!res.ok) {
      console.error("Failed to fetch clients:", res.status);
      return {};
    }
    const response = await res.json().catch(() => ({ data: [] }));
    // API возвращает { data: [...] }
    const clientsArray = Array.isArray(response?.data) ? response.data : [];
    const map: Record<number, { name: string; birth_date?: string }> = {};
    clientsArray.forEach((c: any) => {
      if (c?.id) {
        map[c.id] = { 
          name: c.name || '', 
          birth_date: c.birth_date 
        };
      }
    });
    return map;
  } catch (error) {
    console.error("Error fetching clients:", error);
  }
  return {};
}


export default async function DashboardPage() {
  // Параллельно загружаем статистику и недавние профили
  const [stats, recentProfiles] = await Promise.all([
    getStats(),
    getRecentProfiles(),
  ]);
  
  // Загружаем данные клиентов для отображения имен и дат рождения
  const clientIds = recentProfiles.map((p: any) => p.client_id).filter((id: any): id is number => !!id);
  const clientsMap = await getClientsMap(clientIds);

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-tight">
            Панель управления
          </h1>
          <p className="text-gray-600 text-base md:text-lg font-medium">
            Добро пожаловать в систему САЛ ПРОФИ
          </p>
        </div>
        <div className="flex gap-3">
          <Link 
            href="/clients/new" 
            className="rounded-2xl bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3.5 hover:from-green-600 hover:to-green-700 border-0 shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/30 transition-all duration-300 hover:scale-105 text-sm font-bold whitespace-nowrap active:scale-[0.98]"
          >
            + Клиент
          </Link>
          <Link 
            href="/profiles/new" 
            className="rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3.5 hover:from-blue-600 hover:to-blue-700 border-0 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 hover:scale-105 text-sm font-bold whitespace-nowrap active:scale-[0.98]"
          >
            + Расчёт
          </Link>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid md:grid-cols-3 gap-6">
        <Link href="/clients" className="card hover:shadow-soft-lg hover:scale-[1.01] transition-all duration-300 p-6 sm:p-8 bg-gradient-to-br from-white via-green-50/30 to-white border border-green-100/60 group">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="text-sm text-gray-500 mb-2 font-semibold uppercase tracking-wider">Клиенты</div>
              <div className="text-4xl sm:text-5xl font-bold text-gray-900 group-hover:text-green-700 transition-colors leading-none">{stats.clients}</div>
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-3xl flex items-center justify-center shadow-lg shadow-green-500/20 group-hover:shadow-xl group-hover:shadow-green-500/30 group-hover:scale-110 transition-all duration-300">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </Link>

        <Link href="/profiles" className="card hover:shadow-soft-lg hover:scale-[1.01] transition-all duration-300 p-6 sm:p-8 bg-gradient-to-br from-white via-brand-50/30 to-white border border-brand-100/60 group">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="text-sm text-gray-500 mb-2 font-semibold uppercase tracking-wider">Расчёты</div>
              <div className="text-4xl sm:text-5xl font-bold text-gray-900 group-hover:text-brand-700 transition-colors leading-none">{stats.profiles}</div>
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-600 rounded-3xl flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:shadow-xl group-hover:shadow-brand-500/30 group-hover:scale-110 transition-all duration-300">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </Link>

        <Link href="/consultations" className="card hover:shadow-soft-lg hover:scale-[1.01] transition-all duration-300 p-6 sm:p-8 bg-gradient-to-br from-white via-blue-50/30 to-white border border-blue-100/60 group">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="text-sm text-gray-500 mb-2 font-semibold uppercase tracking-wider">Консультации</div>
              <div className="text-4xl sm:text-5xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors leading-none">{stats.consultations}</div>
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-xl group-hover:shadow-blue-500/30 group-hover:scale-110 transition-all duration-300">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </Link>
      </div>

      {/* Быстрые действия */}
      <div className="card p-6 sm:p-8 bg-gradient-to-br from-white via-gray-50/50 to-white">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Быстрые действия</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/clients/new" className="flex items-center gap-4 p-5 rounded-2xl border border-gray-200/80 hover:border-green-300 hover:bg-gradient-to-br hover:from-green-50/80 hover:to-white transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-md shadow-green-500/20 group-hover:shadow-lg group-hover:shadow-green-500/30 group-hover:scale-110 transition-all duration-300">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900 group-hover:text-green-700 transition-colors text-base">Новый клиент</div>
              <div className="text-gray-500 text-xs mt-0.5">Добавить клиента</div>
            </div>
          </Link>

          <Link href="/profiles/new" className="flex items-center gap-4 p-5 rounded-2xl border border-gray-200/80 hover:border-brand-300 hover:bg-gradient-to-br hover:from-brand-50/80 hover:to-white transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group">
            <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl flex items-center justify-center shadow-md shadow-brand-500/20 group-hover:shadow-lg group-hover:shadow-brand-500/30 group-hover:scale-110 transition-all duration-300">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900 group-hover:text-brand-700 transition-colors text-base">Новый расчёт</div>
              <div className="text-gray-500 text-xs mt-0.5">Создать профиль</div>
            </div>
          </Link>

        </div>
      </div>

      {/* Недавние расчёты */}
      <div className="card p-6 sm:p-8 bg-gradient-to-br from-white via-gray-50/50 to-white">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Недавние расчёты</h2>
          <Link href="/profiles" className="text-sm font-bold text-brand-600 hover:text-brand-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-brand-50">Все →</Link>
        </div>
        {recentProfiles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Нет расчётов</p>
            <Link href="/profiles/new" className="text-brand-600 hover:text-brand-700 text-sm mt-2 inline-block">
              Создать первый расчёт
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {recentProfiles.map((p: any) => {
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
                <Link key={p.id} href={`/profiles/${p.id}`} className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm hover:shadow-soft-lg hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300 hover:border-blue-300 group">
                  <div className="space-y-4">
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
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
