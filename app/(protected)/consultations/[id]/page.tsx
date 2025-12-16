import Link from "next/link";
import { internalApiFetch } from "@/lib/fetchers";
import DeleteConsultation from "./DeleteConsultation";

async function getConsultation(id: string) {
  const res = await internalApiFetch(`/api/consultations/${id}`);
  const json = await res.json().catch(() => ({}));
  return json?.data || null;
}

async function getDetails(id: string) {
  const res = await internalApiFetch(`/api/consultations/${id}/details`);
  const json = await res.json().catch(() => ({ data: [] }));
  return json?.data || [];
}

async function getClient(id: number) {
  try {
    const res = await internalApiFetch(`/api/clients/${id}`);
    const json = await res.json().catch(() => ({}));
    return json?.data || null;
  } catch {
    return null;
  }
}

export default async function ConsultationDetailPage({ params }: { params: { id: string } }) {
  const c = await getConsultation(params.id);
  
  if (!c) {
    return (
      <div className="space-y-6">
        <div className="card bg-red-50 border-red-200 text-red-800 p-6">
          <h2 className="font-bold mb-2 text-lg">Консультация не найдена</h2>
          <p className="mb-4">
            Консультация с ID <span className="font-mono font-bold">{params.id}</span> не существует.
          </p>
          <p className="text-sm text-red-700 mb-4">
            Возможные причины:
          </p>
          <ul className="list-disc list-inside text-sm text-red-700 mb-4 space-y-1">
            <li>Консультация была удалена</li>
            <li>Консультация принадлежит другому пользователю</li>
            <li>Неправильный ID в ссылке</li>
          </ul>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link href="/consultations" className="btn btn-primary w-full sm:w-auto">
              ← Вернуться к списку консультаций
            </Link>
            <Link href="/consultations/new" className="btn btn-secondary w-full sm:w-auto">
              Создать новую консультацию
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  const details = await getDetails(params.id);
  const client = c?.client_id ? await getClient(c.client_id) : null;
  const partnerClient = c?.partner_client_id ? await getClient(c.partner_client_id) : null;

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
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Консультация #{params.id}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${statusColors[c.status] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
              {statusLabels[c.status] || c.status || "—"}
            </span>
            <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${c.type === "partner" ? "bg-green-100 text-green-700 border border-green-200" : "bg-blue-100 text-blue-700 border border-blue-200"}`}>
              {typeLabels[c.type] || c.type || "—"}
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href={`/consultations/${params.id}/edit`} className="btn btn-secondary w-full sm:w-auto">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Редактировать
          </Link>
          <DeleteConsultation id={params.id} />
          <Link href="/consultations" className="btn btn-ghost w-full sm:w-auto">
            ← Назад
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Основная информация */}
        <div className="lg:col-span-2 space-y-6">
          {/* Основные данные */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Основная информация
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="text-sm text-gray-500">Дата и время</div>
                <div className="font-medium">
                  {c.scheduled_at ? (
                    <time dateTime={c.scheduled_at}>
                      {new Date(c.scheduled_at).toLocaleString("ru-RU", {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </time>
                  ) : (
                    <span className="text-gray-400">Не указана</span>
                  )}
                </div>
              </div>
              {c.duration && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-500">Длительность</div>
                  <div className="font-medium">{c.duration} минут</div>
                </div>
              )}
              {(c.base_cost || c.actual_cost) && (
                <>
                  {c.base_cost && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-500">Базовая стоимость</div>
                      <div className="font-medium">{c.base_cost} ₽</div>
                    </div>
                  )}
                  {c.actual_cost && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-500">Фактическая стоимость</div>
                      <div className="font-medium">{c.actual_cost} ₽</div>
                    </div>
                  )}
                </>
              )}
              <div className="space-y-2">
                <div className="text-sm text-gray-500">Создана</div>
                <div className="font-medium">
                  {c.created_at ? new Date(c.created_at).toLocaleString("ru-RU") : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Клиенты и профили */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Клиенты и профили
            </h2>
            <div className="space-y-4">
              {c.client_id && (
                <div className="p-4 border border-gray-200 rounded-xl">
                  <div className="text-sm text-gray-500 mb-2">Клиент</div>
                  <Link href={`/clients/${c.client_id}`} className="font-medium text-brand-600 hover:text-brand-700">
                    {client?.name || `Клиент #${c.client_id}`}
                  </Link>
                  {c.profile_id && (
                    <div className="mt-2">
                      <div className="text-sm text-gray-500 mb-1">Профиль</div>
                      <Link href={`/profiles/${c.profile_id}`} className="text-sm text-brand-600 hover:text-brand-700">
                        Профиль #{c.profile_id} →
                      </Link>
                    </div>
                  )}
                </div>
              )}
              {c.partner_client_id && (
                <div className="p-4 border border-gray-200 rounded-xl">
                  <div className="text-sm text-gray-500 mb-2">Партнёр</div>
                  <Link href={`/clients/${c.partner_client_id}`} className="font-medium text-brand-600 hover:text-brand-700">
                    {partnerClient?.name || `Клиент #${c.partner_client_id}`}
                  </Link>
                  {c.partner_profile_id && (
                    <div className="mt-2">
                      <div className="text-sm text-gray-500 mb-1">Профиль партнёра</div>
                      <Link href={`/profiles/${c.partner_profile_id}`} className="text-sm text-brand-600 hover:text-brand-700">
                        Профиль #{c.partner_profile_id} →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Детали консультации */}
          {details.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Детали консультации
              </h2>
              <div className="space-y-4">
                {details.map((d: any) => (
                  <div key={d.id} className="p-4 border border-gray-200 rounded-xl">
                    <div className="font-medium mb-2 text-gray-900">{d.section}</div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{d.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Боковая панель */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Быстрые действия</h3>
            <div className="space-y-3">
              {c.client_id && (
                <Link href={`/clients/${c.client_id}`} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Клиент</div>
                    <div className="text-sm text-gray-500">{client?.name || `#${c.client_id}`}</div>
                  </div>
                </Link>
              )}
              {c.partner_client_id && (
                <Link href={`/clients/${c.partner_client_id}`} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Партнёр</div>
                    <div className="text-sm text-gray-500">{partnerClient?.name || `#${c.partner_client_id}`}</div>
                  </div>
                </Link>
              )}
              <Link href={`/consultations/${params.id}/edit`} className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 