"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

  // Загружаем сохраненные шаги при монтировании
  useEffect(() => {
    loadSteps();
  }, [consultationId]);

  async function loadSteps() {
    try {
      const res = await fetch(`/api/consultations/express/${consultationId}`);
      const data = await res.json().catch(() => ({}));
      if (data?.steps) {
        setSteps(data.steps);
        // Определяем текущий шаг на основе сохраненных данных
        const lastStep = data.steps[data.steps.length - 1];
        if (lastStep?.step_type) {
          const stepTypes: StepType[] = ["point_a", "point_b", "resources", "closing"];
          const currentIndex = stepTypes.indexOf(lastStep.step_type as StepType);
          if (currentIndex < stepTypes.length - 1) {
            setCurrentStep(stepTypes[currentIndex + 1]);
          } else {
            setCurrentStep("closing");
          }
        }
      }
    } catch (error) {
      console.error("Error loading steps:", error);
    }
  }

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
        throw new Error("Не удалось сохранить шаг");
      }

      const data = await res.json().catch(() => ({}));
      
      // Обновляем локальное состояние
      const newStep: ConsultationStep = {
        id: data?.data?.id,
        ...stepData,
      };

      setSteps((prev) => {
        const filtered = prev.filter(
          (s) => !(s.step_type === stepType && s.step_order === stepOrder)
        );
        return [...filtered, newStep];
      });
    } catch (error) {
      console.error("Error saving step:", error);
      alert("Ошибка сохранения шага");
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

  function handleConsultationComplete(soldProduct: "full" | "partner" | null, importanceRating?: number) {
    setLoading(true);
    fetch(`/api/consultations/express/${consultationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "completed",
        sold_product: soldProduct,
        importance_rating: importanceRating,
      }),
    })
      .then((res) => {
        if (res.ok) {
          router.push(`/consultations/${consultationId}`);
        } else {
          alert("Ошибка завершения консультации");
        }
      })
      .catch((error) => {
        console.error("Error completing consultation:", error);
        alert("Ошибка завершения консультации");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  const stepTypes: StepType[] = ["point_a", "point_b", "resources", "closing"];

  return (
    <div className="space-y-4">
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
              className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
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
              <div className="p-6 bg-white">
                {stepType === "point_a" && (
                  <PointAStep
                    stepData={stepData}
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
  onSave,
  saving,
}: {
  stepData?: ConsultationStep;
  onSave: (question: string, response: string, options?: string[]) => void;
  saving: boolean;
}) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(
    stepData?.selected_options || []
  );
  const [customText, setCustomText] = useState(stepData?.response || "");

  const options = [
    "Не получается найти клиентов",
    "Низкий доход",
    "Нет мотивации",
    "Проблемы в отношениях",
    "Не понимаю свои сильные стороны",
    "Не могу реализовать потенциал",
    "Постоянные сомнения",
    "Упадок сил",
  ];

  function handleSave() {
    const response = selectedOptions.length > 0 
      ? selectedOptions.join(", ") + (customText ? `\n\nДополнительно: ${customText}` : "")
      : customText;
    
    onSave(
      "Что не получается? Что вас не устраивает в текущей ситуации?",
      response,
      selectedOptions
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-700 mb-4">
        Задача - столкнуть человека с реальностью, чтобы он осознал, что его так больше не устраивает.
      </p>
      
      <div>
        <label className="block text-sm font-medium mb-2">Выберите проблемы (можно несколько):</label>
        <div className="grid grid-cols-2 gap-2">
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
        className="rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Сохранение..." : "Сохранить и перейти дальше"}
      </button>
    </div>
  );
}

function PointBStep({
  stepData,
  onSave,
  saving,
}: {
  stepData?: ConsultationStep;
  onSave: (question: string, response: string, options?: string[]) => void;
  saving: boolean;
}) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(
    stepData?.selected_options || []
  );
  const [customText, setCustomText] = useState(stepData?.response || "");

  const options = [
    "Зарабатывать больше денег",
    "Жить в теплой стране",
    "Признание и медийность",
    "Написать книгу",
    "Выступать на сцене",
    "Создать семью",
    "Реализовать творческий потенциал",
    "Помогать другим",
  ];

  function handleSave() {
    const response = selectedOptions.length > 0 
      ? selectedOptions.join(", ") + (customText ? `\n\nДополнительно: ${customText}` : "")
      : customText;
    
    onSave(
      "К чему вы хотите прийти? Какой результат вы хотите получить?",
      response,
      selectedOptions
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-700 mb-4">
        Задача - вдохновить человека и показать, что он может прийти к жизни своей мечты.
      </p>
      
      <div>
        <label className="block text-sm font-medium mb-2">Выберите желания (можно несколько):</label>
        <div className="grid grid-cols-2 gap-2">
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
  onSave,
  saving,
}: {
  stepData?: ConsultationStep;
  onSave: (question: string, response: string, options?: string[]) => void;
  saving: boolean;
}) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(
    stepData?.selected_options || []
  );
  const [customText, setCustomText] = useState(stepData?.response || "");

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
    const response = `Доступные ресурсы: ${selectedOptions.join(", ")}\n\nЧто можем дать мы: ${offeredResources.join(", ")}${customText ? `\n\nДополнительно: ${customText}` : ""}`;
    
    onSave(
      "Какие есть ресурсы для перехода из точки А в точку Б?",
      response,
      selectedOptions
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-700 mb-4">
        На этом этапе человек понимает, что ресурсы есть, но либо не понимает как их реализовать, либо видит, что чего-то не хватает.
      </p>
      
      <div>
        <label className="block text-sm font-medium mb-2">Какие ресурсы есть у клиента:</label>
        <div className="grid grid-cols-2 gap-2">
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
        className="rounded-lg bg-purple-600 text-white px-4 py-2 hover:bg-purple-700 disabled:opacity-50"
      >
        {saving ? "Сохранение..." : "Сохранить и перейти к продаже"}
      </button>
    </div>
  );
}

function ClosingStep({
  steps,
  onComplete,
  loading,
}: {
  steps: ConsultationStep[];
  onComplete: (soldProduct: "full" | "partner" | null, importanceRating?: number) => void;
  loading: boolean;
}) {
  const [importanceRating, setImportanceRating] = useState<number>(10);
  const [soldProduct, setSoldProduct] = useState<"full" | "partner" | null>(null);

  const pointA = steps.find((s) => s.step_type === "point_a");
  const pointB = steps.find((s) => s.step_type === "point_b");

  function handleComplete() {
    if (!soldProduct) {
      alert("Выберите, что было продано");
      return;
    }
    onComplete(soldProduct, importanceRating);
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium mb-2">Резюме консультации:</h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Точка А:</span> {pointA?.response || "Не заполнено"}
          </div>
          <div>
            <span className="font-medium">Точка Б:</span> {pointB?.response || "Не заполнено"}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Насколько важно для клиента попасть в точку Б? (1-10)
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
            <button
              key={rating}
              onClick={() => setImportanceRating(rating)}
              className={`w-10 h-10 rounded-lg border transition ${
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

