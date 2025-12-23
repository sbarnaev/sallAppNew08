/**
 * Валидация результатов генерации консультаций
 * Проверяет структуру и корректность данных согласно схемам
 */

import { logger } from "./logger";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Валидация базового расчета
 */
export function validateBaseConsultation(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Данные не являются объектом"], warnings: [] };
  }

  // Проверка обязательных полей
  const requiredFields = [
    "opener",
    "coreTask",
    "strengths",
    "weaknesses",
    "resourceSignals",
    "deficitSignals",
    "keyConflicts",
    "levers",
    "focusNow",
    "consultantQuestions",
  ];

  for (const field of requiredFields) {
    if (!(field in data)) {
      errors.push(`Отсутствует обязательное поле: ${field}`);
    }
  }

  // Проверка длин массивов
  const checkArrayLength = (arr: any, min: number, max: number, name: string) => {
    if (!Array.isArray(arr)) {
      errors.push(`Поле ${name} должно быть массивом`);
      return;
    }
    if (arr.length < min || arr.length > max) {
      errors.push(
        `Поле ${name} нарушает ограничения: ${arr.length} элементов (ожидалось ${min}–${max})`
      );
    }
  };

  // Проверка строковых полей
  if (data.opener && typeof data.opener !== "string") {
    errors.push("Поле opener должно быть строкой");
  }
  if (data.coreTask && typeof data.coreTask !== "string") {
    errors.push("Поле coreTask должно быть строкой");
  }
  if (data.focusNow && typeof data.focusNow !== "string") {
    errors.push("Поле focusNow должно быть строкой");
  }

  checkArrayLength(data.strengths, 7, 7, "strengths");
  checkArrayLength(data.weaknesses, 7, 7, "weaknesses");
  checkArrayLength(data.resourceSignals, 10, 10, "resourceSignals");
  checkArrayLength(data.deficitSignals, 10, 10, "deficitSignals");
  checkArrayLength(data.keyConflicts, 2, 2, "keyConflicts");
  checkArrayLength(data.levers, 3, 3, "levers");
  checkArrayLength(data.consultantQuestions, 3, 3, "consultantQuestions");

  // Проверка структуры keyConflicts
  if (data.keyConflicts && Array.isArray(data.keyConflicts)) {
    data.keyConflicts.forEach((conflict: any, index: number) => {
      if (!conflict || typeof conflict !== "object") {
        errors.push(`keyConflicts[${index}] должен быть объектом`);
        return;
      }
      if (!conflict.type || !conflict.description || !conflict.manifestations || !conflict.whyStuck) {
        errors.push(`keyConflicts[${index}] должен содержать type, description, manifestations и whyStuck`);
      }
      if (conflict.type && !["ОСНОВНОЙ КОНФЛИКТ", "ВТОРИЧНЫЙ КОНФЛИКТ"].includes(conflict.type)) {
        errors.push(`keyConflicts[${index}].type должен быть "ОСНОВНОЙ КОНФЛИКТ" или "ВТОРИЧНЫЙ КОНФЛИКТ"`);
      }
      if (!Array.isArray(conflict.manifestations)) {
        errors.push(`keyConflicts[${index}].manifestations должен быть массивом`);
      }
    });
  }

  // Проверка на смешивание weaknesses и resourceSignals
  if (data.weaknesses && Array.isArray(data.weaknesses)) {
    const hasResourceSignalsPattern = data.weaknesses.some(
      (w: any) =>
        typeof w === "string" &&
        (w.includes("признак активной") ||
          w.includes("признак дефицита") ||
          w.includes("Вы легко начинаете") ||
          w.includes("Вы держите слово"))
    );
    if (hasResourceSignalsPattern) {
      warnings.push(
        "В weaknesses обнаружены паттерны resourceSignals. Возможно, модель перепутала поля."
      );
    }
  }

  if (data.resourceSignals && Array.isArray(data.resourceSignals)) {
    const hasWeaknessesPattern = data.resourceSignals.some(
      (r: any) =>
        typeof r === "string" &&
        ((r.includes("риск") && !r.includes("признак")) ||
          r.includes("может мешать") ||
          r.includes("сложности"))
    );
    if (hasWeaknessesPattern) {
      warnings.push(
        "В resourceSignals обнаружены паттерны weaknesses. Возможно, модель перепутала поля."
      );
    }
  }


  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Валидация целевого расчета
 */
