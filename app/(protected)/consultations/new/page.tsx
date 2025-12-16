"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function NewConsultationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [type, setType] = useState<string>("base");
  const [clientId, setClientId] = useState<string>(searchParams.get("clientId") || "");
  const [partnerClientId, setPartnerClientId] = useState<string>("");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [duration, setDuration] = useState<string>("60");
  const [baseCost, setBaseCost] = useState<string>("");
  const [actualCost, setActualCost] = useState<string>("");
  const [status, setStatus] = useState<string>("scheduled");

  // Загружаем клиентов с поиском
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);

  useEffect(() => {
    async function loadClients() {
      if (searchTerm.length < 2 && !searchTerm) {
        // Загружаем только первые 50 клиентов для начального отображения
        setLoadingClients(true);
        try {
          const res = await fetch("/api/clients?limit=50&sort=-created_at", { 
            cache: "no-store" 
          });
          const data = await res.json().catch(() => ({ data: [] }));
          setClients(data?.data || []);
        } catch (error) {
          console.error("Error loading clients:", error);
        } finally {
          setLoadingClients(false);
        }
        return;
      }

      // При поиске загружаем результаты поиска
      setLoadingClients(true);
      try {
        const res = await fetch(`/api/clients?search=${encodeURIComponent(searchTerm)}&limit=100`, { 
          cache: "no-store" 
        });
        const data = await res.json().catch(() => ({ data: [] }));
        setClients(data?.data || []);
      } catch (error) {
        console.error("Error searching clients:", error);
      } finally {
        setLoadingClients(false);
      }
    }

    const timeoutId = setTimeout(loadClients, searchTerm ? 300 : 0);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      setError("Выберите клиента");
      return;
    }
    
    if (type === "partner" && !partnerClientId) {
      setError("Для парной консультации выберите партнёра");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        client_id: Number(clientId),
        type,
        status,
      };

      if (!scheduledAt) {
        setError("Дата и время обязательны для заполнения");
        setLoading(false);
        return;
      }
      
      // Конвертируем datetime-local в ISO формат
      const date = new Date(scheduledAt);
      if (isNaN(date.getTime())) {
        setError("Неверный формат даты");
        setLoading(false);
        return;
      }
      payload.scheduled_at = date.toISOString();
      if (duration) payload.duration = Number(duration);
      if (baseCost) payload.base_cost = Number(baseCost);
      if (actualCost) payload.actual_cost = Number(actualCost);
      
      // Для парных консультаций
      if (type === "partner") {
        if (partnerClientId) payload.partner_client_id = Number(partnerClientId);
      }

      const res = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        const errorMessage = data?.message || data?.errors?.[0]?.message || "Ошибка создания консультации";
        console.error("Error creating consultation:", { status: res.status, data });
        throw new Error(errorMessage);
      }

      // Проверяем, что консультация действительно создана и есть ID
      const consultationId = data?.data?.id || data?.id;
      if (!consultationId) {
        console.error("Consultation created but no ID returned:", data);
        throw new Error("Консультация создана, но не удалось получить её ID. Проверьте список консультаций.");
      }

      // Редиректим на страницу созданной консультации
      router.push(`/consultations/${consultationId}`);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="page-title">Новая консультация</h1>
          <p className="page-subtitle">Заполните детали консультации</p>
        </div>
        <Link href="/consultations" className="btn btn-ghost btn-sm">← Назад</Link>
      </div>

      {error && (
        <div className="surface bg-red-50 border-red-200 text-red-800 p-4 rounded-xl">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="surface space-y-6 max-w-2xl">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Тип консультации *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full"
            required
          >
            <option value="base">Базовая</option>
            <option value="extended">Расширенная</option>
            <option value="target">Целевая</option>
            <option value="partner">Парная</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Клиент *</label>
          <div className="space-y-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск клиента..."
              className="!bg-white/50 !backdrop-blur-[20px] !border !border-white/60 !rounded-xl !px-4 !py-2.5 !text-sm !text-gray-900 focus:!border-accent-500/50 focus:!ring-1 focus:!ring-accent-500/20 focus:!bg-white/60 !transition-all !duration-200 !shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] focus:!shadow-[0_2px_8px_0_rgba(74,111,165,0.08)]"
            />
            {loadingClients && (
              <div className="text-xs text-gray-500">Поиск клиентов...</div>
            )}
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full"
              required
              disabled={loadingClients}
            >
              <option value="">Выберите клиента</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || `Клиент #${c.id}`}
                </option>
              ))}
            </select>
            {!searchTerm && clients.length === 50 && (
              <div className="text-xs text-gray-500">Показаны последние 50 клиентов. Используйте поиск для поиска других.</div>
            )}
          </div>
        </div>


        {type === "partner" && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Партнёр (второй клиент) *</label>
              <select
                value={partnerClientId}
                onChange={(e) => setPartnerClientId(e.target.value)}
                className="w-full"
                required
              >
                <option value="">Выберите партнёра</option>
                {clients.filter((c) => c.id !== Number(clientId)).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || `Клиент #${c.id}`}
                  </option>
                ))}
              </select>
            </div>

          </>
        )}

        <div className="space-y-2">
          <label>Дата и время *</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label>Длительность (минуты)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full"
              min="15"
              step="15"
            />
          </div>

          <div className="space-y-2">
            <label>Статус</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full"
            >
              <option value="scheduled">Запланирована</option>
              <option value="completed">Завершена</option>
              <option value="cancelled">Отменена</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label>Базовая стоимость</label>
            <input
              type="number"
              value={baseCost}
              onChange={(e) => setBaseCost(e.target.value)}
              className="w-full"
              step="0.01"
              min="0"
            />
          </div>

          <div className="space-y-2">
            <label>Фактическая стоимость</label>
            <input
              type="number"
              value={actualCost}
              onChange={(e) => setActualCost(e.target.value)}
              className="w-full"
              step="0.01"
              min="0"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full sm:w-auto"
          >
            {loading ? "Создание..." : "Создать консультацию"}
          </button>
          <Link
            href="/consultations"
            className="btn btn-secondary w-full sm:w-auto"
          >
            Отмена
          </Link>
        </div>
      </form>
    </div>
  );
}

