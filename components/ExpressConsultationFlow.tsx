"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";
import { calculateSALCodes, getCodeShortLabel, SALCodes } from "@/lib/sal-codes";
import {
  CodeInterpretations,
  PersonalizedContent,
  getPersonalizedContent,
} from "@/lib/sal-personalization";

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
  profileId?: number;
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

const CODE_SECTIONS = [
  { key: "personality", label: "Код личности" },
  { key: "connector", label: "Код коннектора" },
  { key: "realization", label: "Код реализации" },
  { key: "generator", label: "Код генератора" },
  { key: "mission", label: "Код миссии" },
] as const;

type CodeKey = (typeof CODE_SECTIONS)[number]["key"];

const DEFAULT_POINT_A_OPTIONS = [
  "Не получается найти клиентов",
  "Низкий доход",
  "Нет мотивации",
  "Проблемы в отношениях",
  "Не понимаю свои сильные стороны",
  "Не могу реализовать потенциал",
  "Постоянные сомнения",
  "Упадок сил",
];

const DEFAULT_POINT_B_OPTIONS = [
  "Зарабатывать больше денег",
  "Жить в теплой стране",
  "Признание и медийность",
  "Написать книгу",
  "Выступать на сцене",
  "Создать семью",
  "Реализовать творческий потенциал",
  "Помогать другим",
];

function summarizeInterpretation(text?: string | null): string {
  if (!text || typeof text !== "string") return "";
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = clean.match(/[^.!?]+[.!?]?/g);
  if (!sentences) return clean;
  return sentences.slice(0, 2).join(" ").trim();
}

function buildCodeLegends(bookInfo: CodeInterpretations, salCodes?: SALCodes | null) {
  const legends: Record<string, string> = {};
  CODE_SECTIONS.forEach(({ key }) => {
    const legend = summarizeInterpretation(bookInfo[key as keyof CodeInterpretations]);
    if (legend) {
      legends[key] = legend;
    } else if (salCodes?.[key as keyof SALCodes]) {
      legends[key] = `Код ${salCodes[key as keyof SALCodes]} — трактовка еще генерируется.`;
    }
  });
  return legends;
}

