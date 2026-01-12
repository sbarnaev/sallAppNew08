"use client";

import Link from "next/link";
import { useEffect, useState, useMemo, useCallback } from "react";

interface Reminder {
  id: string;
  type: "birthday" | "consultation" | "no-contact";
  title: string;
  date: string;
  daysUntil: number;
  clientId?: number;
  clientName?: string;
  link?: string;
}

// Static helper functions moved outside component
const getReminderIcon = (type: string) => {
  switch (type) {
    case "birthday": return "🎂";
    case "consultation": return "📅";
    case "no-contact": return "⏰";
    default: return "📌";
  }
};

const getReminderColor = (type: string) => {
  switch (type) {
    case "birthday": return "bg-blue-100 border-blue-300 text-blue-700";
    case "consultation": return "bg-green-100 border-green-300 text-green-700";
    case "no-contact": return "bg-amber-100 border-amber-300 text-amber-700";
    default: return "bg-gray-100 border-gray-300 text-gray-700";
  }
};

const formatDaysUntil = (daysUntil: number, type: string, date?: string) => {
  if (type === "no-contact") {
    if (daysUntil < 0) return "Нет контакта";
    if (daysUntil === 0) return "Сегодня";
    if (daysUntil === 1) return "1 день назад";
    if (daysUntil < 30) return `${daysUntil} дней назад`;
    const months = Math.floor(daysUntil / 30);
    return `${months} мес. назад`;
  }

  if (daysUntil === 0) return "Сегодня";
  if (daysUntil === 1) return "Завтра";
  if (daysUntil <= 7) return `Через ${daysUntil} ${daysUntil === 1 ? "день" : daysUntil < 5 ? "дня" : "дней"}`;
  if (date) return new Date(date).toLocaleDateString("ru-RU");
  return "";
};

