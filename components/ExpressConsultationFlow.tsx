"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";

interface ExpressConsultationFlowProps {
  consultationId: number;
  clientId: number;
}

interface ScriptData {
  pain: string;
  vision: string;
  solution: string;
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
  const [step, setStep] = useState<"request" | "script">("request");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [customRequest, setCustomRequest] = useState("");
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState<ScriptData | null>(null);

  async function generateScript() {
    if (!selectedTopic && !customRequest) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/consultations/express/${consultationId}/script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedTopic,
          customRequest: customRequest,
        }),
      });

      const data = await res.json();
      if (data?.data) {
        setScript(data.data);
        setStep("script");
      } else {
        alert("Не удалось сгенерировать скрипт. Попробуйте еще раз.");
      }
    } catch (error) {
      logger.error("Error generating script:", error);
      alert("Ошибка генерации скрипта");
    } finally {
      setLoading(false);
    }
  }

  if (step === "request") {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Запрос на экспресс-разбор
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
                if (e.target.value) setSelectedTopic(""); // Clear topic if typing custom
              }}
              placeholder="Например: Хочу понять, почему не могу пробить финансовый потолок..."
              className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
            />
          </div>

          <button
            onClick={generateScript}
            disabled={loading || (!selectedTopic && !customRequest)}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:shadow-none transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Генерация скрипта...
              </span>
            ) : (
              "Сформировать разбор"
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Сценарий разбора</h2>
        <button
          onClick={() => setStep("request")}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          ← Вернуться к запросу
        </button>
      </div>

      {/* Step 1: Pain */}
      <div className="bg-red-50 rounded-xl border border-red-100 overflow-hidden shadow-sm">
        <div className="bg-red-100 px-6 py-4 border-b border-red-200">
          <h3 className="text-lg font-bold text-red-800 flex items-center gap-2">
            1. Актуализация боли (Точка А)
          </h3>
        </div>
        <div className="p-6">
          <p className="text-gray-800 whitespace-pre-wrap text-lg leading-relaxed">
            {script?.pain}
          </p>
          <div className="mt-4 text-sm text-red-600 italic bg-white/50 p-3 rounded">
            💡 Задача: Надавить на больное, показать, что проблема реальна и мешает жить.
          </div>
        </div>
      </div>

      {/* Step 2: Vision */}
      <div className="bg-green-50 rounded-xl border border-green-100 overflow-hidden shadow-sm">
        <div className="bg-green-100 px-6 py-4 border-b border-green-200">
          <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
            2. Видение будущего (Точка Б)
          </h3>
        </div>
        <div className="p-6">
          <p className="text-gray-800 whitespace-pre-wrap text-lg leading-relaxed">
            {script?.vision}
          </p>
          <div className="mt-4 text-sm text-green-600 italic bg-white/50 p-3 rounded">
            💡 Задача: Показать, как может быть круто. Вдохновить результатом.
          </div>
        </div>
      </div>

      {/* Step 3: Solution */}
      <div className="bg-indigo-50 rounded-xl border border-indigo-100 overflow-hidden shadow-sm">
        <div className="bg-indigo-100 px-6 py-4 border-b border-indigo-200">
          <h3 className="text-lg font-bold text-indigo-800 flex items-center gap-2">
            3. Решение через САЛ
          </h3>
        </div>
        <div className="p-6">
          <p className="text-gray-800 whitespace-pre-wrap text-lg leading-relaxed">
            {script?.solution}
          </p>
          <div className="mt-4 text-sm text-indigo-600 italic bg-white/50 p-3 rounded">
            💡 Задача: Объяснить, что именно знание своих кодов поможет перейти из А в Б.
          </div>
        </div>
      </div>

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
