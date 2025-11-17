"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";
import { calculateSALCodes, getCodeShortLabel, SALCodes } from "@/lib/sal-codes";
import { getPersonalizedContent, PersonalizedContent, CodeInterpretations } from "@/lib/sal-personalization";

interface ConsultationStep {
  id?: number;
  step_type: string;
  step_order: number;
  question?: string;
  response?: string;
  response_type?: string;
  selected_options?: string[];
}

interface ExpressConsultationFlowProps {
  consultationId: number;
  clientId: number;
}

interface ClientData {
  id: number;
  name: string;
  birth_date: string;
}

type StepType = "point_a" | "point_b" | "resources" | "closing";

const STEP_CONFIG: Record<StepType, { title: string; order: number }> = {
  point_a: { title: "Точка А: Текущая ситуация", order: 1 },
  point_b: { title: "Точка Б: Хотелки и видение", order: 2 },
  resources: { title: "Ресурсы", order: 3 },
  closing: { title: "Закрытие и продажа", order: 4 },
};

export default function ExpressConsultationFlow({
  consultationId,
  clientId,
}: ExpressConsultationFlowProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<StepType>("point_a");
  const [steps, setSteps] = useState<ConsultationStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [salCodes, setSalCodes] = useState<ReturnType<typeof calculateSALCodes> | null>(null);
  const [personalizedContent, setPersonalizedContent] = useState<PersonalizedContent | null>(null);
  const [bookInformation, setBookInformation] = useState<CodeInterpretations | null>(null);

  // Загружаем данные клиента и САЛ коды
  useEffect(() => {
    async function loadClientData() {
      try {
        const res = await fetch(`/api/clients/${clientId}`);
        const data = await res.json().catch(() => ({}));
        if (data?.data) {
          const client = data.data;
          setClientData(client);
          
          // Рассчитываем САЛ коды из даты рождения
          if (client.birth_date) {
            const codes = calculateSALCodes(client.birth_date);
            setSalCodes(codes);
            
            // Генерируем персонализированный контент на основе кодов
            if (codes) {
              const personalized = getPersonalizedContent(codes);
              setPersonalizedContent(personalized);
            }
          }
        }
      } catch (error: any) {
        logger.error("Error loading client data:", error);
      }
    }
    
    loadClientData();
  }, [clientId]);

  // Загружаем сохраненные шаги при монтировании
  useEffect(() => {
    loadSteps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  async function loadSteps() {
    try {
      const res = await fetch(`/api/consultations/express/${consultationId}`);
      const data = await res.json().catch(() => ({}));
      
      // Загружаем трактовки из book_information
      if (data?.bookInformation) {
        setBookInformation(data.bookInformation);
      }
      
      if (data?.steps && Array.isArray(data.steps) && data.steps.length > 0) {
        setSteps(data.steps);
        // Определяем текущий шаг на основе сохраненных данных
        const stepTypes: StepType[] = ["point_a", "point_b", "resources", "closing"];
        const completedSteps = new Set(data.steps.map((s: ConsultationStep) => s.step_type));
        
        // Находим первый незавершенный шаг
        let nextStep: StepType = "point_a";
        for (const stepType of stepTypes) {
          if (!completedSteps.has(stepType)) {
            nextStep = stepType;
            break;
          }
        }
        
        // Если все шаги кроме closing завершены, переходим к closing
        if (completedSteps.has("point_a") && completedSteps.has("point_b") && completedSteps.has("resources")) {
          nextStep = "closing";
        }
        
        setCurrentStep(nextStep);
      }
    } catch (error: any) {
      logger.error("Error loading steps:", error);
      // Не показываем ошибку пользователю, просто не загружаем шаги
    }
  }
  
  // Обновляем персонализированный контент при изменении кодов, трактовок или шагов
  useEffect(() => {
    if (salCodes && bookInformation) {
      // Извлекаем проблемы из Точки А и цели из Точки Б
      const pointAStep = steps.find(s => s.step_type === "point_a");
      const pointBStep = steps.find(s => s.step_type === "point_b");
      
      const pointAProblems = pointAStep?.selected_options || [];
      const pointBGoals = pointBStep?.selected_options || [];
      
      const personalized = getPersonalizedContent(
        salCodes,
        bookInformation,
        pointAProblems,
        pointBGoals
      );
      setPersonalizedContent(personalized);
    } else if (salCodes) {
      // Если трактовок еще нет, используем только коды
      const personalized = getPersonalizedContent(salCodes, {});
      setPersonalizedContent(personalized);
    }
  }, [salCodes, bookInformation, steps]);

  async function saveStep(
    stepType: StepType,
    question: string,
    response: string,
    selectedOptions?: string[]
  ) {
    setSaving(true);
    try {
      const stepOrder = STEP_CONFIG[stepType].order;
      const existingStep = steps.find(
        (s) => s.step_type === stepType && s.step_order === stepOrder
      );

      const stepData = {
        step_type: stepType,
        step_order: stepOrder,
        question,
        response,
        response_type: selectedOptions ? "button" : "text",
        selected_options: selectedOptions || [],
      };

      const res = await fetch(`/api/consultations/express/${consultationId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stepData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.message || "Не удалось сохранить шаг");
      }

      const data = await res.json().catch(() => ({}));
      
      // Обновляем локальное состояние
      // API возвращает { data: { id, ... } } или { id, ... } напрямую
      const stepId = data?.data?.id || data?.id || existingStep?.id;
      const newStep: ConsultationStep = {
        id: stepId,
        ...stepData,
      };

      setSteps((prev) => {
        const filtered = prev.filter(
          (s) => !(s.step_type === stepType && s.step_order === stepOrder)
        );
        return [...filtered, newStep].sort((a, b) => a.step_order - b.step_order);
      });
    } catch (error: any) {
      logger.error("Error saving step:", error);
      const errorMessage = error?.message || "Ошибка сохранения шага";
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  function handleStepComplete(stepType: StepType) {
    const stepTypes: StepType[] = ["point_a", "point_b", "resources", "closing"];
    const currentIndex = stepTypes.indexOf(stepType);
    if (currentIndex < stepTypes.length - 1) {
      setCurrentStep(stepTypes[currentIndex + 1]);
    }
  }

  async function handleConsultationComplete(soldProduct: "full" | "partner" | null, importanceRating?: number) {
    setLoading(true);
    try {
      // 1. Завершаем консультацию
      const res = await fetch(`/api/consultations/express/${consultationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          sold_product: soldProduct,
          importance_rating: importanceRating,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.message || "Ошибка завершения консультации");
      }

      // 2. Если продали продукт, генерируем AI-инсайты (в фоне, не блокируем)
      if (soldProduct) {
        fetch(`/api/consultations/express/${consultationId}/generate-insights`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).catch((error) => {
          logger.warn("Failed to generate insights:", error);
          // Не блокируем завершение, если генерация не удалась
        });
      }

      // 3. Перенаправляем на страницу консультации
      router.push(`/consultations/${consultationId}`);
    } catch (error: any) {
      logger.error("Error completing consultation:", error);
      alert(error.message || "Ошибка завершения консультации");
    } finally {
      setLoading(false);
    }
  }

  const stepTypes: StepType[] = ["point_a", "point_b", "resources", "closing"];

  return (
    <div className="space-y-4">
      {/* Информация о клиенте и САЛ коды */}
      {clientData && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {clientData.name || `Клиент #${clientData.id}`}
              </h2>
              {clientData.birth_date && (
                <div className="text-sm text-gray-600">
                  Дата рождения: {new Date(clientData.birth_date).toLocaleDateString('ru-RU')}
                </div>
              )}
            </div>
          </div>
          
          {salCodes && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-3">Коды САЛ клиента:</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {(['personality', 'connector', 'realization', 'generator', 'mission'] as const).map((key) => (
                  <div key={key} className="flex flex-col items-center gap-2 p-3 bg-white rounded-lg border border-blue-200 shadow-sm">
                    <div className="w-12 h-12 rounded-lg shadow-sm bg-[#1f92aa] text-white font-bold text-xl grid place-items-center">
                      {salCodes[key]}
                    </div>
                    <div className="text-xs font-medium text-gray-700 text-center">
                      {getCodeShortLabel(key)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Аккордеон с шагами */}
      {stepTypes.map((stepType) => {
        const config = STEP_CONFIG[stepType];
        const stepData = steps.find(
          (s) => s.step_type === stepType && s.step_order === config.order
        );
        const isOpen = currentStep === stepType;
        const isCompleted = !!stepData;

        return (
          <div
            key={stepType}
            className="border border-gray-200 rounded-xl overflow-hidden"
          >
            {/* Заголовок шага */}
            <button
              onClick={() => setCurrentStep(stepType)}
              className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isOpen
                      ? "bg-blue-500 text-white"
                      : "bg-gray-300 text-gray-600"
                  }`}
                >
                  {isCompleted ? "✓" : config.order}
                </div>
                <span className="font-medium">{config.title}</span>
              </div>
              <span className="text-gray-400">
                {isOpen ? "▼" : "▶"}
              </span>
            </button>

            {/* Содержимое шага */}
            {isOpen && (
              <div className="p-4 sm:p-6 bg-white">
                {stepType === "point_a" && (
                  <PointAStep
                    stepData={stepData}
                    personalizedContent={personalizedContent}
                    salCodes={salCodes}
                    onSave={(question, response, options) => {
                      saveStep("point_a", question, response, options);
                      handleStepComplete("point_a");
                    }}
                    saving={saving}
                  />
                )}
                {stepType === "point_b" && (
                  <PointBStep
                    stepData={stepData}
                    personalizedContent={personalizedContent}
                    salCodes={salCodes}
                    onSave={(question, response, options) => {
                      saveStep("point_b", question, response, options);
                      handleStepComplete("point_b");
                    }}
                    saving={saving}
                  />
                )}
                {stepType === "resources" && (
                  <ResourcesStep
                    stepData={stepData}
                    personalizedContent={personalizedContent}
                    salCodes={salCodes}
                    onSave={(question, response, options) => {
                      saveStep("resources", question, response, options);
                      handleStepComplete("resources");
                    }}
                    saving={saving}
                  />
                )}
                {stepType === "closing" && (
                  <ClosingStep
                    steps={steps}
                    personalizedContent={personalizedContent}
                    salCodes={salCodes}
                    onComplete={handleConsultationComplete}
                    loading={loading}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Компоненты для каждого шага будут добавлены ниже
function PointAStep({
  stepData,
  personalizedContent,
  salCodes,
  onSave,
  saving,
}: {
  stepData?: ConsultationStep;
  personalizedContent: PersonalizedContent | null;
  salCodes: SALCodes | null;
  onSave: (question: string, response: string, options?: string[]) => void;
  saving: boolean;
}) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
  const [showPhrases, setShowPhrases] = useState(false);

  // Восстанавливаем состояние из сохраненных данных
  useEffect(() => {
    if (stepData) {
      if (stepData.selected_options && stepData.selected_options.length > 0) {
        setSelectedOptions(stepData.selected_options);
        // Если есть selected_options, customText должен быть только дополнительным текстом
        const responseText = stepData.response || "";
        const additionalMatch = responseText.match(/Дополнительно:\s*(.+)/s);
        setCustomText(additionalMatch ? additionalMatch[1].trim() : "");
      } else {
        // Если нет selected_options, значит весь ответ в customText
        setSelectedOptions([]);
        setCustomText(stepData.response || "");
      }
    } else {
      setSelectedOptions([]);
      setCustomText("");
    }
  }, [stepData]);

  // Используем персонализированные опции или базовые
  const options = personalizedContent?.pointAOptions || [
    "Не получается найти клиентов",
    "Низкий доход",
    "Нет мотивации",
    "Проблемы в отношениях",
    "Не понимаю свои сильные стороны",
    "Не могу реализовать потенциал",
    "Постоянные сомнения",
    "Упадок сил",
  ];
  
  // Персонализированные вопросы
  const questions = personalizedContent?.pointAQuestions || [
    "Что не получается? Что вас не устраивает в текущей ситуации?",
  ];
  const mainQuestion = questions[0];
  
  // Готовые фразы для консультанта
  const phrases = personalizedContent?.pointAPhrases || [];

  function handleSave() {
    if (selectedOptions.length === 0 && !customText.trim()) {
      return; // Валидация уже есть в disabled кнопки
    }
    
    const response = selectedOptions.length > 0 
      ? selectedOptions.join(", ") + (customText.trim() ? `\n\nДополнительно: ${customText.trim()}` : "")
      : customText.trim();
    
    onSave(
      mainQuestion,
      response,
      selectedOptions.length > 0 ? selectedOptions : undefined
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="text-gray-700 font-medium mb-2">
          Задача - столкнуть человека с реальностью, чтобы он осознал, что его так больше не устраивает.
        </p>
        {salCodes && (
          <p className="text-sm text-gray-600 mb-3">
            💡 Персонализация на основе САЛ-кодов: Личность {salCodes.personality}, Коннектор {salCodes.connector}, Реализация {salCodes.realization}
          </p>
        )}
        {phrases.length > 0 && (
          <div>
            <button
              onClick={() => setShowPhrases(!showPhrases)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium mb-2"
            >
              {showPhrases ? "▼" : "▶"} Готовые фразы для консультанта ({phrases.length})
            </button>
            {showPhrases && (
              <div className="bg-white rounded-lg border border-blue-200 p-3 space-y-2 max-h-60 overflow-y-auto">
                {phrases.map((phrase, idx) => (
                  <div key={idx} className="text-sm text-gray-700 p-2 bg-gray-50 rounded border border-gray-200">
                    "{phrase}"
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">
          {mainQuestion}
        </label>
        <p className="text-xs text-gray-500 mb-2">Выберите проблемы (можно несколько):</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => {
                setSelectedOptions((prev) =>
                  prev.includes(option)
                    ? prev.filter((o) => o !== option)
                    : [...prev, option]
                );
              }}
              className={`p-3 rounded-lg border text-left transition text-sm sm:text-base ${
                selectedOptions.includes(option)
                  ? "bg-blue-50 border-blue-500 text-blue-700"
                  : "bg-white border-gray-300 hover:border-gray-400"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Дополнительно (опционально):</label>
        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          className="w-full rounded-lg border p-3"
          rows={3}
          placeholder="Добавьте свой текст..."
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving || (selectedOptions.length === 0 && !customText.trim())}
        className="w-full sm:w-auto rounded-lg bg-blue-600 text-white px-6 py-3 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
      >
        {saving ? "Сохранение..." : "Сохранить и перейти дальше"}
      </button>
    </div>
  );
}

function PointBStep({
  stepData,
  personalizedContent,
  salCodes,
  onSave,
  saving,
}: {
  stepData?: ConsultationStep;
  personalizedContent: PersonalizedContent | null;
  salCodes: SALCodes | null;
  onSave: (question: string, response: string, options?: string[]) => void;
  saving: boolean;
}) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
  const [showPhrases, setShowPhrases] = useState(false);

  // Восстанавливаем состояние из сохраненных данных
  useEffect(() => {
    if (stepData) {
      if (stepData.selected_options && stepData.selected_options.length > 0) {
        setSelectedOptions(stepData.selected_options);
        // Если есть selected_options, customText должен быть только дополнительным текстом
        const responseText = stepData.response || "";
        const additionalMatch = responseText.match(/Дополнительно:\s*(.+)/s);
        setCustomText(additionalMatch ? additionalMatch[1].trim() : "");
      } else {
        // Если нет selected_options, значит весь ответ в customText
        setSelectedOptions([]);
        setCustomText(stepData.response || "");
      }
    } else {
      setSelectedOptions([]);
      setCustomText("");
    }
  }, [stepData]);

  // Используем персонализированные опции или базовые
  const options = personalizedContent?.pointBOptions || [
    "Зарабатывать больше денег",
    "Жить в теплой стране",
    "Признание и медийность",
    "Написать книгу",
    "Выступать на сцене",
    "Создать семью",
    "Реализовать творческий потенциал",
    "Помогать другим",
  ];
  
  // Персонализированные вопросы
  const questions = personalizedContent?.pointBQuestions || [
    "К чему вы хотите прийти? Какой результат хотите получить?",
  ];
  const mainQuestion = questions[0];
  
  // Готовые фразы для консультанта
  const phrases = personalizedContent?.pointBPhrases || [];

  function handleSave() {
    if (selectedOptions.length === 0 && !customText.trim()) {
      return;
    }
    
    const response = selectedOptions.length > 0 
      ? selectedOptions.join(", ") + (customText.trim() ? `\n\nДополнительно: ${customText.trim()}` : "")
      : customText.trim();
    
    onSave(
      mainQuestion,
      response,
      selectedOptions.length > 0 ? selectedOptions : undefined
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <p className="text-gray-700 font-medium mb-2">
          Задача - вдохновить человека и показать, что он может прийти к жизни своей мечты.
        </p>
        {salCodes && (
          <p className="text-sm text-gray-600 mb-3">
            💡 Персонализация на основе САЛ-кодов: Реализация {salCodes.realization}, Генератор {salCodes.generator}, Миссия {salCodes.mission}
          </p>
        )}
        {phrases.length > 0 && (
          <div>
            <button
              onClick={() => setShowPhrases(!showPhrases)}
              className="text-sm text-green-600 hover:text-green-700 font-medium mb-2"
            >
              {showPhrases ? "▼" : "▶"} Готовые фразы для консультанта ({phrases.length})
            </button>
            {showPhrases && (
              <div className="bg-white rounded-lg border border-green-200 p-3 space-y-2 max-h-60 overflow-y-auto">
                {phrases.map((phrase, idx) => (
                  <div key={idx} className="text-sm text-gray-700 p-2 bg-gray-50 rounded border border-gray-200">
                    "{phrase}"
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">
          {mainQuestion}
        </label>
        <p className="text-xs text-gray-500 mb-2">Выберите желания (можно несколько):</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => {
                setSelectedOptions((prev) =>
                  prev.includes(option)
                    ? prev.filter((o) => o !== option)
                    : [...prev, option]
                );
              }}
              className={`p-3 rounded-lg border text-left transition ${
                selectedOptions.includes(option)
                  ? "bg-green-50 border-green-500 text-green-700"
                  : "bg-white border-gray-300 hover:border-gray-400"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Дополнительно (опционально):</label>
        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          className="w-full rounded-lg border p-3"
          rows={3}
          placeholder="Опишите свое видение подробнее..."
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving || (selectedOptions.length === 0 && !customText.trim())}
        className="rounded-lg bg-green-600 text-white px-4 py-2 hover:bg-green-700 disabled:opacity-50"
      >
        {saving ? "Сохранение..." : "Сохранить и перейти дальше"}
      </button>
    </div>
  );
}

function ResourcesStep({
  stepData,
  personalizedContent,
  salCodes,
  onSave,
  saving,
}: {
  stepData?: ConsultationStep;
  personalizedContent: PersonalizedContent | null;
  salCodes: SALCodes | null;
  onSave: (question: string, response: string, options?: string[]) => void;
  saving: boolean;
}) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");

  // Восстанавливаем состояние из сохраненных данных
  useEffect(() => {
    if (stepData) {
      if (stepData.selected_options && stepData.selected_options.length > 0) {
        setSelectedOptions(stepData.selected_options);
        // Если есть selected_options, customText должен быть только дополнительным текстом
        const responseText = stepData.response || "";
        const additionalMatch = responseText.match(/Дополнительно:\s*(.+)/s);
        setCustomText(additionalMatch ? additionalMatch[1].trim() : "");
      } else {
        // Если нет selected_options, значит весь ответ в customText
        setSelectedOptions([]);
        setCustomText(stepData.response || "");
      }
    } else {
      setSelectedOptions([]);
      setCustomText("");
    }
  }, [stepData]);

  const availableResources = [
    "Время",
    "Деньги",
    "Навыки",
    "Соцсети и охваты",
    "Люди и связи",
    "Опыт",
  ];

  const offeredResources = [
    "Стратегия реализации",
    "Повышение самоценности",
    "Навык продаж",
    "Правильное мышление",
    "Распаковка и упаковка продукта",
    "Поддержка и сопровождение",
  ];

  function handleSave() {
    const resourcesText = selectedOptions.length > 0 
      ? `Доступные ресурсы: ${selectedOptions.join(", ")}` 
      : "Доступные ресурсы не указаны";
    const response = `${resourcesText}\n\nЧто можем дать мы: ${offeredResources.join(", ")}${customText.trim() ? `\n\nДополнительно: ${customText.trim()}` : ""}`;
    
    onSave(
      "Какие есть ресурсы для перехода из точки А в точку Б?",
      response,
      selectedOptions.length > 0 ? selectedOptions : undefined
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-700 mb-4">
        На этом этапе человек понимает, что ресурсы есть, но либо не понимает как их реализовать, либо видит, что чего-то не хватает.
      </p>
      
      <div>
        <label className="block text-sm font-medium mb-2">Какие ресурсы есть у клиента:</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {availableResources.map((resource) => (
            <button
              key={resource}
              onClick={() => {
                setSelectedOptions((prev) =>
                  prev.includes(resource)
                    ? prev.filter((o) => o !== resource)
                    : [...prev, resource]
                );
              }}
              className={`p-3 rounded-lg border text-left transition ${
                selectedOptions.includes(resource)
                  ? "bg-purple-50 border-purple-500 text-purple-700"
                  : "bg-white border-gray-300 hover:border-gray-400"
              }`}
            >
              {resource}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="font-medium text-blue-900 mb-2">Что мы можем дать:</p>
        <ul className="list-disc list-inside space-y-1 text-blue-800">
          {offeredResources.map((resource) => (
            <li key={resource}>{resource}</li>
          ))}
        </ul>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Дополнительно (опционально):</label>
        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          className="w-full rounded-lg border p-3"
          rows={3}
          placeholder="Добавьте свой текст..."
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full sm:w-auto rounded-lg bg-purple-600 text-white px-6 py-3 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
      >
        {saving ? "Сохранение..." : "Сохранить и перейти к продаже"}
      </button>
    </div>
  );
}

function ClosingStep({
  steps,
  personalizedContent,
  salCodes,
  onComplete,
  loading,
}: {
  steps: ConsultationStep[];
  personalizedContent: PersonalizedContent | null;
  salCodes: SALCodes | null;
  onComplete: (soldProduct: "full" | "partner" | null, importanceRating?: number) => void;
  loading: boolean;
}) {
  const [importanceRating, setImportanceRating] = useState<number>(10);
  const [soldProduct, setSoldProduct] = useState<"full" | "partner" | null>(null);

  const pointA = steps.find((s) => s.step_type === "point_a");
  const pointB = steps.find((s) => s.step_type === "point_b");
  const [showPhrases, setShowPhrases] = useState(false);
  
  // Используем персонализированный оффер или базовый
  const offerText = personalizedContent?.offerTemplate || 
    "Мы сегодня вскрыли только верхушку айсберга, но уже видно, насколько сильно это влияет на разные сферы.\n\nДальше есть два пути, которые реально помогут поменять ситуацию:\n– Личный разбор — на нём мы детально посмотрим на все твои природные ресурсы и скрытые конфликты. Ты получишь конкретную стратегию, как реализовать сильные стороны и обойти внутренние ограничения.\n– Парная консультация — если важна тема отношений, разберём совместимость с партнёром, выясним, как строить гармоничные отношения или найти подходящего человека.\n\nКакой формат тебе сейчас ближе?";
  
  const closingPhrases = personalizedContent?.closingPhrases || [];

  function handleComplete() {
    if (!soldProduct) {
      alert("Выберите, что было продано");
      return;
    }
    onComplete(soldProduct, importanceRating);
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border border-yellow-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Резюме консультации</h3>
        
        {pointA && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Точка А (текущая ситуация):</div>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">{pointA.response}</div>
          </div>
        )}
        
        {pointB && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Точка Б (желания):</div>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">{pointB.response}</div>
          </div>
        )}
        
        {salCodes && (
          <div className="mt-4 pt-4 border-t border-yellow-300">
            <div className="text-sm font-medium text-gray-700 mb-2">САЛ-коды клиента:</div>
            <div className="text-xs text-gray-600">
              Личность {salCodes.personality} · Коннектор {salCodes.connector} · Реализация {salCodes.realization} · Генератор {salCodes.generator} · Миссия {salCodes.mission}
            </div>
          </div>
        )}
      </div>
      
      {/* Персонализированный оффер */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Персонализированное предложение:</h3>
        <div className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{offerText}</div>
        {closingPhrases.length > 0 && (
          <div>
            <button
              onClick={() => setShowPhrases(!showPhrases)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium mb-2"
            >
              {showPhrases ? "▼" : "▶"} Готовые фразы для закрытия ({closingPhrases.length})
            </button>
            {showPhrases && (
              <div className="bg-white rounded-lg border border-blue-200 p-3 space-y-2 max-h-60 overflow-y-auto">
                {closingPhrases.map((phrase, idx) => (
                  <div key={idx} className="text-sm text-gray-700 p-2 bg-gray-50 rounded border border-gray-200">
                    "{phrase}"
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Насколько важно для клиента попасть в точку Б? (1-10)
        </label>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
            <button
              key={rating}
              onClick={() => setImportanceRating(rating)}
              className={`w-10 h-10 rounded-lg border transition text-sm ${
                importanceRating === rating
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white border-gray-300 hover:border-gray-400"
              }`}
            >
              {rating}
            </button>
          ))}
        </div>
        {importanceRating < 7 && (
          <p className="text-sm text-amber-600 mt-2">
            ⚠️ Если важность ниже 7, клиенту может быть сложно помочь
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Что было продано?</label>
        <div className="space-y-2">
          <button
            onClick={() => setSoldProduct("full")}
            className={`w-full p-4 rounded-lg border text-left transition ${
              soldProduct === "full"
                ? "bg-green-50 border-green-500 text-green-700"
                : "bg-white border-gray-300 hover:border-gray-400"
            }`}
          >
            <div className="font-medium">Полная консультация</div>
            <div className="text-sm text-gray-600">
              Детальный разбор всех природных ресурсов и скрытых конфликтов
            </div>
          </button>
          <button
            onClick={() => setSoldProduct("partner")}
            className={`w-full p-4 rounded-lg border text-left transition ${
              soldProduct === "partner"
                ? "bg-green-50 border-green-500 text-green-700"
                : "bg-white border-gray-300 hover:border-gray-400"
            }`}
          >
            <div className="font-medium">Парная консультация</div>
            <div className="text-sm text-gray-600">
              Разбор совместимости с партнером, гармоничные отношения
            </div>
          </button>
          <button
            onClick={() => setSoldProduct(null)}
            className={`w-full p-4 rounded-lg border text-left transition ${
              soldProduct === null
                ? "bg-gray-50 border-gray-400 text-gray-700"
                : "bg-white border-gray-300 hover:border-gray-400"
            }`}
          >
            <div className="font-medium">Ничего не продано</div>
          </button>
        </div>
      </div>

      <button
        onClick={handleComplete}
        disabled={loading}
        className="w-full rounded-lg bg-green-600 text-white px-4 py-3 hover:bg-green-700 disabled:opacity-50 font-medium"
      >
        {loading ? "Завершение..." : "Завершить консультацию"}
      </button>
    </div>
  );
}


