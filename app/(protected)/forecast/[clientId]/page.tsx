"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Forecast {
  date: string;
  week_code: number;
  month_code: number;
  personality: {
    code: number;
    steps_week: number;
    steps_month: number;
    t_week: number;
    t_month: number;
    score: number;
  };
  connector: {
    code: number;
    steps_week: number;
    steps_month: number;
    t_week: number;
    t_month: number;
    score: number;
  };
  realization: {
    code: number;
    steps_week: number;
    steps_month: number;
    t_week: number;
    t_month: number;
    score: number;
  };
  index: number;
}

interface ForecastData {
  client: {
    id: number;
    name: string;
    birth_date: string;
  };
  codes: {
    personality: number;
    connector: number;
    realization: number;
    generator: number;
    mission: number;
  };
  forecasts: Forecast[];
  generated_at: string;
}

function getIndexColor(index: number): string {
  if (index >= 1.5) return "bg-green-600 text-white"; // Сильный плюс
  if (index >= 0.5) return "bg-green-200 text-green-900"; // Плюс
  if (index >= -0.49) return "bg-gray-100 text-gray-700"; // Нейтраль
  if (index >= -1.49) return "bg-orange-200 text-orange-900"; // Минус
  return "bg-red-600 text-white"; // Сильный минус
}

function getIndexLabel(index: number): string {
  if (index >= 1.5) return "Сильный плюс";
  if (index >= 0.5) return "Плюс";
  if (index >= -0.49) return "Нейтраль";
  if (index >= -1.49) return "Минус";
  return "Сильный минус";
}

export default function ForecastPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ForecastData | null>(null);

  useEffect(() => {
    async function fetchForecast() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/forecast/${clientId}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Ошибка загрузки прогноза");
        }
        const forecastData = await res.json();
        setData(forecastData);
      } catch (err: any) {
        setError(err.message || "Произошла ошибка");
      } finally {
        setLoading(false);
      }
    }
    fetchForecast();
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка прогноза...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="card">
          <h1 className="text-xl font-semibold text-red-600 mb-2">Ошибка</h1>
          <p className="text-gray-600 mb-4">{error || "Не удалось загрузить прогноз"}</p>
          <Link href={`/clients/${clientId}`} className="text-brand-600 hover:text-brand-700">
            ← Вернуться к клиенту
          </Link>
        </div>
      </div>
    );
  }

  // Группируем прогнозы по месяцам
  const months: Record<string, Forecast[]> = {};
  data.forecasts.forEach((forecast) => {
    const date = new Date(forecast.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!months[monthKey]) months[monthKey] = [];
    months[monthKey].push(forecast);
  });

  // Получаем сегодняшнюю дату для выделения
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Прогностика</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            {data.client.name} • Дата рождения: {new Date(data.client.birth_date).toLocaleDateString("ru-RU")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/clients/${clientId}`}
            className="rounded-xl border border-gray-300 text-gray-700 px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
          >
            ← К клиенту
          </Link>
        </div>
      </div>

      {/* Коды клиента */}
      <div className="card p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-semibold mb-4">Коды клиента</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Личность</div>
            <div className="text-2xl font-bold text-blue-700">{data.codes.personality}</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Коннектор</div>
            <div className="text-2xl font-bold text-purple-700">{data.codes.connector}</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Реализация</div>
            <div className="text-2xl font-bold text-green-700">{data.codes.realization}</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Генератор</div>
            <div className="text-2xl font-bold text-yellow-700">{data.codes.generator}</div>
          </div>
          <div className="text-center p-3 bg-indigo-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Миссия</div>
            <div className="text-2xl font-bold text-indigo-700">{data.codes.mission}</div>
          </div>
        </div>
      </div>

      {/* Легенда */}
      <div className="card p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-semibold mb-4">Легенда</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-600 rounded"></div>
            <span>Сильный плюс (≥1.5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-200 rounded"></div>
            <span>Плюс (0.5-1.49)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-100 rounded"></div>
            <span>Нейтраль (-0.49-0.49)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-200 rounded"></div>
            <span>Минус (-0.5--1.49)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-600 rounded"></div>
            <span>Сильный минус (≤-1.5)</span>
          </div>
        </div>
      </div>

      {/* Календарь по месяцам */}
      <div className="space-y-8">
        {Object.entries(months)
          .sort()
          .map(([monthKey, forecasts]) => {
            const [year, month] = monthKey.split("-");
            const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString("ru-RU", {
              month: "long",
              year: "numeric",
            });

            return (
              <div key={monthKey} className="card p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-semibold mb-4 capitalize">{monthName}</h2>
                <div className="grid grid-cols-7 gap-2">
                  {/* Заголовки дней недели */}
                  {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                    <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
                      {day}
                    </div>
                  ))}

                  {/* Пустые ячейки для выравнивания первого дня месяца */}
                  {(() => {
                    const firstDate = new Date(forecasts[0].date);
                    const firstDay = firstDate.getDay();
                    const offset = firstDay === 0 ? 6 : firstDay - 1; // Пн = 0
                    return Array.from({ length: offset }, (_, i) => (
                      <div key={`empty-${i}`} className="aspect-square"></div>
                    ));
                  })()}

                  {/* Ячейки календаря */}
                  {forecasts.map((forecast) => {
                    const date = new Date(forecast.date);
                    const day = date.getDate();
                    const isToday = forecast.date === todayStr;

                    return (
                      <div
                        key={forecast.date}
                        className={`aspect-square border-2 rounded-lg p-1 flex flex-col ${
                          isToday ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"
                        } ${getIndexColor(forecast.index)}`}
                      >
                        <div className="text-xs font-semibold mb-1 flex items-center justify-between">
                          <span>{day}</span>
                          {isToday && <span className="text-blue-600">●</span>}
                        </div>
                        <div className="flex-1 flex flex-col justify-center text-[10px] leading-tight space-y-0.5">
                          <div className="flex justify-between">
                            <span className="opacity-80">Л:</span>
                            <span className="font-semibold">{forecast.personality.score.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-80">К:</span>
                            <span className="font-semibold">{forecast.connector.score.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-80">Р:</span>
                            <span className="font-semibold">{forecast.realization.score.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between border-t border-current border-opacity-20 pt-0.5 mt-0.5">
                            <span className="opacity-90 font-semibold">И:</span>
                            <span className="font-bold">{forecast.index.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>

      {/* Информация о генерации */}
      <div className="card p-4 md:p-6">
        <p className="text-sm text-gray-500">
          Прогноз рассчитан: {new Date(data.generated_at).toLocaleString("ru-RU")} • Период: 7 дней назад + 83 дня вперед
        </p>
      </div>
    </div>
  );
}

