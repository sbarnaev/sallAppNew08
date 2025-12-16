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
  const [profiles, setProfiles] = useState<any[]>([]);
  const [partnerProfiles, setPartnerProfiles] = useState<any[]>([]);
  
  const [type, setType] = useState<string>("base");
  const [clientId, setClientId] = useState<string>(searchParams.get("clientId") || "");
  const [partnerClientId, setPartnerClientId] = useState<string>("");
  const [profileId, setProfileId] = useState<string>("");
  const [partnerProfileId, setPartnerProfileId] = useState<string>("");
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

  // Загружаем профили для выбранного клиента
  useEffect(() => {
    if (!clientId) {
      setProfiles([]);
      return;
    }
    async function loadProfiles() {
      try {
        const res = await fetch(`/api/profiles?filter[client_id][_eq]=${clientId}&limit=1000`, { cache: "no-store" });
        const data = await res.json().catch(() => ({ data: [] }));
        setProfiles(data?.data || []);
      } catch (error) {
        console.error("Error loading partner profiles:", error);
      }
    }
    loadProfiles();
  }, [clientId]);

  // Загружаем профили для партнёра
  useEffect(() => {
    if (!partnerClientId) {
      setPartnerProfiles([]);
      return;
    }
    async function loadPartnerProfiles() {
      try {
        const res = await fetch(`/api/profiles?filter[client_id][_eq]=${partnerClientId}&limit=1000`, { cache: "no-store" });
        const data = await res.json().catch(() => ({ data: [] }));
        setPartnerProfiles(data?.data || []);
      } catch (error) {
        console.error("Error loading partner profiles:", error);
      }
    }
    loadPartnerProfiles();
  }, [partnerClientId]);

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

      if (scheduledAt) {
        // Конвертируем datetime-local в ISO формат
        const date = new Date(scheduledAt);
        if (!isNaN(date.getTime())) {
          payload.scheduled_at = date.toISOString();
        }
      }
      if (duration) payload.duration = Number(duration);
      if (baseCost) payload.base_cost = Number(baseCost);
      if (actualCost) payload.actual_cost = Number(actualCost);
      if (profileId) payload.profile_id = Number(profileId);
      
      // Для парных консультаций
      if (type === "partner") {
        if (partnerClientId) payload.partner_client_id = Number(partnerClientId);
        if (partnerProfileId) payload.partner_profile_id = Number(partnerProfileId);
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
    <div className="space-y-8 md:space-y-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="page-title text-3xl sm:text-4xl md:text-4xl">Новая консультация</h1>
          <p className="page-subtitle">Заполните детали и привяжите профили (если нужно)</p>
        </div>
        <Link href="/consultations" className="btn btn-ghost btn-sm">← Назад</Link>
      </div>

      {error && (
        <div className="surface bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="surface space-y-6">
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
            onChange={(e) => {
              setClientId(e.target.value);
              setProfileId(""); // Сбрасываем профиль при смене клиента
            }}
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

        {clientId && (
          <div className="space-y-2">
            <label>Профиль клиента (опционально)</label>
            <select
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className="w-full"
            >
              <option value="">Без профиля</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  Профиль #{p.id} {p.created_at ? `(${new Date(p.created_at).toLocaleDateString('ru-RU')})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {type === "partner" && (
          <>
            <div className="space-y-2">
              <label>Партнёр (второй клиент) *</label>
              <select
                value={partnerClientId}
                onChange={(e) => {
                  setPartnerClientId(e.target.value);
                  setPartnerProfileId(""); // Сбрасываем профиль партнёра
                }}
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

            {partnerClientId && (
              <div className="space-y-2">
                <label>Профиль партнёра (опционально)</label>
                <select
                  value={partnerProfileId}
                  onChange={(e) => setPartnerProfileId(e.target.value)}
                  className="w-full"
                >
                  <option value="">Без профиля</option>
                  {partnerProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      Профиль #{p.id} {p.created_at ? `(${new Date(p.created_at).toLocaleDateString('ru-RU')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        <div className="space-y-2">
          <label>Дата и время (опционально)</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full"
          />
          <p className="text-xs text-gray-500">Оставьте пустым, если дата не определена</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Длительность (минуты)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full"
              min="15"
              step="15"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Статус</label>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Базовая стоимость</label>
            <input
              type="number"
              value={baseCost}
              onChange={(e) => setBaseCost(e.target.value)}
              className="w-full"
              step="0.01"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Фактическая стоимость</label>
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
            disabled={loading}
            className="btn btn-primary flex-1"
          >
            {loading ? "Создание..." : "Создать консультацию"}
          </button>
          <Link
            href="/consultations"
            className="btn btn-secondary"
          >
            Отмена
          </Link>
        </div>
      </form>
    </div>
  );
}

