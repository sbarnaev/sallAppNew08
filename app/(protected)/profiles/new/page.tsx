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
  const [targetText, setTargetText] = useState("");

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
    setLoading(true);
    try {
      const payload: any = {
        type,
        name: name,
        birthday, // YYYY-MM-DD
      };
      if (clientIdParam) payload.clientId = Number(clientIdParam);
      if (type === "target") payload.request = targetText || undefined;

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
          <button
            disabled={loading || !canStart}
            onClick={() => startCalc("base")}
            className="card text-left hover:shadow-md transition disabled:opacity-60"
          >
            <div className="text-lg font-semibold mb-1">Базовый</div>
            <div className="text-sm text-gray-600">Основной расчёт по дате рождения</div>
          </button>

          <div className="card text-left">
            <div className="text-lg font-semibold mb-1">Целевой</div>
            <div className="text-sm text-gray-600 mb-3">Опишите запрос клиента — что именно хотим получить/изменить</div>
            <textarea
              className="w-full rounded-xl border p-3 h-24"
              placeholder="Например: улучшить коммуникацию в команде; найти подход к партнёру; скорректировать карьерный вектор"
              value={targetText}
              onChange={(e)=>setTargetText(e.target.value)}
            />
            <div className="mt-3 flex justify-end">
              <button
                disabled={loading || !canStart || !targetText.trim()}
                onClick={() => startCalc("target")}
                className="rounded-2xl bg-brand-600 text-white px-4 py-2 hover:bg-brand-700 disabled:opacity-60"
              >
                Запустить целевой расчёт
              </button>
            </div>
          </div>

          <button disabled className="card text-left opacity-60 cursor-not-allowed">
            <div className="text-lg font-semibold mb-1">Партнёрский</div>
            <div className="text-sm text-gray-600">Скоро</div>
          </button>
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