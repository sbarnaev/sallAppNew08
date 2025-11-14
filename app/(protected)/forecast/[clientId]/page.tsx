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
  if (index >= 1.5) return "bg-green-500 text-white"; // Сильный плюс
  if (index >= 0.5) return "bg-green-100 text-green-800"; // Плюс
  if (index >= -0.49) return "bg-gray-50 text-gray-800"; // Нейтраль
  if (index >= -1.49) return "bg-orange-100 text-orange-800"; // Минус
  return "bg-red-500 text-white"; // Сильный минус
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
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
          <Link href={`/clients/${clientId}`} className="text-blue-600 hover:text-blue-700">
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
    <div className="space-y-4 md:space-y-6">
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
            className="rounded-xl border border-gray-300 text-gray-700 px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"
          >
            ← К клиенту
          </Link>
        </div>
      </div>

      {/* Коды клиента */}
      <div className="card p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-semibold mb-4">Коды клиента</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="text-sm text-gray-600 mb-2">Личность</div>
            <div className="text-3xl font-bold text-blue-700">{data.codes.personality}</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-100">
            <div className="text-sm text-gray-600 mb-2">Коннектор</div>
            <div className="text-3xl font-bold text-purple-700">{data.codes.connector}</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
            <div className="text-sm text-gray-600 mb-2">Реализация</div>
            <div className="text-3xl font-bold text-green-700">{data.codes.realization}</div>
          </div>
        </div>
      </div>

      {/* Легенда */}
      <div className="card p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-semibold mb-4">Легенда</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-500 rounded border border-green-600"></div>
            <span>Сильный плюс (≥1.5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-100 rounded border border-green-200"></div>
            <span>Плюс (0.5-1.49)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-50 rounded border border-gray-200"></div>
            <span>Нейтраль (-0.49-0.49)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-100 rounded border border-orange-200"></div>
            <span>Минус (-0.5--1.49)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-500 rounded border border-red-600"></div>
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
              <div key={monthKey} className="card p-3 md:p-6">
                <h2 className="text-lg md:text-xl font-semibold mb-4 capitalize">{monthName}</h2>
                <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0">
                  <div className="grid grid-cols-7 gap-1.5 md:gap-3 min-w-[600px]">
                  {/* Заголовки дней недели */}
                  {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                    <div key={day} className="text-center text-sm md:text-base font-semibold text-gray-700 py-2">
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
                        className={`aspect-square border-2 rounded-lg p-1 md:p-2 flex flex-col min-h-[70px] md:min-h-[90px] ${
                          isToday ? "border-blue-500 ring-2 ring-blue-200 shadow-md" : "border-gray-200"
                        } ${getIndexColor(forecast.index)}`}
                      >
                        <div className="text-xs md:text-sm font-semibold mb-0.5 md:mb-1 flex items-center justify-between">
                          <span>{day}</span>
                          {isToday && <span className="text-blue-600 text-xs md:text-sm">●</span>}
                        </div>
                        {/* Мобильная версия: только общий индекс крупно */}
                        <div className="md:hidden flex-1 flex flex-col justify-center items-center">
                          <div className="font-extrabold text-lg mb-0.5">{forecast.index.toFixed(1)}</div>
                          <div className="text-[8px] leading-tight opacity-75 text-center">
                            <div>Л:{forecast.personality.score.toFixed(1)}</div>
                            <div>К:{forecast.connector.score.toFixed(1)}</div>
                            <div>Р:{forecast.realization.score.toFixed(1)}</div>
                          </div>
                        </div>
                        {/* Десктопная версия: полная информация */}
                        <div className="hidden md:flex flex-1 flex-col justify-center text-xs leading-tight space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="opacity-90 font-medium">Л:</span>
                            <span className="font-bold">{forecast.personality.score.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="opacity-90 font-medium">К:</span>
                            <span className="font-bold">{forecast.connector.score.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="opacity-90 font-medium">Р:</span>
                            <span className="font-bold">{forecast.realization.score.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-current border-opacity-30 pt-1 mt-1">
                            <span className="opacity-95 font-semibold">И:</span>
                            <span className="font-extrabold text-base">{forecast.index.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
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

