"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { TESTS, TestId, ClientTestData, TestResult } from "@/lib/test-types";
import { TestLinkGenerator } from "./TestLinkGenerator";

interface Props {
  clientId: number;
}

export function ClientTestResults({ clientId }: Props) {
  const [testData, setTestData] = useState<ClientTestData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTestData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/clients/${clientId}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({ data: {} }));
        const testirovanieRaw = data?.data?.testirovanie;
        
        let parsedData: ClientTestData = {};
        if (testirovanieRaw) {
          if (typeof testirovanieRaw === "string") {
            try {
              parsedData = JSON.parse(testirovanieRaw);
            } catch (e) {
              console.warn("Failed to parse testirovanie JSON:", e);
            }
          } else if (typeof testirovanieRaw === "object") {
            parsedData = testirovanieRaw;
          }
        }
        setTestData(parsedData);
      } catch (error) {
        console.error("Error loading test data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (clientId) {
      loadTestData();
    }
  }, [clientId]);

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-4">
          <svg className="animate-spin h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }

  if (!testData || Object.keys(testData).length === 0) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Результаты тестирования</h3>
          <Link
            href={`/tests?clientId=${clientId}`}
            className="text-sm text-brand-600 hover:text-brand-700 font-semibold"
          >
            Пройти тест →
          </Link>
        </div>
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900 mb-2">
            💡 <strong>Отправьте ссылку клиенту</strong> - он сможет пройти тест без авторизации
          </p>
          <p className="text-xs text-blue-700">
            Выберите тест ниже и нажмите &quot;Получить ссылку для клиента&quot; чтобы создать одноразовую ссылку
          </p>
        </div>
        <div className="text-center py-8 text-gray-500">
          <p>Пока нет результатов тестирования</p>
          <Link
            href={`/tests?clientId=${clientId}`}
            className="text-brand-600 hover:text-brand-700 text-sm mt-2 inline-block"
          >
            Пройти первый тест
          </Link>
        </div>
      </div>
    );
  }

  const levelColors: Record<string, string> = {
    low: "bg-green-100 border-green-300 text-green-800",
    medium: "bg-yellow-100 border-yellow-300 text-yellow-800",
    high: "bg-orange-100 border-orange-300 text-orange-800",
    critical: "bg-red-100 border-red-300 text-red-800"
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900">Результаты тестирования</h3>
        <Link
          href={`/tests?clientId=${clientId}`}
          className="text-sm text-brand-600 hover:text-brand-700 font-semibold"
        >
          + Пройти тест
        </Link>
      </div>

      <div className="space-y-6">
        {Object.entries(testData).map(([testId, results]) => {
          const test = TESTS[testId as TestId];
          if (!test) return null;

          const sortedResults = [...results].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          const latestResult = sortedResults[0];

          return (
            <div key={testId} className="border-2 border-gray-200 rounded-2xl p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
                    test.color === "orange" ? "bg-gradient-to-br from-orange-500 to-orange-600" :
                    test.color === "blue" ? "bg-gradient-to-br from-blue-500 to-blue-600" :
                    test.color === "red" ? "bg-gradient-to-br from-red-500 to-red-600" :
                    test.color === "yellow" ? "bg-gradient-to-br from-yellow-500 to-yellow-600" :
                    "bg-gradient-to-br from-green-500 to-green-600"
                  }`}>
                    {test.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{test.name}</h4>
                    <p className="text-sm text-gray-500">
                      Пройдено: {results.length} {results.length === 1 ? "раз" : "раза"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Link
                    href={`/tests/${testId}?clientId=${clientId}`}
                    className="text-sm text-brand-600 hover:text-brand-700 font-semibold"
                  >
                    Пройти снова →
                  </Link>
                  <TestLinkGenerator clientId={clientId} testId={testId as TestId} showBirthDateCheckbox={false} />
                </div>
              </div>

              {/* Последний результат */}
              <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    Последний результат: {new Date(latestResult.date).toLocaleDateString("ru-RU")}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${levelColors[latestResult.level]}`}>
                    {latestResult.level === "low" ? "Низкий" : latestResult.level === "medium" ? "Средний" : latestResult.level === "high" ? "Высокий" : "Критический"}
                  </span>
                </div>
                
                {/* Имя и дата рождения, если есть */}
                {(latestResult.clientName || latestResult.birthDate) && (
                  <div className="mb-3 pb-3 border-b border-gray-200">
                    {latestResult.clientName && (
                      <div className="text-sm text-gray-700 mb-1">
                        <span className="font-semibold">Имя:</span> {latestResult.clientName}
                      </div>
                    )}
                    {latestResult.birthDate && (
                      <div className="text-sm text-gray-700">
                        <span className="font-semibold">Дата рождения:</span> {
                          (() => {
                            try {
                              const date = new Date(latestResult.birthDate);
                              if (!isNaN(date.getTime())) {
                                return date.toLocaleDateString("ru-RU");
                              }
                              return latestResult.birthDate; // Fallback на исходное значение
                            } catch {
                              return latestResult.birthDate;
                            }
                          })()
                        }
                      </div>
                    )}
                  </div>
                )}
                
                <div className="text-2xl font-bold text-gray-900">{latestResult.score} баллов</div>
                {latestResult.interpretation && (
                  <div className="text-sm text-gray-700 mt-2">{latestResult.interpretation}</div>
                )}
              </div>

              {/* График динамики (если есть несколько результатов) */}
              {results.length > 1 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-xs font-semibold text-gray-600 mb-2">Динамика:</div>
                  <div className="flex items-end gap-2 h-24">
                    {sortedResults.slice(0, 5).map((r, idx) => {
                      const maxScore = Math.max(...results.map((res) => res.score));
                      const minScore = Math.min(...results.map((res) => res.score));
                      const scoreRange = maxScore - minScore || 1; // Избегаем деления на ноль
                      const normalizedScore = r.score - minScore;
                      const height = (normalizedScore / scoreRange) * 100;
                      const minHeight = 10; // Минимальная высота для видимости
                      const finalHeight = Math.max(height, minHeight);
                      
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                          <div className="relative w-full h-20 flex items-end">
                            <div
                              className={`w-full rounded-t-lg transition-all ${
                                r.level === "low"
                                  ? "bg-green-500"
                                  : r.level === "medium"
                                  ? "bg-yellow-500"
                                  : r.level === "high"
                                  ? "bg-orange-500"
                                  : "bg-red-500"
                              }`}
                              style={{ height: `${finalHeight}%`, minHeight: '8px' }}
                              title={`${r.score} баллов - ${new Date(r.date).toLocaleDateString("ru-RU")}`}
                            />
                          </div>
                          <div className="text-xs text-gray-500 text-center mt-1">
                            {new Date(r.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

