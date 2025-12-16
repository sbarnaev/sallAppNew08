"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function UpcomingConsultationsWidget() {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [clientsMap, setClientsMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadConsultations() {
      setLoading(true);
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const in30Days = new Date(today);
        in30Days.setDate(in30Days.getDate() + 30);

        // Загружаем предстоящие консультации (только запланированные)
        const consultationsRes = await fetch(
          `/api/consultations?filter[scheduled_at][_gte]=${today.toISOString()}&filter[scheduled_at][_lte]=${in30Days.toISOString()}&filter[status][_eq]=scheduled&limit=10&sort=scheduled_at&fields=id,client_id,type,scheduled_at`,
          { next: { revalidate: 30 } }
        );

        let consultationsData: any = { data: [] };
        if (consultationsRes.ok) {
          consultationsData = await consultationsRes.json().catch(() => ({ data: [] }));
        } else if (consultationsRes.status === 403) {
          return;
        }

        const consultationsList = consultationsData?.data || [];

        // Получаем уникальные ID клиентов
        const clientIds = [...new Set(consultationsList.map((c: any) => c.client_id).filter((id: any): id is number => !!id && typeof id === 'number'))];

        // Загружаем имена клиентов
        let clients: Record<number, string> = {};
        if (clientIds.length > 0) {
          const ids = clientIds.join(',');
          const clientsRes = await fetch(`/api/clients?filter[id][_in]=${ids}&fields=id,name&limit=100`, {
            next: { revalidate: 60 }
          });

          if (clientsRes.ok) {
            const clientsData = await clientsRes.json().catch(() => ({ data: [] }));
            clientsData?.data?.forEach((c: any) => {
              if (c.id) clients[c.id] = c.name || `Клиент #${c.id}`;
            });
          }
        }

        setClientsMap(clients);
        setConsultations(consultationsList);
      } catch (error) {
        console.error("Error loading consultations:", error);
      } finally {
        setLoading(false);
      }
    }

    loadConsultations();
  }, []);

  if (loading) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-center py-4">
          <svg className="animate-spin h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }

  const typeLabels: Record<string, string> = {
    base: "Базовая",
    extended: "Расширенная",
    target: "Целевая",
    partner: "Парная"
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900">Предстоящие консультации</h2>
        <Link href="/consultations" className="text-sm font-medium text-accent-700 hover:text-accent-800 transition-colors">Все →</Link>
      </div>
      {consultations.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Нет предстоящих консультаций</p>
          <Link href="/consultations/new" className="text-accent-700 hover:text-accent-800 text-sm mt-2 inline-block">
            Создать консультацию
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {consultations.map((c: any) => {
            const clientName = c.client_id ? (clientsMap[c.client_id] || `Клиент #${c.client_id}`) : "Без клиента";
            const consultationDate = c.scheduled_at ? new Date(c.scheduled_at) : null;
            const daysUntil = consultationDate ? Math.ceil((consultationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

            return (
              <Link key={c.id} href={`/consultations/${c.id}`} className="block p-3.5 rounded-xl bg-white/40 backdrop-blur-[15px] border border-white/60 hover:bg-white/55 hover:border-white/70 transition-all duration-300 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 group-hover:text-accent-700 transition-colors mb-1">
                      {clientName}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 border border-blue-200">
                        {typeLabels[c.type] || c.type}
                      </span>
                      {consultationDate && (
                        <span>
                          {consultationDate.toLocaleDateString("ru-RU", {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                      {daysUntil !== null && daysUntil >= 0 && (
                        <span className="text-gray-500">
                          {daysUntil === 0 ? "Сегодня" : daysUntil === 1 ? "Завтра" : `Через ${daysUntil} дн.`}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 shrink-0 group-hover:text-accent-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
