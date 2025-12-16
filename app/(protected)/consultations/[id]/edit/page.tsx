"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function EditConsultationPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consultation, setConsultation] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);

  const [type, setType] = useState<string>("base");
  const [clientId, setClientId] = useState<string>("");
  const [partnerClientId, setPartnerClientId] = useState<string>("");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [baseCost, setBaseCost] = useState<string>("");
  const [actualCost, setActualCost] = useState<string>("");
  const [status, setStatus] = useState<string>("scheduled");

  useEffect(() => {
    async function loadData() {
      try {
        // Загружаем консультацию
        const consultationRes = await fetch(`/api/consultations/${id}`, { cache: "no-store" });
        const consultationData = await consultationRes.json().catch(() => ({ data: null }));
        const c = consultationData?.data;
        
        if (!c) {
          setError("Консультация не найдена");
          setLoading(false);
          return;
        }

        setConsultation(c);
        setType(c.type || "base");
        setClientId(String(c.client_id || ""));
        setPartnerClientId(c.partner_client_id ? String(c.partner_client_id) : "");
        setScheduledAt(c.scheduled_at ? new Date(c.scheduled_at).toISOString().slice(0, 16) : "");
        setDuration(c.duration ? String(c.duration) : "");
        setBaseCost(c.base_cost ? String(c.base_cost) : "");
        setActualCost(c.actual_cost ? String(c.actual_cost) : "");
        setStatus(c.status || "scheduled");

        // Загружаем клиентов
        const clientsRes = await fetch("/api/clients?limit=1000", { cache: "no-store" });
        const clientsData = await clientsRes.json().catch(() => ({ data: [] }));
        setClients(clientsData?.data || []);

      } catch (err: any) {
        setError(err.message || "Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);


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

    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        type,
        status,
      };

      if (!scheduledAt) {
        setError("Дата и время обязательны для заполнения");
        setSaving(false);
        return;
      }
      
      const date = new Date(scheduledAt);
      if (isNaN(date.getTime())) {
        setError("Неверный формат даты");
        setSaving(false);
        return;
      }
      payload.scheduled_at = date.toISOString();
      
      if (duration) payload.duration = Number(duration);
      if (baseCost) payload.base_cost = Number(baseCost);
      if (actualCost) payload.actual_cost = Number(actualCost);

      // Для парных консультаций
      if (type === "partner") {
        if (partnerClientId) payload.partner_client_id = Number(partnerClientId);
      } else {
        payload.partner_client_id = null;
      }
      
      // Автоматически обновляем статус на основе даты
      const now = new Date();
      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate < now && payload.status === "scheduled") {
        // Если дата прошла, но статус еще scheduled, можно предложить изменить на completed
        // Но не делаем это автоматически, оставляем пользователю выбор
      }

      const res = await fetch(`/api/consultations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.errors?.[0]?.message || "Ошибка обновления консультации");
      }

      router.push(`/consultations/${id}`);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8 md:space-y-10 max-w-2xl mx-auto">
        <div className="surface text-center py-14">
          <div className="animate-spin h-8 w-8 border-4 border-brand-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="space-y-8 md:space-y-10 max-w-2xl mx-auto">
        <div className="surface bg-red-50 border-red-200 text-red-800 p-6">
          <h2 className="font-bold mb-2">Консультация не найдена</h2>
          <p>Консультация с ID {id} не существует или у вас нет прав доступа.</p>
          <Link href="/consultations" className="text-brand-600 hover:text-brand-700 mt-4 inline-block">
            ← Вернуться к списку консультаций
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="page-title">Редактировать консультацию</h1>
          <p className="page-subtitle">Измените детали консультации</p>
        </div>
        <Link href={`/consultations/${id}`} className="btn btn-ghost btn-sm">← Назад</Link>
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

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary flex-1"
          >
            {saving ? "Сохранение..." : "Сохранить изменения"}
          </button>
          <Link
            href={`/consultations/${id}`}
            className="btn btn-secondary"
          >
            Отмена
          </Link>
        </div>
      </form>
    </div>
  );
}
