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
  const [profiles, setProfiles] = useState<any[]>([]);
  const [partnerProfiles, setPartnerProfiles] = useState<any[]>([]);

  const [type, setType] = useState<string>("base");
  const [clientId, setClientId] = useState<string>("");
  const [partnerClientId, setPartnerClientId] = useState<string>("");
  const [profileId, setProfileId] = useState<string>("");
  const [partnerProfileId, setPartnerProfileId] = useState<string>("");
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
        setProfileId(c.profile_id ? String(c.profile_id) : "");
        setPartnerProfileId(c.partner_profile_id ? String(c.partner_profile_id) : "");
        setScheduledAt(c.scheduled_at ? new Date(c.scheduled_at).toISOString().slice(0, 16) : "");
        setDuration(c.duration ? String(c.duration) : "");
        setBaseCost(c.base_cost ? String(c.base_cost) : "");
        setActualCost(c.actual_cost ? String(c.actual_cost) : "");
        setStatus(c.status || "scheduled");

        // Загружаем клиентов
        const clientsRes = await fetch("/api/clients?limit=1000", { cache: "no-store" });
        const clientsData = await clientsRes.json().catch(() => ({ data: [] }));
        setClients(clientsData?.data || []);

        // Загружаем профили для клиента
        if (c.client_id) {
          const profilesRes = await fetch(`/api/profiles?filter[client_id][_eq]=${c.client_id}&limit=1000`, { cache: "no-store" });
          const profilesData = await profilesRes.json().catch(() => ({ data: [] }));
          setProfiles(profilesData?.data || []);
        }

        // Загружаем профили для партнёра
        if (c.partner_client_id) {
          const partnerProfilesRes = await fetch(`/api/profiles?filter[client_id][_eq]=${c.partner_client_id}&limit=1000`, { cache: "no-store" });
          const partnerProfilesData = await partnerProfilesRes.json().catch(() => ({ data: [] }));
          setPartnerProfiles(partnerProfilesData?.data || []);
        }
      } catch (err: any) {
        setError(err.message || "Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  // Загружаем профили при смене клиента
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
        console.error("Error loading profiles:", error);
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

    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        type,
        status,
      };

      if (scheduledAt) payload.scheduled_at = new Date(scheduledAt).toISOString();
      if (duration) payload.duration = Number(duration);
      if (baseCost) payload.base_cost = Number(baseCost);
      if (actualCost) payload.actual_cost = Number(actualCost);
      if (profileId) payload.profile_id = Number(profileId);
      else payload.profile_id = null;

      // Для парных консультаций
      if (type === "partner") {
        if (partnerClientId) payload.partner_client_id = Number(partnerClientId);
        if (partnerProfileId) payload.partner_profile_id = Number(partnerProfileId);
        else payload.partner_profile_id = null;
      } else {
        payload.partner_client_id = null;
        payload.partner_profile_id = null;
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
    <div className="space-y-8 md:space-y-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="page-title text-3xl sm:text-4xl md:text-4xl">Редактировать консультацию</h1>
          <p className="page-subtitle">Измените детали консультации</p>
        </div>
        <Link href={`/consultations/${id}`} className="btn btn-ghost btn-sm">← Назад</Link>
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
          <label>Дата и время</label>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full"
            />
            {scheduledAt && (
              <button
                type="button"
                onClick={() => setScheduledAt("")}
                className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm whitespace-nowrap"
                title="Очистить дату"
              >
                Очистить
              </button>
            )}
          </div>
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
