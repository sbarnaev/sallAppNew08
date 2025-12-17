"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface TimelineEvent {
  id: string;
  type: "profile" | "consultation" | "note" | "test";
  title: string;
  date: string;
  description?: string;
  link?: string;
  icon: string;
  color: string;
}

interface Props {
  clientId: number;
}

export function ClientTimeline({ clientId }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTimeline() {
      setLoading(true);
      try {
        // Загружаем расчёты
        const profilesRes = await fetch(`/api/profiles?filter[client_id][_eq]=${clientId}&limit=100&sort=-created_at`, {
          cache: "no-store"
        });
        // Проверяем статус перед парсингом JSON, чтобы избежать ошибок в консоли
        let profilesData: any = { data: [] };
        if (profilesRes.ok) {
          profilesData = await profilesRes.json().catch(() => ({ data: [] }));
        } else if (profilesRes.status === 403) {
          // Подписка истекла - api-interceptor обработает редирект
          return;
        }

        // Загружаем консультации
        const consultationsRes = await fetch(`/api/consultations?filter[client_id][_eq]=${clientId}&limit=100&sort=-created_at`, {
          cache: "no-store"
        });
        // Проверяем статус перед парсингом JSON, чтобы избежать ошибок в консоли
        let consultationsData: any = { data: [] };
        if (consultationsRes.ok) {
          consultationsData = await consultationsRes.json().catch(() => ({ data: [] }));
        } else if (consultationsRes.status === 403) {
          // Подписка истекла - api-interceptor обработает редирект
          return;
        }

        // Загружаем данные клиента для получения тестов
        const clientRes = await fetch(`/api/clients/${clientId}`, {
          cache: "no-store"
        });
        // Проверяем статус перед парсингом JSON, чтобы избежать ошибок в консоли
        let clientData: any = { data: {} };
        if (clientRes.ok) {
          clientData = await clientRes.json().catch(() => ({ data: {} }));
        } else if (clientRes.status === 403) {
          // Подписка истекла - api-interceptor обработает редирект
          return;
        }

        // Загружаем все профили для получения заметок
        const allProfiles = profilesData?.data || [];
        const profileIds = allProfiles.map((p: any) => p.id);

        const timelineEvents: TimelineEvent[] = [];

        // Добавляем расчёты
        allProfiles.forEach((profile: any) => {
          timelineEvents.push({
            id: `profile-${profile.id}`,
            type: "profile",
            title: `Расчёт #${profile.id}`,
            date: profile.created_at,
            description: "Создан новый расчёт",
            link: `/profiles/${profile.id}`,
            icon: "📊",
            color: "blue"
          });
        });

        // Добавляем консультации
        (consultationsData?.data || []).forEach((consultation: any) => {
          const typeLabels: Record<string, string> = {
            base: "Базовая",
            extended: "Расширенная",
            target: "Целевая",
            partner: "Партнёрская"
          };
          
          const statusLabels: Record<string, string> = {
            scheduled: "Запланирована",
            completed: "Завершена",
            cancelled: "Отменена"
          };
          
          const consultationDate = consultation.scheduled_at || consultation.created_at;
          const dateObj = consultationDate ? new Date(consultationDate) : null;
          
          timelineEvents.push({
            id: `consultation-${consultation.id}`,
            type: "consultation",
            title: `${typeLabels[consultation.type] || consultation.type} консультация`,
            date: consultationDate,
            description: consultation.status ? `Статус: ${statusLabels[consultation.status] || consultation.status}` : undefined,
            link: `/consultations/${consultation.id}`,
            icon: "💬",
            color: "green"
          });
        });

        // Добавляем события с заметками (если есть)
        for (const profile of allProfiles) {
          if (profile.notes && profile.notes.trim().length > 0) {
            // Проверяем, не добавлен ли уже расчёт
            const existingIndex = timelineEvents.findIndex(e => e.id === `profile-${profile.id}`);
            if (existingIndex >= 0) {
              // Обновляем описание, если заметка была добавлена позже
              const noteDate = profile.updated_at || profile.created_at;
              if (noteDate > profile.created_at) {
                timelineEvents.push({
                  id: `note-${profile.id}`,
                  type: "note",
                  title: `Заметка к расчёту #${profile.id}`,
                  date: noteDate,
                  description: "Добавлена заметка",
                  link: `/profiles/${profile.id}`,
                  icon: "📝",
                  color: "purple"
                });
              }
            }
          }
        }

        // Добавляем результаты тестирования
        const testirovanieRaw = clientData?.data?.testirovanie;
        if (testirovanieRaw) {
          let testData: any = {};
          if (typeof testirovanieRaw === "string") {
            try {
              testData = JSON.parse(testirovanieRaw);
            } catch (e) {
              console.warn("Failed to parse testirovanie:", e);
            }
          } else if (typeof testirovanieRaw === "object") {
            testData = testirovanieRaw;
          }

          const testNames: Record<string, string> = {
            procrastination: "Тест на прокрастинацию",
            depression: "Тест на депрессию (PHQ-9)",
            anxiety: "Тест на тревожность (GAD-7)",
            stress: "Тест на стресс",
            "self-esteem": "Тест на самооценку",
            burnout: "Тест на выгорание (MBI)",
            "self-efficacy": "Тест на самоэффективность",
            "emotional-intelligence": "Тест на эмоциональный интеллект"
          };

          Object.entries(testData).forEach(([testId, results]: [string, any]) => {
            if (Array.isArray(results)) {
              results.forEach((result: any, idx: number) => {
                const levelLabels: Record<string, string> = {
                  low: "Низкий",
                  medium: "Средний",
                  high: "Высокий",
                  critical: "Критический"
                };
                timelineEvents.push({
                  id: `test-${testId}-${idx}`,
                  type: "test",
                  title: testNames[testId] || `Тест: ${testId}`,
                  date: result.date,
                  description: `Результат: ${result.score} баллов (${levelLabels[result.level] || result.level})`,
                  link: `/clients/${clientId}`,
                  icon: "🧪",
                  color: "purple"
                });
              });
            }
          });
        }

        // Сортируем по дате (новые сверху)
        timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setEvents(timelineEvents);
      } catch (error) {
        console.error("Error loading timeline:", error);
      } finally {
        setLoading(false);
      }
    }

    if (clientId) {
      loadTimeline();
    }
  }, [clientId]);

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">История взаимодействий</h3>
        <div className="text-center py-8 text-gray-500">
          <p>Пока нет событий</p>
          <p className="text-sm mt-2">Создайте расчёт или консультацию, чтобы начать историю</p>
        </div>
      </div>
    );
  }

  const colorClasses: Record<string, string> = {
    blue: "bg-blue-100 border-blue-300 text-blue-700",
    green: "bg-green-100 border-green-300 text-green-700",
    purple: "bg-purple-100 border-purple-300 text-purple-700",
    orange: "bg-orange-100 border-orange-300 text-orange-700"
  };

  return (
    <div className="card p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">История взаимодействий</h3>
      
      <div className="relative">
        {/* Вертикальная линия */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div className="space-y-6">
          {events.map((event, index) => (
            <div key={event.id} className="relative pl-14">
              {/* Иконка */}
              <div className={`absolute left-0 w-12 h-12 rounded-full border-2 ${colorClasses[event.color]} flex items-center justify-center text-xl shadow-sm`}>
                {event.icon}
              </div>

              {/* Содержимое */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {event.link ? (
                      <Link href={event.link} className="block group">
                        <h4 className="font-bold text-gray-900 group-hover:text-brand-600 transition-colors mb-1">
                          {event.title}
                        </h4>
                      </Link>
                    ) : (
                      <h4 className="font-bold text-gray-900 mb-1">{event.title}</h4>
                    )}
                    {event.description && (
                      <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                    )}
                    <time className="text-xs text-gray-500">
                      {new Date(event.date).toLocaleString("ru-RU", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </time>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

