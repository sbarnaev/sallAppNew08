import Link from "next/link";
import { internalApiFetch } from "@/lib/fetchers";

async function getStats() {
  try {
    const [clientsRes, profilesRes, consultationsRes] = await Promise.all([
      internalApiFetch("/api/clients?limit=1&meta=filter_count", { cache: "no-store" }),
      internalApiFetch("/api/profiles?limit=1&meta=filter_count", { cache: "no-store" }),
      internalApiFetch("/api/consultations?limit=1&meta=filter_count", { cache: "no-store" }),
    ]);

    const clients = await clientsRes.json().catch(() => ({ meta: { filter_count: 0 } }));
    const profiles = await profilesRes.json().catch(() => ({ meta: { filter_count: 0 } }));
    const consultations = await consultationsRes.json().catch(() => ({ meta: { filter_count: 0 } }));

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

async function getRecentConsultations() {
  try {
    const res = await internalApiFetch("/api/consultations?limit=5&sort=-scheduled_at", { cache: "no-store" });
    const data = await res.json().catch(() => ({ data: [] }));
    return data?.data || [];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const stats = await getStats();
  const recentProfiles = await getRecentProfiles();
  const recentConsultations = await getRecentConsultations();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Панель управления</h1>
        <div className="flex gap-2">
          <Link href="/clients/new" className="rounded-xl bg-green-600 text-white px-4 py-2 hover:bg-green-700 text-sm">
            + Клиент
          </Link>
          <Link href="/profiles/new" className="rounded-xl bg-brand-600 text-white px-4 py-2 hover:bg-brand-700 text-sm">
            + Расчёт
          </Link>
          <Link href="/consultations/new" className="rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 text-sm">
            + Консультация
          </Link>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link href="/clients" className="card hover:shadow-lg transition p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-1">Клиенты</div>
              <div className="text-3xl font-bold text-gray-900">{stats.clients}</div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </Link>

        <Link href="/profiles" className="card hover:shadow-lg transition p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-1">Расчёты</div>
              <div className="text-3xl font-bold text-gray-900">{stats.profiles}</div>
            </div>
            <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </Link>

        <Link href="/consultations" className="card hover:shadow-lg transition p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-1">Консультации</div>
              <div className="text-3xl font-bold text-gray-900">{stats.consultations}</div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </Link>
      </div>

      {/* Быстрые действия */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Быстрые действия</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link href="/clients/new" className="flex items-center gap-3 p-3 rounded-xl border hover:bg-gray-50 transition">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div className="text-sm">
              <div className="font-medium">Новый клиент</div>
              <div className="text-gray-500">Добавить клиента</div>
            </div>
          </Link>

          <Link href="/profiles/new" className="flex items-center gap-3 p-3 rounded-xl border hover:bg-gray-50 transition">
            <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="text-sm">
              <div className="font-medium">Новый расчёт</div>
              <div className="text-gray-500">Создать профиль</div>
            </div>
          </Link>

          <Link href="/consultations/new" className="flex items-center gap-3 p-3 rounded-xl border hover:bg-gray-50 transition">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-sm">
              <div className="font-medium">Новая консультация</div>
              <div className="text-gray-500">Запланировать</div>
            </div>
          </Link>

          <Link href="/consultations?type=partner" className="flex items-center gap-3 p-3 rounded-xl border hover:bg-gray-50 transition">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="text-sm">
              <div className="font-medium">Парные консультации</div>
              <div className="text-gray-500">Просмотреть</div>
            </div>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Недавние расчёты */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Недавние расчёты</h2>
            <Link href="/profiles" className="text-sm text-brand-600 hover:text-brand-700">Все →</Link>
          </div>
          {recentProfiles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Нет расчётов</p>
              <Link href="/profiles/new" className="text-brand-600 hover:text-brand-700 text-sm mt-2 inline-block">
                Создать первый расчёт
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentProfiles.map((p: any) => (
                <Link
                  key={p.id}
                  href={`/profiles/${p.id}`}
                  className="block p-3 rounded-xl border hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Расчёт #{p.id}</div>
                      <div className="text-sm text-gray-500">
                        {p.created_at ? new Date(p.created_at).toLocaleString("ru-RU") : ""}
                      </div>
                    </div>
                    {p.client_id && (
                      <div className="text-sm text-gray-500">Клиент #{p.client_id}</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Ближайшие консультации */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Ближайшие консультации</h2>
            <Link href="/consultations" className="text-sm text-blue-600 hover:text-blue-700">Все →</Link>
          </div>
          {recentConsultations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Нет консультаций</p>
              <Link href="/consultations/new" className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block">
                Запланировать консультацию
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentConsultations.map((c: any) => (
                <Link
                  key={c.id}
                  href={`/consultations/${c.id}`}
                  className="block p-3 rounded-xl border hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        Консультация #{c.id}
                        {c.type === "partner" && " 👥"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {c.scheduled_at
                          ? new Date(c.scheduled_at).toLocaleString("ru-RU")
                          : "Без даты"}
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        c.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : c.status === "cancelled"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {c.status || "scheduled"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