export default function ExpressConsultationFlow({
  consultationId,
  clientId,
  profileId: _profileId,
}: ExpressConsultationFlowProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<StepType>("point_a");
  const [steps, setSteps] = useState<ConsultationStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [salCodes, setSalCodes] = useState<SALCodes | null>(null);
  const [bookInformation, setBookInformation] = useState<CodeInterpretations | null>(null);
  const [profileOpener, setProfileOpener] = useState<string | null>(null);
  const [personalizedContent, setPersonalizedContent] = useState<PersonalizedContent | null>(null);
  const [codeLegends, setCodeLegends] = useState<Record<string, string>>({});

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

      if (data?.bookInformation) {
        setBookInformation(data.bookInformation);
      }
      if (data?.profileOpener) {
        setProfileOpener(data.profileOpener);
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
    }
  }

  useEffect(() => {
    if (!salCodes) {
      setPersonalizedContent(null);
      return;
    }

    const pointAStep = steps.find((s) => s.step_type === "point_a");
    const pointBStep = steps.find((s) => s.step_type === "point_b");

    const pointAProblems = pointAStep?.selected_options || [];
    const pointBGoals = pointBStep?.selected_options || [];

    const personalized = getPersonalizedContent(
      salCodes,
      bookInformation || {},
      pointAProblems,
      pointBGoals,
      profileOpener || undefined
    );
    setPersonalizedContent(personalized);
  }, [salCodes, bookInformation, steps, profileOpener]);

  useEffect(() => {
    if (bookInformation && salCodes) {
      setCodeLegends(buildCodeLegends(bookInformation, salCodes));
    } else {
      setCodeLegends({});
    }
  }, [bookInformation, salCodes]);

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
      {/* Opener / персонализированный старт */}
      {personalizedContent?.opener && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Начало консультации</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{personalizedContent.opener}</p>
        </div>
      )}

      {/* Фразы для установления контакта */}
      {personalizedContent?.contactPhrases && personalizedContent.contactPhrases.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">💬 Фразы для установления контакта:</h4>
          <div className="flex flex-wrap gap-2">
            {personalizedContent.contactPhrases.slice(0, 6).map((phrase, idx) => (
              <div key={idx} className="text-xs bg-white rounded px-3 py-2 border border-yellow-200 text-gray-700">
                &quot;{phrase}&quot;
              </div>
            ))}
          </div>
        </div>
      )}

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
              {bookInformation && (
                <div className="mt-6 bg-white/70 rounded-xl border border-blue-100 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Краткий разбор кодов</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {CODE_SECTIONS.map(({ key, label }) => (
                      <div key={key} className="p-3 rounded-lg border border-blue-100 bg-white shadow-sm">
                        <div className="text-sm font-semibold text-gray-800">
                          {label}: {salCodes[key as keyof SALCodes]}
                        </div>
                        <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                          {codeLegends[key] || "Трактовка ещё формируется — обновите страницу через пару секунд."}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${isCompleted
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

// Компоненты шагов

function PointAStep({
  stepData,
  personalizedContent,
  onSave,
  saving,
}: {
  stepData?: ConsultationStep;
  personalizedContent: PersonalizedContent | null;
  onSave: (question: string, response: string, options?: string[]) => void;
  saving: boolean;
}) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
  const [showPhrases, setShowPhrases] = useState(true);

  useEffect(() => {
    if (stepData) {
      if (stepData.selected_options && stepData.selected_options.length > 0) {
        setSelectedOptions(stepData.selected_options);
        const responseText = stepData.response || "";
        const additionalMatch = responseText.match(/Дополнительно:\s*(.+)/s);
        setCustomText(additionalMatch ? additionalMatch[1].trim() : "");
      } else {
        setSelectedOptions([]);
        setCustomText(stepData.response || "");
      }
    }
  }, [stepData]);

  const options =
    personalizedContent?.pointAOptions?.length
      ? personalizedContent.pointAOptions
      : DEFAULT_POINT_A_OPTIONS;

  const mainQuestion =
    personalizedContent?.pointAQuestions?.[0] ||
    "Что не получается? Что вас не устраивает в текущей ситуации?";
  const phrases = personalizedContent?.pointAPhrases || [];

  function handleSave() {
    if (selectedOptions.length === 0 && !customText.trim()) return;

    const response = selectedOptions.length > 0
      ? selectedOptions.join(", ") + (customText.trim() ? `\n\nДополнительно: ${customText.trim()}` : "")
      : customText.trim();

    onSave(mainQuestion, response, selectedOptions.length > 0 ? selectedOptions : undefined);
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="text-gray-700 font-medium mb-2">
          Задача - столкнуть человека с реальностью.
        </p>
        {phrases.length > 0 && (
          <div>
            <button
              onClick={() => setShowPhrases(!showPhrases)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium mb-2"
            >
              {showPhrases ? "▼" : "▶"} Подсказки AI ({phrases.length})
            </button>
            {showPhrases && (
              <div className="bg-white rounded-lg border border-blue-200 p-3 space-y-2 max-h-60 overflow-y-auto">
                {phrases.map((phrase, idx) => (
                  <div key={idx} className="text-sm text-gray-700 p-2 bg-gray-50 rounded border border-gray-200">
                    &quot;{phrase}&quot;
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">{mainQuestion}</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => {
                setSelectedOptions((prev) =>
                  prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
                );
              }}
              className={`p-3 rounded-lg border text-left transition text-sm sm:text-base ${selectedOptions.includes(option)
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
        <label className="block text-sm font-medium mb-2">Дополнительно:</label>
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
        className="w-full sm:w-auto rounded-lg bg-blue-600 text-white px-6 py-3 hover:bg-blue-700 disabled:opacity-50 font-medium"
      >
        {saving ? "Сохранение..." : "Сохранить и перейти дальше"}
      </button>
    </div>
  );
}

function PointBStep({
  stepData,
  personalizedContent,
  onSave,
  saving,
}: {
  stepData?: ConsultationStep;
  personalizedContent: PersonalizedContent | null;
  onSave: (question: string, response: string, options?: string[]) => void;
  saving: boolean;
}) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
  const [showPhrases, setShowPhrases] = useState(true);

  useEffect(() => {
    if (stepData) {
      if (stepData.selected_options && stepData.selected_options.length > 0) {
        setSelectedOptions(stepData.selected_options);
        const responseText = stepData.response || "";
        const additionalMatch = responseText.match(/Дополнительно:\s*(.+)/s);
        setCustomText(additionalMatch ? additionalMatch[1].trim() : "");
      } else {
        setSelectedOptions([]);
        setCustomText(stepData.response || "");
      }
    }
  }, [stepData]);

  const options =
    personalizedContent?.pointBOptions?.length
      ? personalizedContent.pointBOptions
      : DEFAULT_POINT_B_OPTIONS;

  const mainQuestion =
    personalizedContent?.pointBQuestions?.[0] ||
    "К чему вы хотите прийти? Какой результат хотите получить?";
  const phrases = personalizedContent?.pointBPhrases || [];

  function handleSave() {
    if (selectedOptions.length === 0 && !customText.trim()) return;

    const response = selectedOptions.length > 0
      ? selectedOptions.join(", ") + (customText.trim() ? `\n\nДополнительно: ${customText.trim()}` : "")
      : customText.trim();

    onSave(mainQuestion, response, selectedOptions.length > 0 ? selectedOptions : undefined);
  }

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <p className="text-gray-700 font-medium mb-2">
          Задача - вдохновить человека.
        </p>
        {phrases.length > 0 && (
          <div>
            <button
              onClick={() => setShowPhrases(!showPhrases)}
              className="text-sm text-green-600 hover:text-green-700 font-medium mb-2"
            >
              {showPhrases ? "▼" : "▶"} Подсказки AI ({phrases.length})
            </button>
            {showPhrases && (
              <div className="bg-white rounded-lg border border-green-200 p-3 space-y-2 max-h-60 overflow-y-auto">
                {phrases.map((phrase, idx) => (
                  <div key={idx} className="text-sm text-gray-700 p-2 bg-gray-50 rounded border border-gray-200">
                    &quot;{phrase}&quot;
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">{mainQuestion}</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => {
                setSelectedOptions((prev) =>
                  prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
                );
              }}
              className={`p-3 rounded-lg border text-left transition ${selectedOptions.includes(option)
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
        <label className="block text-sm font-medium mb-2">Дополнительно:</label>
        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          className="w-full rounded-lg border p-3"
          rows={3}
          placeholder="Опишите свое видение..."
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

  useEffect(() => {
    if (stepData) {
      if (stepData.selected_options && stepData.selected_options.length > 0) {
        setSelectedOptions(stepData.selected_options);
        const responseText = stepData.response || "";
        const additionalMatch = responseText.match(/Дополнительно:\s*(.+)/s);
        setCustomText(additionalMatch ? additionalMatch[1].trim() : "");
      } else {
        setSelectedOptions([]);
        setCustomText(stepData.response || "");
      }
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

  const resourcesAnalysis =
    personalizedContent?.resourcesAnalysis ||
    "С точки зрения САЛ, у вас есть все необходимые ресурсы для достижения цели. Важно правильно их активировать.";

  const resourcesPhrases = personalizedContent?.resourcesPhrases || [];

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-semibold text-purple-900 mb-2">Анализ ресурсов:</h4>
        <p className="text-sm text-purple-800 whitespace-pre-wrap">{resourcesAnalysis}</p>
        {resourcesPhrases.length > 0 && (
          <div className="mt-3 space-y-2">
            {resourcesPhrases.slice(0, 3).map((phrase, idx) => (
              <div key={idx} className="text-sm text-purple-900 bg-white rounded-lg border border-purple-100 p-2">
                &quot;{phrase}&quot;
              </div>
            ))}
          </div>
        )}
        {salCodes && (
          <p className="text-xs text-purple-700 mt-3">
            💡 Опора на коды: Личность {salCodes.personality}, Коннектор {salCodes.connector}, Реализация {salCodes.realization}, Генератор {salCodes.generator}, Миссия {salCodes.mission}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Какие ресурсы есть у клиента?</label>
        <div className="grid grid-cols-2 gap-2">
          {availableResources.map((res) => (
            <button
              key={res}
              onClick={() => {
                setSelectedOptions((prev) =>
                  prev.includes(res) ? prev.filter((r) => r !== res) : [...prev, res]
                );
              }}
              className={`p-2 rounded border text-sm ${selectedOptions.includes(res)
                  ? "bg-purple-50 border-purple-500 text-purple-700"
                  : "bg-white border-gray-300"
                }`}
            >
              {res}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-sm font-medium mb-2">Что мы можем дать:</p>
        <ul className="list-disc list-inside text-sm text-gray-600">
          {offeredResources.map((res) => (
            <li key={res}>{res}</li>
          ))}
        </ul>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-purple-600 text-white px-4 py-2 hover:bg-purple-700 disabled:opacity-50"
      >
        {saving ? "Сохранение..." : "Сохранить и перейти дальше"}
      </button>
    </div>
  );
}

function ClosingStep({
  steps,
  personalizedContent,
  onComplete,
  loading,
}: {
  steps: ConsultationStep[];
  personalizedContent: PersonalizedContent | null;
  onComplete: (soldProduct: "full" | "partner" | null, importanceRating?: number) => void;
  loading: boolean;
}) {
  const [importance, setImportance] = useState<number>(0);
  const [soldProduct, setSoldProduct] = useState<"full" | "partner" | null>(null);

  const pointA = steps.find((s) => s.step_type === "point_a");
  const pointB = steps.find((s) => s.step_type === "point_b");

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
        <h3 className="font-medium">Итоги:</h3>
        <p className="text-sm"><span className="font-medium">Точка А:</span> {pointA?.response}</p>
        <p className="text-sm"><span className="font-medium">Точка Б:</span> {pointB?.response}</p>
      </div>

      {personalizedContent?.closingPhrases && personalizedContent.closingPhrases.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Фразы для закрытия:</h4>
          <div className="space-y-2">
            {personalizedContent.closingPhrases.map((phrase, idx) => (
              <div key={idx} className="text-sm text-gray-700 bg-white rounded-lg border border-yellow-100 p-2">
                &quot;{phrase}&quot;
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-indigo-900 mb-2">Персонализированный оффер:</h4>
        <p className="text-sm text-indigo-800 whitespace-pre-wrap">
          {personalizedContent?.offerTemplate ||
            "Мы сегодня вскрыли только верхушку айсберга, но уже видно, что можем собрать полноценную стратегию на полной консультации."}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Насколько важно для клиента решить проблему (1-10)?
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <button
              key={num}
              onClick={() => setImportance(num)}
              className={`w-8 h-8 rounded flex items-center justify-center text-sm ${importance === num
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
                }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Результат продажи:</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setSoldProduct("full")}
            className={`p-3 rounded-lg border text-center ${soldProduct === "full"
                ? "bg-green-50 border-green-500 text-green-700"
                : "bg-white border-gray-300"
              }`}
          >
            Личный разбор
          </button>
          <button
            onClick={() => setSoldProduct("partner")}
            className={`p-3 rounded-lg border text-center ${soldProduct === "partner"
                ? "bg-green-50 border-green-500 text-green-700"
                : "bg-white border-gray-300"
              }`}
          >
            Парная консультация
          </button>
          <button
            onClick={() => setSoldProduct(null)}
            className={`p-3 rounded-lg border text-center ${soldProduct === null
                ? "bg-red-50 border-red-500 text-red-700"
                : "bg-white border-gray-300"
              }`}
          >
            Ничего не купил
          </button>
        </div>
      </div>

      <button
        onClick={() => onComplete(soldProduct, importance)}
        disabled={loading || importance === 0}
        className="w-full rounded-lg bg-blue-600 text-white px-6 py-3 hover:bg-blue-700 disabled:opacity-50 font-medium"
      >
        {loading ? "Завершение..." : "Завершить консультацию"}
      </button>
    </div>
  );
}
