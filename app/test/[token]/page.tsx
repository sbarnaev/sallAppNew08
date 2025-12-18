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
  const [requestBirthDate, setRequestBirthDate] = useState(false); // НОВОЕ
  const [showBirthDateForm, setShowBirthDateForm] = useState(false); // НОВОЕ
  const [birthDateForm, setBirthDateForm] = useState({ // НОВОЕ
    name: "",
    birthDate: ""
  });
  const [formErrors, setFormErrors] = useState<{ name?: string; birthDate?: string }>({}); // НОВОЕ

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
        const shouldRequestBirthDate = Boolean(data.requestBirthDate);
        setRequestBirthDate(shouldRequestBirthDate);
        // НОВОЕ: Если нужно запросить дату рождения, показываем форму в начале
        if (shouldRequestBirthDate) {
          setShowBirthDateForm(true);
        }
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

  // Валидация формы даты рождения
  function validateBirthDateForm() {
    const errors: { name?: string; birthDate?: string } = {};
    
    if (!birthDateForm.name.trim()) {
      errors.name = "Пожалуйста, укажите ваше имя";
    }
    
    if (!birthDateForm.birthDate) {
      errors.birthDate = "Пожалуйста, укажите дату рождения";
    } else {
      // Проверяем формат дд.мм.гггг
      const dateRegex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
      const match = birthDateForm.birthDate.match(dateRegex);
      
      if (!match) {
        errors.birthDate = "Неверный формат даты. Используйте формат дд.мм.гггг";
      } else {
        const [, dd, mm, yyyy] = match;
        const day = parseInt(dd, 10);
        const month = parseInt(mm, 10);
        const year = parseInt(yyyy, 10);
        
        // Проверяем валидность даты
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
          errors.birthDate = "Неверная дата";
        } else if (date > new Date()) {
          errors.birthDate = "Дата рождения не может быть в будущем";
        } else {
          const maxAge = new Date();
          maxAge.setFullYear(maxAge.getFullYear() - 150);
          if (date < maxAge) {
            errors.birthDate = "Неверная дата рождения";
          }
        }
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // НОВОЕ: Отправка формы с данными о рождении (в начале опроса)
  function handleSubmitBirthDateForm() {
    if (!validateBirthDateForm()) {
      return;
    }
    // Закрываем форму и переходим к вопросам теста
    // Данные остаются в birthDateForm и будут конвертированы при сохранении результата
    setShowBirthDateForm(false);
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
          result: testResult,
          // НОВОЕ: Если была форма в начале, передаем данные из нее
          ...(requestBirthDate && birthDateForm.name && birthDateForm.birthDate ? {
            clientName: birthDateForm.name.trim(),
            birthDate: (() => {
              // Конвертируем DD.MM.YYYY в YYYY-MM-DD для API
              const dateMatch = birthDateForm.birthDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
              if (dateMatch) {
                const [, dd, mm, yyyy] = dateMatch;
                return `${yyyy}-${mm}-${dd}`;
              }
              // Если формат уже YYYY-MM-DD, возвращаем как есть
              return birthDateForm.birthDate;
            })()
          } : {})
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save result");
      }
    } catch (error) {
      console.error("Error saving result:", error);
      alert("Ошибка при сохранении результата. Пожалуйста, попробуйте еще раз.");
      setSaving(false);
      setResult(null);
    } finally {
      setSaving(false);
    }
  }

  // НОВОЕ: Форма для сбора данных о дате рождения
  if (showBirthDateForm && !result) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="card p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Информированное согласие</h2>
            
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-gray-700 text-sm leading-relaxed">
                Для оказания психологической помощи в соответствии с требованиями профессиональной этики 
                и стандартами оказания психологических услуг нам необходимо получить ваше информированное 
                согласие. Пожалуйста, укажите ваши данные:
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="client-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Фамилия и Имя <span className="text-red-500">*</span>
                </label>
                <input
                  id="client-name"
                  type="text"
                  value={birthDateForm.name}
                  onChange={(e) => {
                    setBirthDateForm({ ...birthDateForm, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    formErrors.name ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Иванов Иван"
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="birth-date" className="block text-sm font-medium text-gray-700 mb-2">
                  Дата рождения <span className="text-red-500">*</span>
                </label>
                <input
                  id="birth-date"
                  type="text"
                  inputMode="numeric"
                  placeholder="дд.мм.гггг"
                  value={birthDateForm.birthDate}
                  onChange={(e) => {
                    // Маска: DD.MM.YYYY (ввод подряд цифр)
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
                    const masked = parts.join(".");
                    setBirthDateForm({ ...birthDateForm, birthDate: masked });
                    if (formErrors.birthDate) setFormErrors({ ...formErrors, birthDate: undefined });
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    formErrors.birthDate ? "border-red-500" : "border-gray-300"
                  }`}
                />
                {formErrors.birthDate && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.birthDate}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">Формат: дд.мм.гггг (например: 15.05.1990)</p>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={handleSubmitBirthDateForm}
                  disabled={saving}
                  className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
                >
                  {saving ? "Продолжить..." : "Продолжить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
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
                    Результаты теста переданы вашему специалисту.
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
