"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TESTS, TestId, calculateTestResult, TestResult } from "@/lib/test-types";

export default function TakeTestPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const testId = params?.testId as TestId;
  const clientId = searchParams.get("clientId");

  const [test, setTest] = useState(TESTS[testId]);
  const [answers, setAnswers] = useState<Record<number, number | string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [result, setResult] = useState<TestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState<string>("");

  useEffect(() => {
    if (!testId || !TESTS[testId]) {
      router.push("/tests");
      return;
    }
    setTest(TESTS[testId]);
  }, [testId, router]);

  useEffect(() => {
    if (clientId) {
      fetch(`/api/clients/${clientId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.data?.name) {
            setClientName(data.data.name);
          }
        })
        .catch(() => {});
    }
  }, [clientId]);

  if (!test) {
    return (
      <div className="card p-6 text-center">
        <p>Тест не найден</p>
        <Link href="/tests" className="text-brand-600 hover:text-brand-700 mt-4 inline-block">
          ← Вернуться к списку тестов
        </Link>
      </div>
    );
  }

  const question = test.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / test.questions.length) * 100;
  const allAnswered = test.questions.every((q) => answers[q.id] !== undefined);

  function handleAnswer(value: number | string) {
    setAnswers({ ...answers, [question.id]: value });
  }

  function handleNext() {
    if (currentQuestion < test.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else if (allAnswered) {
      handleSubmit();
    }
  }

  function handlePrev() {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  }

  async function handleSubmit() {
    const testResult = calculateTestResult(test, answers);
    setResult(testResult);

    // Сохраняем результат
    if (clientId) {
      setSaving(true);
      try {
        const res = await fetch("/api/tests/save-result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: Number(clientId),
            testId: test.id,
            result: testResult
          })
        });

        if (!res.ok) {
          throw new Error("Failed to save result");
        }
      } catch (error) {
        console.error("Error saving result:", error);
        alert("Ошибка при сохранении результата");
      } finally {
        setSaving(false);
      }
    }
  }

  if (result) {
    const levelColors: Record<string, string> = {
      low: "bg-green-100 border-green-300 text-green-800",
      medium: "bg-yellow-100 border-yellow-300 text-yellow-800",
      high: "bg-orange-100 border-orange-300 text-orange-800",
      critical: "bg-red-100 border-red-300 text-red-800"
    };

    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="card p-8 text-center">
          <div className={`w-20 h-20 mx-auto mb-6 rounded-full border-4 ${levelColors[result.level]} flex items-center justify-center text-4xl`}>
            {test.icon}
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Результат теста</h2>
          {clientName && (
            <p className="text-gray-600 mb-6">Клиент: <span className="font-semibold">{clientName}</span></p>
          )}

          <div className="space-y-6">
            <div>
              <div className="text-5xl font-bold text-gray-900 mb-2">{result.score}</div>
              <div className="text-sm text-gray-500">Баллов</div>
            </div>

            <div className={`inline-block px-6 py-3 rounded-2xl border-2 ${levelColors[result.level]} font-bold text-lg`}>
              {result.interpretation}
            </div>

            {/* Детальная расшифровка результата */}
            {result.detailedInterpretation && (
              <div className="card p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
                <h3 className="font-bold text-gray-900 mb-3 text-lg">Расшифровка результата</h3>
                <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {result.detailedInterpretation}
                </div>
              </div>
            )}

            {/* Дополнительное предупреждение для критических результатов */}
            {result.level === "critical" && (test.id === "depression" || test.id === "anxiety") && (
              <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl">
                <p className="text-sm font-semibold text-red-800 mb-2">⚠️ Рекомендуется срочная консультация специалиста</p>
                <p className="text-xs text-red-700">
                  При наличии суицидальных мыслей или намерений немедленно обратитесь за помощью к специалисту (психиатр, психотерапевт) или в службу экстренной помощи.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4 justify-center mt-8">
            {clientId ? (
              <Link
                href={`/clients/${clientId}`}
                className="rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 text-white px-6 py-3 font-semibold hover:from-brand-700 hover:to-brand-800 shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30 transition-all duration-300"
              >
                Перейти к клиенту
              </Link>
            ) : (
              <Link
                href="/tests"
                className="rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 text-white px-6 py-3 font-semibold hover:from-brand-700 hover:to-brand-800 shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30 transition-all duration-300"
              >
                Вернуться к тестам
              </Link>
            )}
            <button
              onClick={() => {
                setResult(null);
                setAnswers({});
                setCurrentQuestion(0);
              }}
              className="rounded-2xl border border-gray-300/80 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-300"
            >
              Пройти снова
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{test.name}</h1>
          {clientName && (
            <p className="text-gray-600">Клиент: <span className="font-semibold">{clientName}</span></p>
          )}
        </div>
        <Link
          href={clientId ? `/clients/${clientId}` : "/tests"}
          className="text-gray-600 hover:text-gray-900 text-sm font-semibold"
        >
          ← Назад
        </Link>
      </div>

      {/* Важное предупреждение для клинических тестов */}
      {(test.id === "depression" || test.id === "anxiety") && (
        <div className="card p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-xl shrink-0">
              ⚠️
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-2">Важная информация</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                Этот опросник является <strong>скрининговым инструментом</strong> и не заменяет профессиональную диагностику. 
                Результаты предназначены для предварительной оценки и не являются медицинским диагнозом. 
                При высоких баллах или наличии суицидальных мыслей необходимо обратиться к специалисту (психолог, психотерапевт, психиатр).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Прогресс */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">
            Вопрос {currentQuestion + 1} из {test.questions.length}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-brand-600 to-brand-700 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Вопрос */}
      <div className="card p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{question.text}</h2>

        {question.type === "scale" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-6">
              {question.labels?.min && <span>{question.labels.min}</span>}
              {question.labels?.max && <span>{question.labels.max}</span>}
            </div>
            <div className="flex items-center justify-between gap-4">
              {Array.from({ length: (question.max || 5) - (question.min || 1) + 1 }, (_, i) => {
                const value = (question.min || 1) + i;
                const isSelected = answers[question.id] === value;
                return (
                  <button
                    key={value}
                    onClick={() => handleAnswer(value)}
                    className={`flex-1 py-4 rounded-2xl border-2 font-bold text-lg transition-all duration-300 ${
                      isSelected
                        ? "bg-gradient-to-r from-brand-600 to-brand-700 text-white border-brand-600 shadow-lg scale-105"
                        : "bg-white text-gray-700 border-gray-300 hover:border-brand-400 hover:bg-brand-50"
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Навигация */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={handlePrev}
            disabled={currentQuestion === 0}
            className="rounded-2xl border border-gray-300/80 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Назад
          </button>
          <button
            onClick={handleNext}
            disabled={answers[question.id] === undefined}
            className="rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 text-white px-6 py-3 font-semibold hover:from-brand-700 hover:to-brand-800 shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentQuestion === test.questions.length - 1 ? "Завершить" : "Далее →"}
          </button>
        </div>
      </div>
    </div>
  );
}

