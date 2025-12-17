"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { TESTS, TestId, calculateTestResult, TestResult } from "@/lib/test-types";

export default function PublicTestPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [test, setTest] = useState<typeof TESTS[TestId] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number | string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [result, setResult] = useState<TestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setError("Токен не найден");
      setLoading(false);
      return;
    }

    // Проверяем токен и получаем информацию о тесте
    fetch(`/api/tests/verify-token?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.valid || data.used || data.expired) {
          setError(data.message || "Токен недействителен, использован или истек срок действия");
          setLoading(false);
          return;
        }

        const testId = data.testId as TestId;
        const testData = TESTS[testId];

        if (!testData) {
          setError("Тест не найден");
          setLoading(false);
          return;
        }

        setTest(testData);
        setClientName(data.clientName || "");
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error verifying token:", err);
        setError("Ошибка при проверке токена");
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка теста...</p>
        </div>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Ошибка</h2>
          <p className="text-gray-600 mb-6">{error || "Тест не найден"}</p>
          <p className="text-sm text-gray-500">
            Возможно, ссылка недействительна или тест уже был пройден.
          </p>
        </div>
      </div>
    );
  }

  // TypeScript guard: test is definitely not null here
  const currentTest = test;
  
  const question = currentTest.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / currentTest.questions.length) * 100;
  const allAnswered = currentTest.questions.every((q) => answers[q.id] !== undefined);

  function handleAnswer(value: number | string) {
    setAnswers({ ...answers, [question.id]: value });
  }

  function handleNext() {
    if (currentQuestion < currentTest.questions.length - 1) {
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
    const testResult = calculateTestResult(currentTest, answers);
    setResult(testResult);

    // Сохраняем результат через токен
    setSaving(true);
    try {
      const res = await fetch("/api/tests/submit-by-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testToken: token,
          result: testResult
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save result");
      }
    } catch (error) {
      console.error("Error saving result:", error);
      alert("Ошибка при сохранении результата. Пожалуйста, попробуйте еще раз.");
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="space-y-6">
            <div className="card p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full border-4 bg-green-100 border-green-300 flex items-center justify-center text-4xl">
                ✅
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Спасибо!</h2>

              <div className="space-y-6">
                <div className="p-6 bg-green-50 border border-green-200 rounded-2xl">
                  <p className="text-lg text-green-900 font-semibold mb-2">
                    Ваши ответы успешно отправлены
                  </p>
                  <p className="text-gray-700">
                    Результаты теста переданы вашему специалисту. Он свяжется с вами при необходимости.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="space-y-6">
          {/* Заголовок */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{currentTest.name}</h1>
          </div>

          {/* Важное предупреждение для клинических тестов */}
          {(currentTest.id === "depression" || currentTest.id === "anxiety") && (
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
                Вопрос {currentQuestion + 1} из {currentTest.questions.length}
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
                disabled={answers[question.id] === undefined || saving}
                className="rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 text-white px-6 py-3 font-semibold hover:from-brand-700 hover:to-brand-800 shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Сохранение..." : currentQuestion === currentTest.questions.length - 1 ? "Завершить" : "Далее →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
