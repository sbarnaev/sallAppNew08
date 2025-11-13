"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function ProfilesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [total, setTotal] = useState(0);
  const [clientIdFilter, setClientIdFilter] = useState(searchParams.get("filter[client_id][_eq]") || "");
  
  const debouncedSearch = useDebounce(searchTerm, 500);
  const limit = 20;

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (clientIdFilter) params.set("filter[client_id][_eq]", clientIdFilter);
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("meta", "filter_count");

      const res = await fetch(`/api/profiles?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({ data: [], meta: { filter_count: 0 } }));
      
      setProfiles(data?.data || []);
      setTotal(data?.meta?.filter_count || 0);
    } catch (error) {
      console.error("Error fetching profiles:", error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, clientIdFilter, page, limit]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (clientIdFilter) params.set("filter[client_id][_eq]", clientIdFilter);
    if (page > 1) params.set("page", String(page));
    
    router.replace(`/profiles?${params.toString()}`, { scroll: false });
  }, [debouncedSearch, clientIdFilter, page, router]);

  const hasNext = page * limit < total;
  const hasPrev = page > 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Расчёты</h1>
        <Link href="/profiles/new" className="rounded-2xl bg-brand-600 text-white px-4 py-2 hover:bg-brand-700">Новый расчёт</Link>
      </div>

      {/* Поиск */}
      <div className="card">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              placeholder="Поиск по имени, фамилии или дате рождения..."
            />
          </div>
          <div className="w-36">
            <input
              type="text"
              value={clientIdFilter}
              onChange={(e) => {
                setClientIdFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              placeholder="ID клиента"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.length === 0 && <div className="col-span-full card">Нет данных</div>}
            {profiles.map((p:any) => {
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
              
              const clientName = p.client?.name || (p.client_id ? `Клиент #${p.client_id}` : "Без клиента");
              const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString("ru-RU") : "";
              const birthDateStr = p.client?.birth_date ? new Date(p.client.birth_date).toLocaleDateString("ru-RU") : null;
              
              return (
                <Link key={p.id} href={`/profiles/${p.id}`} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all hover:border-blue-300">
                  <div className="space-y-3">
                    <div className="font-semibold text-lg text-gray-900 break-words">{clientName}</div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <span>📅 Дата расчета: {dateStr}</span>
                      </div>
                      {birthDateStr && (
                        <div className="flex items-center gap-2">
                          <span>🎂 Дата рождения: {birthDateStr}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {consultationType}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {(hasPrev || hasNext) && (
            <div className="flex items-center gap-2">
              {hasPrev && (
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border hover:bg-gray-50"
                >
                  Назад
                </button>
              )}
              <div className="text-sm text-gray-500">Стр. {page}{total ? ` · всего ${total}` : ""}</div>
              {hasNext && (
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded-lg border hover:bg-gray-50"
                >
                  Вперёд
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
