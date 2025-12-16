import Link from "next/link";
import { internalApiFetch } from "@/lib/fetchers";
import { RemindersWidget } from "@/components/RemindersWidget";
import { SubscriptionStatus } from "@/components/SubscriptionStatus";

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
    <div className="space-y-6">
      {/* Статус подписки */}
      <SubscriptionStatus />
      
      {/* Заголовок */}
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <h1 className="page-title">Панель управления</h1>
          <p className="page-subtitle">Добро пожаловать в систему САЛ ПРОФИ</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link 
            href="/clients/new" 
            className="btn btn-success w-full sm:w-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Клиент</span>
          </Link>
          <Link 
            href="/consultations/new" 
            className="btn btn-primary w-full sm:w-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Консультация</span>
          </Link>
          <Link 
            href="/profiles/new" 
            className="btn btn-secondary w-full sm:w-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Расчёт</span>
          </Link>
        </div>
      </div>

      {/* Статистика - Glassmorphism */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link href="/clients" className="card p-5 group">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs text-gray-600 font-medium uppercase tracking-wide">Клиенты</div>
              <div className="text-3xl font-semibold text-gray-900 group-hover:text-accent-700 transition-colors leading-none">{stats.clients}</div>
            </div>
            <div className="w-11 h-11 bg-white/50 backdrop-blur-[15px] rounded-xl border border-white/60 flex items-center justify-center group-hover:bg-white/65 transition-colors">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </Link>

        <Link href="/profiles" className="card p-5 group">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs text-gray-600 font-medium uppercase tracking-wide">Расчёты</div>
              <div className="text-3xl font-semibold text-gray-900 group-hover:text-accent-700 transition-colors leading-none">{stats.profiles}</div>
            </div>
            <div className="w-11 h-11 bg-white/50 backdrop-blur-[15px] rounded-xl border border-white/60 flex items-center justify-center group-hover:bg-white/65 transition-colors">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </Link>

        <Link href="/consultations" className="card p-5 group">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs text-gray-600 font-medium uppercase tracking-wide">Консультации</div>
              <div className="text-3xl font-semibold text-gray-900 group-hover:text-accent-700 transition-colors leading-none">{stats.consultations}</div>
            </div>
            <div className="w-11 h-11 bg-white/50 backdrop-blur-[15px] rounded-xl border border-white/60 flex items-center justify-center group-hover:bg-white/65 transition-colors">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
        </Link>
      </div>

      {/* Быстрые действия - Glassmorphism */}
      <div className="card p-5">
        <h2 className="text-base font-semibold mb-4 text-gray-900">Быстрые действия</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link href="/clients/new" className="flex items-center gap-3 p-3.5 rounded-xl bg-white/40 backdrop-blur-[15px] border border-white/60 hover:bg-white/55 hover:border-white/70 transition-all duration-300 group">
            <div className="w-9 h-9 bg-white/50 backdrop-blur-[10px] rounded-lg border border-white/60 flex items-center justify-center group-hover:bg-white/65 transition-colors shrink-0">
              <svg className="w-4.5 h-4.5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 group-hover:text-accent-700 transition-colors text-sm">Новый клиент</div>
              <div className="text-gray-600 text-xs mt-0.5">Добавить клиента</div>
            </div>
          </Link>

          <Link href="/profiles/new" className="flex items-center gap-3 p-3.5 rounded-xl bg-white/40 backdrop-blur-[15px] border border-white/60 hover:bg-white/55 hover:border-white/70 transition-all duration-300 group">
            <div className="w-9 h-9 bg-white/50 backdrop-blur-[10px] rounded-lg border border-white/60 flex items-center justify-center group-hover:bg-white/65 transition-colors shrink-0">
              <svg className="w-4.5 h-4.5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 group-hover:text-accent-700 transition-colors text-sm">Новый расчёт</div>
              <div className="text-gray-600 text-xs mt-0.5">Создать профиль</div>
            </div>
          </Link>

        </div>
      </div>

      {/* Напоминания */}
      <RemindersWidget />

      {/* Недавние расчёты */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Недавние расчёты</h2>
          <Link href="/profiles" className="text-sm font-medium text-accent-700 hover:text-accent-800 transition-colors">Все →</Link>
        </div>
        {recentProfiles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Нет расчётов</p>
            <Link href="/profiles/new" className="text-accent-700 hover:text-accent-800 text-sm mt-2 inline-block">
              Создать первый расчёт
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <Link key={p.id} href={`/profiles/${p.id}`} className="card p-4 group">
                  <div className="space-y-3">
                    <div className="font-semibold text-base text-gray-900 break-words group-hover:text-accent-700 transition-colors leading-tight">{clientName}</div>
                    <div className="space-y-1.5 text-xs text-gray-600">
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Дата расчета: {dateStr}</span>
                      </div>
                      {birthDateStr && (
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Дата рождения: {birthDateStr}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-white/40 backdrop-blur-[10px] text-gray-700 border border-white/50">
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