export function validateTargetConsultation(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Данные не являются объектом"], warnings: [] };
  }

  // Проверка обязательных полей
  const requiredFields = [
    "warnings",
    "goalDecomposition",
    "resourcesForStages",
    "currentDiagnostics",
    "plan123",
    "progressMetrics",
    "whatIf",
    "objectionHandling",
    "finalStrategy",
  ];

  for (const field of requiredFields) {
    if (!(field in data)) {
      errors.push(`Отсутствует обязательное поле: ${field}`);
    }
  }

  // Проверка plan123 - должно быть ровно 3 этапа
  if (!Array.isArray(data.plan123) || data.plan123.length !== 3) {
    errors.push(
      `Поле plan123 должно содержать ровно 3 этапа, получено: ${data.plan123?.length || 0}`
    );
  }

  // Проверка finalStrategy - должно быть ровно 3 абзаца
  if (!Array.isArray(data.finalStrategy) || data.finalStrategy.length !== 3) {
    errors.push(
      `Поле finalStrategy должно содержать ровно 3 абзаца, получено: ${data.finalStrategy?.length || 0}`
    );
  }

  // Проверка currentDiagnostics структуры
  if (data.currentDiagnostics) {
    if (!Array.isArray(data.currentDiagnostics.resourceStates)) {
      errors.push("currentDiagnostics.resourceStates должен быть массивом");
    }
    if (!data.currentDiagnostics.readiness || typeof data.currentDiagnostics.readiness !== "object") {
      errors.push("currentDiagnostics.readiness должен быть объектом");
    }
    if (!Array.isArray(data.currentDiagnostics.questions)) {
      errors.push("currentDiagnostics.questions должен быть массивом");
    }
  }

  // Проверка progressMetrics структуры
  if (data.progressMetrics) {
    const requiredMetrics = ["earlySignals", "midSignals", "resultSignals"];
    for (const metric of requiredMetrics) {
      if (!Array.isArray(data.progressMetrics[metric])) {
        errors.push(`progressMetrics.${metric} должен быть массивом`);
      }
    }
  }

  // Проверка whatIf структуры
  if (data.whatIf) {
    const requiredWhatIf = ["fatigue", "overwhelm", "relapse", "pitfalls"];
    for (const key of requiredWhatIf) {
      if (!Array.isArray(data.whatIf[key])) {
        errors.push(`whatIf.${key} должен быть массивом`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Валидация партнерского расчета
 */
export function validatePartnerConsultation(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Данные не являются объектом"], warnings: [] };
  }

  // Проверка обязательных полей
  const requiredFields = [
    "warnings",
    "goalDecomposition",
    "resourcesForStages",
    "compatibility",
    "currentDiagnostics",
    "plan123",
    "progressMetrics",
    "whatIf",
    "objectionHandling",
    "finalStrategy",
  ];

  for (const field of requiredFields) {
    if (!(field in data)) {
      errors.push(`Отсутствует обязательное поле: ${field}`);
    }
  }

  // Проверка plan123 - должно быть ровно 3 этапа
  if (!Array.isArray(data.plan123) || data.plan123.length !== 3) {
    errors.push(
      `Поле plan123 должно содержать ровно 3 этапа, получено: ${data.plan123?.length || 0}`
    );
  }

  // Проверка finalStrategy - должно быть ровно 3 абзаца
  if (!Array.isArray(data.finalStrategy) || data.finalStrategy.length !== 3) {
    errors.push(
      `Поле finalStrategy должно содержать ровно 3 абзаца, получено: ${data.finalStrategy?.length || 0}`
    );
  }

  // Проверка compatibility структуры
  if (data.compatibility) {
    if (!Array.isArray(data.compatibility.complementary)) {
      errors.push("compatibility.complementary должен быть массивом");
    }
    if (!Array.isArray(data.compatibility.conflicts)) {
      errors.push("compatibility.conflicts должен быть массивом");
    }
  }

  // Проверка currentDiagnostics структуры
  if (data.currentDiagnostics) {
    if (!data.currentDiagnostics.firstParticipant || !data.currentDiagnostics.secondParticipant) {
      errors.push("currentDiagnostics должен содержать firstParticipant и secondParticipant");
    }
    if (!Array.isArray(data.currentDiagnostics.conflictZones)) {
      errors.push("currentDiagnostics.conflictZones должен быть массивом");
    }
    if (!data.currentDiagnostics.readiness || typeof data.currentDiagnostics.readiness !== "object") {
      errors.push("currentDiagnostics.readiness должен быть объектом");
    }
    if (!Array.isArray(data.currentDiagnostics.questions)) {
      errors.push("currentDiagnostics.questions должен быть массивом");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Валидация детского расчета
 */
export function validateChildConsultation(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Данные не являются объектом"], warnings: [] };
  }

  // Проверка обязательных полей
  const requiredFields = [
    "opener",
    "childPotential",
    "developmentFeatures",
    "upbringingRecommendations",
    "educationalApproach",
    "communicationStyle",
    "challengesAndSolutions",
    "activitiesAndHobbies",
    "parentChildInteraction",
    "futureProspects",
  ];

  for (const field of requiredFields) {
    if (!(field in data)) {
      errors.push(`Отсутствует обязательное поле: ${field}`);
    }
  }

  // Проверка длин массивов
  const checkArrayLength = (arr: any, min: number, max: number, name: string) => {
    if (!Array.isArray(arr)) {
      errors.push(`Поле ${name} должно быть массивом`);
      return;
    }
    if (arr.length < min || arr.length > max) {
      errors.push(
        `Поле ${name} нарушает ограничения: ${arr.length} элементов (ожидалось ${min}–${max})`
      );
    }
  };

  checkArrayLength(data.childPotential, 3, 5, "childPotential");
  checkArrayLength(data.developmentFeatures, 5, 7, "developmentFeatures");
  checkArrayLength(data.upbringingRecommendations, 7, 10, "upbringingRecommendations");
  checkArrayLength(data.educationalApproach, 5, 7, "educationalApproach");
  checkArrayLength(data.communicationStyle, 3, 5, "communicationStyle");
  checkArrayLength(data.challengesAndSolutions, 5, 7, "challengesAndSolutions");
  checkArrayLength(data.activitiesAndHobbies, 5, 7, "activitiesAndHobbies");
  checkArrayLength(data.parentChildInteraction, 3, 5, "parentChildInteraction");
  checkArrayLength(data.futureProspects, 2, 3, "futureProspects");

  // Проверка opener - должна быть строка
  if (data.opener && typeof data.opener !== "string") {
    errors.push("Поле opener должно быть строкой");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Валидация консультации по типу
 */
export function validateConsultation(
  data: any,
  type: "base" | "target" | "partner" | "child"
): ValidationResult {
  switch (type) {
    case "base":
      return validateBaseConsultation(data);
    case "target":
      return validateTargetConsultation(data);
    case "partner":
      return validatePartnerConsultation(data);
    case "child":
      return validateChildConsultation(data);
    default:
      return {
        valid: false,
        errors: [`Unknown consultation type: ${type}`],
        warnings: [],
      };
  }
}

