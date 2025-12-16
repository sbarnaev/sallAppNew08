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

  // Загружаем клиентов
  useEffect(() => {
    async function loadClients() {
      try {
        const res = await fetch("/api/clients?limit=1000", { cache: "no-store" });
        const data = await res.json().catch(() => ({ data: [] }));
        setClients(data?.data || []);
      } catch (error) {
        console.error("Error loading partner profiles:", error);
      }
    }
    loadClients();
  }, []);


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
        throw new Error(data?.message || data?.errors?.[0]?.message || "Ошибка создания консультации");
      }

      router.push(`/consultations/${data?.data?.id || data?.id}`);
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
          <label>Тип консультации *</label>
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
          <label>Клиент *</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full"
            required
          >
            <option value="">Выберите клиента</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || `Клиент #${c.id}`}
              </option>
            ))}
          </select>
        </div>


        {type === "partner" && (
          <>
            <div className="space-y-2">
              <label>Партнёр (второй клиент) *</label>
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

