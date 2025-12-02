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

  // Функция для очистки текста от переносов строк и специальных символов
  function cleanText(text: string): string {
    return text
      .replace(/\r\n/g, " ") // Windows переносы
      .replace(/\n/g, " ") // Unix переносы
      .replace(/\r/g, " ") // Mac переносы
      .replace(/\t/g, " ") // Табуляции
      .replace(/[^\x20-\x7E\u0400-\u04FF]/g, " ") // Удаляем все непечатаемые символы кроме пробела и кириллицы/латиницы
      .replace(/\s+/g, " ") // Множественные пробелы в один
      .trim();
  }

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
        // Объединяем все поля в одну строку без переносов и спецсимволов
        const parts = [
          `Что есть сейчас: ${cleanText(targetCurrent)}`,
          `Что клиент хочет: ${cleanText(targetWant)}`
        ];
        if (targetAdditional.trim()) {
          parts.push(`Дополнительная информация: ${cleanText(targetAdditional)}`);
        }
        payload.request = parts.join(" ");
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
        payload.goal = cleanText(partnerGoal);
      }

      const res = await fetch("/api/calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        throw new Error(data?.message || "Calculation failed");
      }
      
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
      const payload = {
        name,
        birthday, // YYYY-MM-DD
        clientId: clientId ? Number(clientId) : undefined,
        type: "base",
      };
      
      const res = await fetch("/api/calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Новый расчёт</h1>
            <p className="text-sm md:text-base text-gray-500 mt-1">Клиент #{clientIdParam}</p>
          </div>
        </div>

        {client && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-grow">
                <div className="font-semibold text-lg text-gray-900">{client.name || "Без имени"}</div>
                <div className="text-sm text-gray-600 mt-1">
                  Дата рождения: {client.birth_date ? new Date(client.birth_date).toLocaleDateString("ru-RU") : "—"}
                </div>
              </div>
            </div>
          </div>
        )}

        {!canStart && (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <div className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm text-amber-800">
              <div className="font-medium mb-1">Автозаполнение данных</div>
              <div>Автозаполняем имя и дату рождения... Если не подтянулось, проверьте данные клиента и повторите попытку.</div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <div className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm text-red-800 font-medium">{error}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Базовый расчет */}
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Базовый</h3>
                <p className="text-sm text-gray-500">Основной расчёт</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6 flex-grow">Полный анализ личности по дате рождения с описанием всех ресурсов, сильных и слабых сторон, конфликтов и практик.</p>
            <button
              disabled={loading || !canStart}
              onClick={() => startCalc("base")}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Запуск...</span>
                </>
              ) : (
                <>
                  <span>Запустить расчёт</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* Целевой расчет */}
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Целевой</h3>
                <p className="text-sm text-gray-500">По запросу клиента</p>
              </div>
            </div>
            
            <div className="space-y-4 flex-grow flex flex-col">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Что есть сейчас <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full rounded-xl border-2 border-gray-200 p-3 text-sm resize-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition"
                  placeholder="Текущая ситуация, проблемы, сложности"
                  value={targetCurrent}
                  onChange={(e) => setTargetCurrent(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Что клиент хочет <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full rounded-xl border-2 border-gray-200 p-3 text-sm resize-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition"
                  placeholder="Желаемый результат, цель, изменения"
                  value={targetWant}
                  onChange={(e) => setTargetWant(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Дополнительная информация
                </label>
                <textarea
                  className="w-full rounded-xl border-2 border-gray-200 p-3 text-sm resize-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition"
                  placeholder="Любая дополнительная информация (необязательно)"
                  value={targetAdditional}
                  onChange={(e) => setTargetAdditional(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            
            <div className="mt-6">
              <button
                disabled={loading || !canStartTarget}
                onClick={() => startCalc("target")}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-3 font-semibold hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Запуск...</span>
                  </>
                ) : (
                  <>
                    <span>Запустить расчёт</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Партнёрский расчет */}
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Партнёрский</h3>
                <p className="text-sm text-gray-500">Для пары</p>
              </div>
            </div>
            
            <div className="space-y-4 flex-grow flex flex-col">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Имя второго человека
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border-2 border-gray-200 p-3 text-sm focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition"
                  placeholder="Имя"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Дата рождения второго человека
                </label>
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full rounded-xl border-2 border-gray-200 p-3 text-sm focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition"
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
                    className="rounded-xl border-2 border-gray-200 p-3 text-sm focus:border-pink-500 focus:ring-2 focus:ring-pink-200 bg-white transition"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Цель расчета
                </label>
                <textarea
                  className="w-full rounded-xl border-2 border-gray-200 p-3 text-sm resize-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition"
                  placeholder="Например: улучшить отношения в семье; найти подход к ребенку; наладить работу с бизнес-партнером"
                  value={partnerGoal}
                  onChange={(e) => setPartnerGoal(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
              
            <div className="mt-6">
              <button
                disabled={loading || !canStartPartner}
                onClick={() => startCalc("partner")}
                className="w-full rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white px-6 py-3 font-semibold hover:from-pink-700 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Запуск...</span>
                  </>
                ) : (
                  <>
                    <span>Запустить расчёт</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
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