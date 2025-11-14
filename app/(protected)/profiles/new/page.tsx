"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NewCalculationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientIdParam = searchParams.get("clientId") || "";

  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<any | null>(null);
  const canStart = Boolean(name && birthday);
  // Поля для целевого расчета
  const [targetCurrent, setTargetCurrent] = useState(""); // что есть сейчас
  const [targetWant, setTargetWant] = useState(""); // что клиент хочет
  const [targetAdditional, setTargetAdditional] = useState(""); // доп. информация
  const canStartTarget = Boolean(name && birthday && targetCurrent.trim() && targetWant.trim());
  
  // Поля для партнерского расчета
  const [partnerName, setPartnerName] = useState("");
  const [partnerBirthday, setPartnerBirthday] = useState(""); // формат дд.мм.гггг
  const [partnerGoal, setPartnerGoal] = useState<string>("");
  const canStartPartner = Boolean(name && birthday && partnerName && partnerBirthday && partnerGoal);

  useEffect(() => {
    if (clientIdParam) {
      setClientId(clientIdParam);
      (async () => {
        try {
          const res = await fetch(`/api/clients/${clientIdParam}`);
          const data = await res.json().catch(() => ({}));
          const c = data?.data || null;
          setClient(c);
          if (c?.name) setName(c.name);
          if (c?.birth_date) setBirthday(String(c.birth_date).slice(0, 10));
        } catch {}
      })();
    }
  }, [clientIdParam]);

  async function startCalc(type: "base" | "target" | "partner") {
    setError(null);
    if (!name || !birthday) {
      setError("Нет имени или даты рождения. Подождите автозаполнение или используйте форму ниже.");
      return;
    }
    if (type === "partner") {
      if (!partnerName || !partnerBirthday || !partnerGoal) {
        setError("Для партнерского расчета заполните все поля: имя и дата рождения второго человека, цель расчета.");
        return;
      }
    }
    setLoading(true);
    try {
      const payload: any = {
        type,
        name: name,
        birthday, // YYYY-MM-DD
      };
      if (clientIdParam) payload.clientId = Number(clientIdParam);
      if (type === "target") {
        // Объединяем все поля в одно
        const parts = [
          `Что есть сейчас: ${targetCurrent.trim()}`,
          `Что клиент хочет: ${targetWant.trim()}`
        ];
        if (targetAdditional.trim()) {
          parts.push(`Дополнительная информация: ${targetAdditional.trim()}`);
        }
        payload.request = parts.join("\n\n");
      }
      if (type === "partner") {
        payload.partnerName = partnerName;
        // Преобразуем дд.мм.гггг в YYYY-MM-DD
        const m = partnerBirthday.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (m) {
          const [, dd, mm, yyyy] = m;
          payload.partnerBirthday = `${yyyy}-${mm}-${dd}`;
        } else {
          payload.partnerBirthday = partnerBirthday; // fallback
        }
        payload.goal = partnerGoal;
      }

      const res = await fetch("/api/calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Calculation failed");
      const profileId = data?.profileId || data?.data?.profileId || data?.id;
      if (profileId) router.push(`/profiles/${profileId}`);
      else router.push("/profiles");
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          birthday, // YYYY-MM-DD
          clientId: clientId ? Number(clientId) : undefined,
          type: "base",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Calculation failed");
      }
      const profileId = data?.profileId || data?.data?.profileId || data?.id; // accept common shapes
      if (profileId) {
        router.push(`/profiles/${profileId}`);
      } else {
        router.push("/profiles");
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  // Разрешаем создание расчёта ТОЛЬКО с привязкой к клиенту
  if (clientIdParam) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Новый расчёт для клиента #{clientIdParam}</h1>
        {client && (
          <div className="card text-sm text-gray-600">
            <div className="font-medium text-gray-900">{client.name || "Без имени"}</div>
            <div className="mt-1">Дата рождения: {client.birth_date ? new Date(client.birth_date).toLocaleDateString("ru-RU") : "—"}</div>
          </div>
        )}

        {!canStart && (
          <div className="rounded-xl border p-3 text-sm text-amber-700 bg-amber-50">
            Автозаполняем имя и дату рождения... Если не подтянулось, проверьте данные клиента и повторите попытку.
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Базовый расчет */}
          <div className="card text-left flex flex-col h-full">
            <div className="text-lg font-semibold mb-1">Базовый</div>
            <div className="text-sm text-gray-600 mb-4 flex-grow">Основной расчёт по дате рождения</div>
            <div className="mt-auto">
              <button
                disabled={loading || !canStart}
                onClick={() => startCalc("base")}
                className="w-full rounded-2xl bg-brand-600 text-white px-4 py-2 hover:bg-brand-700 disabled:opacity-60 transition"
              >
                Запустить базовый расчёт
              </button>
            </div>
          </div>

          {/* Целевой расчет */}
          <div className="card text-left flex flex-col h-full">
            <div className="text-lg font-semibold mb-1">Целевой</div>
            <div className="text-sm text-gray-600 mb-3">Опишите запрос клиента</div>
            
            <div className="space-y-3 flex-grow flex flex-col">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Что есть сейчас *</label>
                <textarea
                  className="w-full rounded-xl border border-gray-300 p-2 text-sm resize-none"
                  placeholder="Текущая ситуация, проблемы, сложности"
                  value={targetCurrent}
                  onChange={(e) => setTargetCurrent(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 mb-1">Что клиент хочет *</label>
                <textarea
                  className="w-full rounded-xl border border-gray-300 p-2 text-sm resize-none"
                  placeholder="Желаемый результат, цель, изменения"
                  value={targetWant}
                  onChange={(e) => setTargetWant(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 mb-1">Дополнительная информация</label>
                <textarea
                  className="w-full rounded-xl border border-gray-300 p-2 text-sm resize-none"
                  placeholder="Любая дополнительная информация (необязательно)"
                  value={targetAdditional}
                  onChange={(e) => setTargetAdditional(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            
            <div className="mt-3 flex justify-end">
              <button
                disabled={loading || !canStartTarget}
                onClick={() => startCalc("target")}
                className="rounded-2xl bg-brand-600 text-white px-4 py-2 hover:bg-brand-700 disabled:opacity-60 transition"
              >
                Запустить целевой расчёт
              </button>
            </div>
          </div>

          {/* Партнёрский расчет */}
          <div className="card text-left flex flex-col h-full">
            <div className="text-lg font-semibold mb-1">Партнёрский</div>
            <div className="text-sm text-gray-600 mb-3">Расчёт для пары (два человека)</div>
            
            <div className="space-y-3 flex-grow flex flex-col">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Имя второго человека</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-gray-300 p-2 text-sm"
                  placeholder="Имя"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 mb-1">Дата рождения второго человека</label>
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-gray-300 p-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    placeholder="дд.мм.гггг"
                    value={partnerBirthday}
                    onChange={(e) => {
                      // Маска: DD.MM.YYYY (ввод подряд цифр)
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                      const parts = [digits.slice(0,2), digits.slice(2,4), digits.slice(4,8)].filter(Boolean);
                      const masked = parts.join(".");
                      setPartnerBirthday(masked);
                    }}
                  />
                  <input
                    type="date"
                    className="rounded-xl border border-gray-300 p-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
                    value={(partnerBirthday.match(/^(\d{2})\.(\d{2})\.(\d{4})$/) ? `${partnerBirthday.slice(6,10)}-${partnerBirthday.slice(3,5)}-${partnerBirthday.slice(0,2)}` : "")}
                    onChange={(e) => {
                      const iso = e.target.value; // YYYY-MM-DD
                      if (iso) {
                        const [yyyy, mm, dd] = iso.split("-");
                        setPartnerBirthday(`${dd}.${mm}.${yyyy}`);
                      } else {
                        setPartnerBirthday("");
                      }
                    }}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 mb-1">Цель расчета</label>
                <textarea
                  className="w-full rounded-xl border border-gray-300 p-2 text-sm resize-none"
                  placeholder="Например: улучшить отношения в семье; найти подход к ребенку; наладить работу с бизнес-партнером"
                  value={partnerGoal}
                  onChange={(e) => setPartnerGoal(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
              
            <div className="mt-3 flex justify-end">
              <button
                disabled={loading || !canStartPartner}
                onClick={() => startCalc("partner")}
                className="rounded-2xl bg-brand-600 text-white px-4 py-2 hover:bg-brand-700 disabled:opacity-60 transition"
              >
                Запустить партнёрский расчёт
              </button>
            </div>
          </div>
        </div>

      </div>
    );
  }

  // Без clientId — запрещаем, просим перейти из карточки клиента
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Новый расчёт</h1>
      <div className="card">
        Создавайте расчёт из карточки клиента. Перейдите в раздел «Клиенты», выберите клиента и нажмите «Новый расчёт».
      </div>
    </div>
  );
} 