export function RemindersWidget() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReminders() {
      setLoading(true);
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const in7Days = new Date(today);
        in7Days.setDate(in7Days.getDate() + 7);
        const oneMonthAgo = new Date(today);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const remindersList: Reminder[] = [];

        // Parallel fetch of independent resources (significant performance improvement)
        const [
          consultationsRes,
          clientsForBirthdaysRes,
          recentClientsRes,
          recentProfilesRes,
          recentConsultationsRes
        ] = await Promise.all([
          // 1. Консультации на ближайшие 7 дней (только запланированные)
          fetch(
            `/api/consultations?filter[scheduled_at][_gte]=${today.toISOString()}&filter[scheduled_at][_lte]=${in7Days.toISOString()}&filter[status][_eq]=scheduled&limit=100&fields=id,client_id,partner_client_id,type,scheduled_at`,
            { next: { revalidate: 30 } }
          ),
          // 2. Клиенты с днями рождения (последние 100)
          fetch("/api/clients?limit=100&sort=-created_at&fields=id,name,birth_date,created_at", {
            next: { revalidate: 60 }
          }),
          // 3. Клиенты для проверки "без контакта" (последние 100)
          fetch("/api/clients?limit=100&sort=-created_at&fields=id,name,created_at", {
            next: { revalidate: 60 }
          }),
          // 4. Последние расчёты (200)
          fetch("/api/profiles?limit=200&sort=-created_at&fields=id,client_id,created_at", {
            next: { revalidate: 60 }
          }),
          // 5. Последние консультации (200)
          fetch("/api/consultations?limit=200&sort=-scheduled_at,-created_at&fields=id,client_id,scheduled_at,created_at", {
            next: { revalidate: 60 }
          })
        ]);

        // Process consultation response
        let consultations: any[] = [];
        if (consultationsRes.ok) {
          const consultationsData = await consultationsRes.json().catch(() => ({ data: [] }));
          consultations = consultationsData?.data || [];
        } else if (consultationsRes.status === 403) {
          return; // Подписка истекла
        }

        // Process birthday clients response
        let clientsForBirthdays: any[] = [];
        if (clientsForBirthdaysRes.ok) {
          const clientsForBirthdaysData = await clientsForBirthdaysRes.json().catch(() => ({ data: [] }));
          clientsForBirthdays = clientsForBirthdaysData?.data || [];
        } else if (clientsForBirthdaysRes.status === 403) {
          return;
        }

        // Process recent clients response
        let recentClients: any[] = [];
        if (recentClientsRes.ok) {
          const recentClientsData = await recentClientsRes.json().catch(() => ({ data: [] }));
          recentClients = recentClientsData?.data || [];
        } else if (recentClientsRes.status === 403) {
          return;
        }

        // Process recent profiles response
        let recentProfiles: any[] = [];
        if (recentProfilesRes.ok) {
          const recentProfilesData = await recentProfilesRes.json().catch(() => ({ data: [] }));
          recentProfiles = recentProfilesData?.data || [];
        } else if (recentProfilesRes.status === 403) {
          return;
        }

        // Process recent consultations response
        let recentConsultations: any[] = [];
        if (recentConsultationsRes.ok) {
          const recentConsultationsData = await recentConsultationsRes.json().catch(() => ({ data: [] }));
          recentConsultations = recentConsultationsData?.data || [];
        } else if (recentConsultationsRes.status === 403) {
          return;
        }

        // Получаем уникальные ID клиентов из консультаций
        const consultationClientIds = new Set<number>();
        consultations.forEach((c: any) => {
          if (c.client_id) consultationClientIds.add(c.client_id);
          if (c.partner_client_id) consultationClientIds.add(c.partner_client_id);
        });

        // Проверяем дни рождения у загруженных клиентов
        clientsForBirthdays.forEach((client: any) => {
          if (client.birth_date) {
            const birthDate = new Date(client.birth_date);
            const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
            const nextYearBirthday = new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate());

            let birthdayDate = thisYearBirthday;
            if (thisYearBirthday < today) {
              birthdayDate = nextYearBirthday;
            }

            const daysUntil = Math.ceil((birthdayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (daysUntil <= 7) {
              remindersList.push({
                id: `birthday-${client.id}`,
                type: "birthday",
                title: `День рождения: ${client.name || `Клиент #${client.id}`}`,
                date: birthdayDate.toISOString(),
                daysUntil,
                clientId: client.id,
                clientName: client.name,
                link: `/clients/${client.id}`
              });
            }
          }
        });

        // Обрабатываем консультации - загружаем только нужных клиентов (зависимый запрос)
        const clientIdsForConsultations = Array.from(consultationClientIds);
        let clientsMap: Record<number, any> = {};

        if (clientIdsForConsultations.length > 0) {
          const ids = clientIdsForConsultations.join(',');
          const clientsRes = await fetch(`/api/clients?filter[id][_in]=${ids}&fields=id,name&limit=100`, {
            next: { revalidate: 60 }
          });
          if (clientsRes.ok) {
            const clientsData = await clientsRes.json().catch(() => ({ data: [] }));
            clientsData?.data?.forEach((c: any) => {
              if (c.id) clientsMap[c.id] = c;
            });
          } else if (clientsRes.status === 403) {
            return;
          }
        }

        consultations.forEach((consultation: any) => {
          if (consultation.scheduled_at && consultation.status === "scheduled") {
            const consultationDate = new Date(consultation.scheduled_at);
            const daysUntil = Math.ceil((consultationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (daysUntil >= 0 && daysUntil <= 7) {
              const client = clientsMap[consultation.client_id];
              const typeLabels: Record<string, string> = {
                base: "Базовая",
                extended: "Расширенная",
                target: "Целевая",
                partner: "Парная"
              };
              const typeLabel = typeLabels[consultation.type] || consultation.type || "Консультация";

              remindersList.push({
                id: `consultation-${consultation.id}`,
                type: "consultation",
                title: `${typeLabel}: ${client?.name || `Клиент #${consultation.client_id}`}`,
                date: consultation.scheduled_at,
                daysUntil,
                clientId: consultation.client_id,
                clientName: client?.name,
                link: `/consultations/${consultation.id}`
              });
            }
          }
        });

        // Группируем по client_id для быстрого поиска
        const profilesByClient: Record<number, any> = {};
        recentProfiles.forEach((p: any) => {
          if (p.client_id && (!profilesByClient[p.client_id] || new Date(p.created_at) > new Date(profilesByClient[p.client_id].created_at))) {
            profilesByClient[p.client_id] = p;
          }
        });

        const consultationsByClient: Record<number, any> = {};
        recentConsultations.forEach((c: any) => {
          if (c.client_id) {
            const date = new Date(c.scheduled_at || c.created_at).getTime();
            if (!consultationsByClient[c.client_id] || date > new Date(consultationsByClient[c.client_id].scheduled_at || consultationsByClient[c.client_id].created_at).getTime()) {
              consultationsByClient[c.client_id] = c;
            }
          }
        });

        // Проверяем только загруженных клиентов
        recentClients.forEach((client: any) => {
          const lastProfile = profilesByClient[client.id];
          const lastConsultation = consultationsByClient[client.id];

          const lastProfileDate = lastProfile ? new Date(lastProfile.created_at) : null;
          const lastConsultationDate = lastConsultation ? new Date(lastConsultation.scheduled_at || lastConsultation.created_at) : null;

          let lastContactDate: Date | null = null;
          if (lastProfileDate && lastConsultationDate) {
            lastContactDate = lastProfileDate > lastConsultationDate ? lastProfileDate : lastConsultationDate;
          } else if (lastProfileDate) {
            lastContactDate = lastProfileDate;
          } else if (lastConsultationDate) {
            lastContactDate = lastConsultationDate;
          } else {
            lastContactDate = new Date(client.created_at);
          }

          if (lastContactDate < oneMonthAgo) {
            const daysSince = Math.floor((today.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24));

            remindersList.push({
              id: `no-contact-${client.id}`,
              type: "no-contact",
              title: `Нет контакта: ${client.name || `Клиент #${client.id}`}`,
              date: lastContactDate.toISOString(),
              daysUntil: daysSince,
              clientId: client.id,
              clientName: client.name,
              link: `/clients/${client.id}`
            });
          }
        });

        // Сортируем: сначала ближайшие события, потом клиенты без контакта
        remindersList.sort((a, b) => {
          if (a.type === "no-contact" && b.type !== "no-contact") return 1;
          if (a.type !== "no-contact" && b.type === "no-contact") return -1;
          return a.daysUntil - b.daysUntil;
        });

        // Ограничиваем до 10 самых важных
        setReminders(remindersList.slice(0, 10));
      } catch (error) {
        console.error("Error loading reminders:", error);
      } finally {
        setLoading(false);
      }
    }

    loadReminders();
  }, []);

  if (loading) {
    return (
      <div className="card p-5">
        <h3 className="text-base font-bold text-gray-900 mb-4">Напоминания</h3>
        <div className="flex items-center justify-center py-4">
          <svg className="animate-spin h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }

  if (reminders.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-base font-bold text-gray-900 mb-4">Напоминания</h3>
        <div className="text-center py-4 text-gray-500">
          <p className="text-sm">Нет напоминаний на ближайшие 7 дней</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="text-base font-bold text-gray-900 mb-4">Напоминания</h3>

      <div className="space-y-2">
        {reminders.map((reminder) => (
          <Link
            key={reminder.id}
            href={reminder.link || "#"}
            className="block p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200 group"
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg border ${getReminderColor(reminder.type)} flex items-center justify-center text-lg shrink-0`}>
                {getReminderIcon(reminder.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 group-hover:text-brand-600 transition-colors mb-0.5">
                  {reminder.title}
                </div>
                <div className="text-xs text-gray-600">
                  {formatDaysUntil(reminder.daysUntil, reminder.type, reminder.date)}
                </div>
                {reminder.date && reminder.type !== "no-contact" && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {new Date(reminder.date).toLocaleDateString("ru-RU", {
                      year: "numeric",
                      month: "long",
                      day: "numeric"
                    })}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {reminders.filter(r => r.type === "no-contact").length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <Link
            href="/clients"
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Все клиенты →
          </Link>
        </div>
      )}
    </div>
  );
}

