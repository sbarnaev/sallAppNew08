"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";

interface ExpressConsultationFlowProps {
  consultationId: number;
  clientId: number;
}

interface ScriptData {
  vision: string;
  solution: string;
  sales_phrases: string[];
}

const TOPICS = [
  "Финансы",
  "Отношения в семье",
  "Найти отношения",
  "Реализация и предназначение",
  "Энергия и здоровье",
  "Общий разбор",
];

export default function ExpressConsultationFlow({
  consultationId,
  clientId,
}: ExpressConsultationFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "diagnostics" | "solution">("request");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [customRequest, setCustomRequest] = useState("");
  const [loading, setLoading] = useState(false);

  // Diagnostics State
  const [hypotheses, setHypotheses] = useState<string[]>([]);
  const [selectedHypotheses, setSelectedHypotheses] = useState<string[]>([]);

  // Solution State
  const [script, setScript] = useState<ScriptData | null>(null);

  async function generateHypotheses() {
    if (!selectedTopic && !customRequest) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/consultations/express/${consultationId}/script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedTopic,
          customRequest: customRequest,
          stage: "diagnostics",
        }),
      });

      const data = await res.json();
      if (data?.data?.hypotheses) {
        setHypotheses(data.data.hypotheses);
        setStep("diagnostics");
      } else {
        alert("Не удалось сгенерировать гипотезы. Попробуйте еще раз.");
      }
    } catch (error) {
      logger.error("Error generating hypotheses:", error);
      alert("Ошибка генерации гипотез");
    } finally {
      setLoading(false);
    }
  }

  async function generateSolution() {
    if (selectedHypotheses.length === 0) {
      alert("Выберите хотя бы одну подтвержденную проблему.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/consultations/express/${consultationId}/script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedTopic,
          customRequest: customRequest,
          stage: "solution",
          confirmedIssues: selectedHypotheses,
        }),
      });

      const data = await res.json();
      if (data?.data) {
        setScript(data.data);
        setStep("solution");
      } else {
        alert("Не удалось сгенерировать решение. Попробуйте еще раз.");
      }
    } catch (error) {
      logger.error("Error generating solution:", error);
      alert("Ошибка генерации решения");
    } finally {
      setLoading(false);
    }
  }

  function toggleHypothesis(hypothesis: string) {
    setSelectedHypotheses(prev =>
      prev.includes(hypothesis)
        ? prev.filter(h => h !== hypothesis)
        : [...prev, hypothesis]
    );
  }

  // STEP 1: REQUEST
  if (step === "request") {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Шаг 1: Запрос клиента
        </h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Выберите тему:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TOPICS.map((topic) => (
                <button
                  key={topic}
                  onClick={() => setSelectedTopic(topic)}
                  className={`p-4 rounded-lg border text-left transition-all ${selectedTopic === topic
                    ? "bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500"
                    : "bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                    }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Или напишите свой запрос:
            </label>
            <textarea
              value={customRequest}
              onChange={(e) => {
                setCustomRequest(e.target.value);
                if (e.target.value) setSelectedTopic("");
              }}
              placeholder="Например: Хочу понять, почему не могу пробить финансовый потолок..."
              className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
            />
          </div>

          <button
            onClick={generateHypotheses}
            disabled={loading || (!selectedTopic && !customRequest)}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:shadow-none transition-all"
          >
            {loading ? "Анализируем профиль..." : "Начать диагностику →"}
          </button>
        </div>
      </div>
    );
  }

  // STEP 2: DIAGNOSTICS
  if (step === "diagnostics") {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Шаг 2: Диагностика (Точка А)
          </h2>
          <button
            onClick={() => setStep("request")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Назад
          </button>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-100">
          <p className="text-blue-800 text-sm font-medium">
            💡 Задайте эти вопросы клиенту. Отметьте те, на которые он ответил &quot;Да&quot; или которые вызвали эмоциональный отклик.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {hypotheses.map((hypothesis, idx) => (
            <label
              key={idx}
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${selectedHypotheses.includes(hypothesis)
                ? "bg-blue-50 border-blue-500 ring-1 ring-blue-500"
                : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
            >
              <input
                type="checkbox"
                checked={selectedHypotheses.includes(hypothesis)}
                onChange={() => toggleHypothesis(hypothesis)}
                className="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-gray-800">{hypothesis}</span>
            </label>
          ))}
        </div>

        <button
          onClick={generateSolution}
          disabled={loading || selectedHypotheses.length === 0}
          className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:shadow-none transition-all"
        >
          {loading ? "Формируем решение..." : "Сформировать решение →"}
        </button>
      </div>
    );
  }

  // STEP 3: SOLUTION
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Шаг 3: Решение и Продажа</h2>
        <button
          onClick={() => setStep("diagnostics")}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          ← Вернуться к диагностике
        </button>
      </div>

      {/* Vision (Point B) */}
      <div className="bg-green-50 rounded-xl border border-green-100 overflow-hidden shadow-sm">
        <div className="bg-green-100 px-6 py-4 border-b border-green-200">
          <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
            ✨ Точка Б (Видение)
          </h3>
        </div>
        <div className="p-6">
          <p className="text-gray-800 whitespace-pre-wrap text-lg leading-relaxed">
            {script?.vision}
          </p>
        </div>
      </div>

      {/* Solution (SAL) */}
      <div className="bg-indigo-50 rounded-xl border border-indigo-100 overflow-hidden shadow-sm">
        <div className="bg-indigo-100 px-6 py-4 border-b border-indigo-200">
          <h3 className="text-lg font-bold text-indigo-800 flex items-center gap-2">
            🔑 Решение через САЛ
          </h3>
        </div>
        <div className="p-6">
          <p className="text-gray-800 whitespace-pre-wrap text-lg leading-relaxed">
            {script?.solution}
          </p>
        </div>
      </div>

      {/* Sales Phrases */}
      {script?.sales_phrases && script.sales_phrases.length > 0 && (
        <div className="bg-yellow-50 rounded-xl border border-yellow-100 overflow-hidden shadow-sm">
          <div className="bg-yellow-100 px-6 py-4 border-b border-yellow-200">
            <h3 className="text-lg font-bold text-yellow-800 flex items-center gap-2">
              💬 Продающие фразы
            </h3>
          </div>
          <div className="p-6">
            <ul className="space-y-3">
              {script.sales_phrases.map((phrase, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="text-yellow-600 mt-1">➜</span>
                  <span className="text-gray-800 text-lg font-medium">&quot;{phrase}&quot;</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex justify-center pt-6">
        <button
          onClick={() => router.push(`/consultations/${consultationId}`)}
          className="px-8 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium transition-colors"
        >
          Завершить разбор
        </button>
      </div>
    </div>
  );
}
