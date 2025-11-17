/**
 * Глубокая персонализация экспресс-консультации на основе САЛ-кодов
 * Учитывает синтез всех кодов, доминирующие характеристики и стиль общения
 */

import { SALCodes } from "./sal-codes";

export interface CodeInterpretations {
  personality?: string;
  connector?: string;
  realization?: string;
  generator?: string;
  mission?: string;
}

export interface ProfileSynthesis {
  dominantCodes: number[]; // Доминирующие коды (например, [4, 4, 4, 4, 4])
  communicationStyle: "direct" | "soft" | "balanced"; // Стиль общения на основе коннектора
  keyResources: string[]; // Ключевые ресурсы из всех кодов
  keyDistortions: string[]; // Ключевые искажения
  keyChallenges: string[]; // Ключевые задачи развития
  archetypes: string[]; // Архетипы всех кодов
}

export interface PersonalizedContent {
  // Установление контакта
  contactPhrases: string[]; // Динамичные фразы для установления контакта
  
  // Начало консультации
  opener: string; // Краткое описание профиля (из базового расчета или сгенерированное)
  
  // Точка А
  pointAQuestions: string[];
  pointAOptions: string[];
  pointAPhrases: string[];
  
  // Точка Б
  pointBQuestions: string[];
  pointBOptions: string[];
  pointBPhrases: string[];
  
  // Ресурсы
  resourcesAnalysis: string; // Анализ: может ли прийти к точке Б и за счет чего
  resourcesPhrases: string[];
  
  // Закрытие и продажа
  closingPhrases: string[];
  offerTemplate: string;
}

/**
 * Определяет доминирующие коды
 */
function getDominantCodes(codes: SALCodes): number[] {
  const codeValues = [
    codes.personality,
    codes.connector,
    codes.realization,
    codes.generator,
    codes.mission,
  ];
  
  // Подсчитываем частоту каждого кода
  const frequency: Record<number, number> = {};
  codeValues.forEach(code => {
    frequency[code] = (frequency[code] || 0) + 1;
  });
  
  // Находим максимальную частоту
  const maxFreq = Math.max(...Object.values(frequency));
  
  // Если есть код, который встречается 3+ раза - это доминация
  if (maxFreq >= 3) {
    return Object.keys(frequency)
      .filter(k => frequency[Number(k)] === maxFreq)
      .map(k => Number(k));
  }
  
  // Если нет явной доминации, возвращаем все уникальные коды
  return Array.from(new Set(codeValues));
}

/**
 * Определяет стиль общения на основе коннектора
 */
function getCommunicationStyle(connectorCode: number): "direct" | "soft" | "balanced" {
  // Коды 1, 3, 5, 7, 9 - более прямые, активные
  if ([1, 3, 5, 7, 9].includes(connectorCode)) {
    return "direct";
  }
  // Коды 2, 4, 6, 8 - более мягкие, дипломатичные
  if ([2, 4, 6, 8].includes(connectorCode)) {
    return "soft";
  }
  // Мастер-числа 11, 22 - сбалансированные
  return "balanced";
}

/**
 * Создает синтез профиля на основе всех кодов и трактовок
 */
export function createProfileSynthesis(
  codes: SALCodes,
  interpretations: CodeInterpretations
): ProfileSynthesis {
  const dominantCodes = getDominantCodes(codes);
  const communicationStyle = getCommunicationStyle(codes.connector);
  
  const keyResources: string[] = [];
  const keyDistortions: string[] = [];
  const keyChallenges: string[] = [];
  const archetypes: string[] = [];
  
  // Извлекаем характеристики из всех трактовок
  Object.entries(interpretations).forEach(([key, interpretation]) => {
    if (!interpretation) return;
    
    const characteristics = extractKeyCharacteristics(interpretation);
    
    if (characteristics.archetype) {
      archetypes.push(`${key}: ${characteristics.archetype}`);
    }
    
    // Если код доминирующий, приоритет его характеристикам
    const codeValue = codes[key as keyof SALCodes];
    const isDominant = dominantCodes.includes(codeValue);
    const weight = isDominant ? 2 : 1;
    
    keyResources.push(...characteristics.resources.slice(0, weight));
    keyDistortions.push(...characteristics.distortions.slice(0, weight));
    keyChallenges.push(...characteristics.challenges.slice(0, weight));
  });
  
  return {
    dominantCodes,
    communicationStyle,
    keyResources: Array.from(new Set(keyResources)).slice(0, 5),
    keyDistortions: Array.from(new Set(keyDistortions)).slice(0, 5),
    keyChallenges: Array.from(new Set(keyChallenges)).slice(0, 5),
    archetypes,
  };
}

/**
 * Извлекает ключевые характеристики из трактовки кода
 */
function extractKeyCharacteristics(interpretation: string): {
  resources: string[];
  distortions: string[];
  challenges: string[];
  archetype: string;
} {
  const result = {
    resources: [] as string[],
    distortions: [] as string[],
    challenges: [] as string[],
    archetype: "",
  };

  // Извлекаем архетип
  const archetypeMatch = interpretation.match(/Архетип[:\s]+([^\.]+)/i);
  if (archetypeMatch) {
    result.archetype = archetypeMatch[1].trim();
  }

  // Извлекаем ресурсы
  const resourceSection = interpretation.match(/(?:Ресурсное проявление|В ресурсе|Что работает|ресурсная форма)[\s\S]*?(?=Искажённое|Что не работает|искажение|$)/i);
  if (resourceSection) {
    const resourceText = resourceSection[0];
    const resourceMatches = resourceText.match(/(?:—|•|-)\s*([^\.\n]+)/g);
    if (resourceMatches) {
      result.resources = resourceMatches.map(m => m.replace(/^[—•-]\s*/, "").trim()).slice(0, 5);
    }
  }

  // Извлекаем искажения
  const distortionSection = interpretation.match(/(?:Искажённое проявление|Что не работает|искажение|искажения)[\s\S]*?(?=Задача развития|Рекомендация|Что мешает|$)/i);
  if (distortionSection) {
    const distortionText = distortionSection[0];
    const distortionMatches = distortionText.match(/(?:—|•|-)\s*([^\.\n]+)/g);
    if (distortionMatches) {
      result.distortions = distortionMatches.map(m => m.replace(/^[—•-]\s*/, "").trim()).slice(0, 5);
    }
  }

  // Извлекаем задачи/вызовы
  const challengeSection = interpretation.match(/(?:Задача развития|Испытание|Что мешает|вызов)[\s\S]*?$/i);
  if (challengeSection) {
    const challengeText = challengeSection[0];
    const challengeMatches = challengeText.match(/(?:—|•|-)\s*([^\.\n]+)/g);
    if (challengeMatches) {
      result.challenges = challengeMatches.map(m => m.replace(/^[—•-]\s*/, "").trim()).slice(0, 5);
    }
  }

  return result;
}

/**
 * Генерирует динамичные фразы для установления контакта
 */
function generateContactPhrases(
  synthesis: ProfileSynthesis
): string[] {
  const phrases: string[] = [];
  
  // Базовые актуальные фразы
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  
  // Сезонные фразы
  if (month >= 2 && month <= 4) {
    phrases.push("Как ваш день? Уже чувствуется весна!");
    phrases.push("Видели, какая погода сегодня? Весна наконец-то пришла!");
  } else if (month >= 5 && month <= 7) {
    phrases.push("Как ваш день? Лето в разгаре!");
    phrases.push("Как настроение? Погода отличная для работы!");
  } else if (month >= 8 && month <= 10) {
    phrases.push("Как ваш день? Осень - время перемен!");
    phrases.push("Видели, какая погода? Осень вступила в права!");
  } else {
    phrases.push("Как ваш день? Зима - время подводить итоги!");
    phrases.push("У вас снег уже выпал? Зима наконец-то пришла!");
  }
  
  // Персонализация на основе стиля общения
  if (synthesis.communicationStyle === "direct") {
    phrases.push("Привет! Готовы начать? Давайте сразу к делу.");
    phrases.push("Как дела? Настроены на продуктивную работу?");
  } else if (synthesis.communicationStyle === "soft") {
    phrases.push("Привет! Как настроение? Готовы к разговору?");
    phrases.push("Как ваш день? Надеюсь, всё хорошо!");
  } else {
    phrases.push("Привет! Как дела? Готовы к консультации?");
    phrases.push("Как настроение? Давайте начнем!");
  }
  
  // Универсальные фразы
  phrases.push("Как ваш день? Что интересного происходит?");
  phrases.push("Ого, а что это у вас на фоне? Интересное место!");
  phrases.push("Класс, видели что было вчера? [актуальная тема]");
  
  return phrases.slice(0, 8);
}

/**
 * Генерирует opener на основе синтеза профиля
 */
function generateOpener(
  codes: SALCodes,
  synthesis: ProfileSynthesis,
  profileOpener?: string
): string {
  // Если есть opener из базового расчета - используем его
  if (profileOpener) {
    return profileOpener;
  }
  
  // Иначе генерируем на основе синтеза
  const parts: string[] = [];
  
  // Упоминаем доминирующие коды
  if (synthesis.dominantCodes.length > 0 && synthesis.dominantCodes.length < 5) {
    const dominant = synthesis.dominantCodes[0];
    parts.push(`У вас доминирующий код ${dominant}, что говорит о вашей природной силе в этой области.`);
  }
  
  // Упоминаем архетипы
  if (synthesis.archetypes.length > 0) {
    const mainArchetype = synthesis.archetypes[0].split(": ")[1];
    parts.push(`Ваш профиль показывает архетип ${mainArchetype}, что определяет ваш уникальный стиль.`);
  }
  
  // Упоминаем ключевые ресурсы
  if (synthesis.keyResources.length > 0) {
    parts.push(`Ваши природные ресурсы: ${synthesis.keyResources.slice(0, 2).join(", ")}.`);
  }
  
  // Базовый opener, если ничего не сгенерировалось
  if (parts.length === 0) {
    return `Привет! Я вижу ваш профиль САЛ: Личность ${codes.personality}, Коннектор ${codes.connector}, Реализация ${codes.realization}, Генератор ${codes.generator}, Миссия ${codes.mission}. Давайте разберем, что это значит для вас.`;
  }
  
  return parts.join(" ") + " Давайте разберем, как это влияет на вашу жизнь.";
}

/**
 * Генерирует персонализированные вопросы для Точки А
 */
function generatePointAQuestions(
  codes: SALCodes,
  synthesis: ProfileSynthesis,
  interpretations: CodeInterpretations
): string[] {
  const questions: string[] = [];
  
  // Вопросы на основе доминирующих искажений
  if (synthesis.keyDistortions.length > 0) {
    const distortion = synthesis.keyDistortions[0];
    if (synthesis.communicationStyle === "direct") {
      questions.push(`Где ты замечаешь, что ${distortion.toLowerCase()}?`);
      questions.push(`В каких ситуациях это проявляется?`);
    } else {
      questions.push(`Где вы чувствуете, что ${distortion.toLowerCase()}?`);
      questions.push(`В каких ситуациях это происходит?`);
    }
  }
  
  // Вопросы на основе стиля общения
  if (synthesis.communicationStyle === "direct") {
    questions.push("Какой сейчас есть запрос? Что не получается?");
    questions.push("Что не устраивает в текущей ситуации?");
  } else {
    questions.push("Какой у вас сейчас есть запрос? Что не получается?");
    questions.push("Что вас не устраивает в текущей ситуации?");
  }
  
  // Базовые вопросы
  if (questions.length < 3) {
    questions.push("Что не получается? Что вас не устраивает в текущей ситуации?");
    questions.push("В какой области сейчас чувствуете самый большой затык?");
  }
  
  return questions.slice(0, 5);
}

/**
 * Генерирует опции для Точки А на основе синтеза
 */
function generatePointAOptions(
  codes: SALCodes,
  synthesis: ProfileSynthesis
): string[] {
  const options: string[] = [];
  
  // Используем ключевые искажения
  synthesis.keyDistortions.slice(0, 3).forEach(d => {
    if (d.length < 50) options.push(d);
  });
  
  // Базовые опции
  const baseOptions = [
    "Не получается найти клиентов",
    "Низкий доход",
    "Нет мотивации",
    "Проблемы в отношениях",
    "Не понимаю свои сильные стороны",
    "Не могу реализовать потенциал",
    "Постоянные сомнения",
    "Упадок сил",
  ];
  
  options.push(...baseOptions);
  
  return Array.from(new Set(options)).slice(0, 10);
}

/**
 * Генерирует фразы для Точки А с учетом стиля общения
 */
function generatePointAPhrases(
  codes: SALCodes,
  synthesis: ProfileSynthesis,
  interpretations: CodeInterpretations
): string[] {
  const phrases: string[] = [];
  
  // Фразы в зависимости от стиля общения
  if (synthesis.communicationStyle === "direct") {
    phrases.push("Давай по-честному, какой у тебя сейчас запрос?");
    phrases.push("Что не получается? Где затык?");
    phrases.push("Расскажи про свою текущую ситуацию. Что работает, а что нет?");
  } else if (synthesis.communicationStyle === "soft") {
    phrases.push("Расскажите, какой у вас сейчас запрос?");
    phrases.push("Что вас беспокоит в текущей ситуации?");
    phrases.push("Где вы чувствуете, что что-то не получается?");
  } else {
    phrases.push("Какой у вас сейчас запрос?");
    phrases.push("Что не получается в текущей ситуации?");
    phrases.push("Расскажите, что вас не устраивает?");
  }
  
  // Фразы на основе искажений
  if (synthesis.keyDistortions.length > 0) {
    const distortion = synthesis.keyDistortions[0];
    phrases.push(`Где ты замечаешь, что ${distortion.toLowerCase()}?`);
  }
  
  // Универсальные фразы
  phrases.push("Уже пробовала как-то решить? Если да, то что мешало достичь результата?");
  phrases.push("Что хорошо работает сейчас?");
  phrases.push("Почему ты вообще пришла на разбор?");
  
  return phrases;
}

/**
 * Генерирует вопросы для Точки Б (универсальные, не только про деньги)
 */
function generatePointBQuestions(
  codes: SALCodes,
  synthesis: ProfileSynthesis,
  interpretations: CodeInterpretations
): string[] {
  const questions: string[] = [];
  
  // Вопросы на основе стиля общения
  if (synthesis.communicationStyle === "direct") {
    questions.push("Как хочется? К чему ты хочешь прийти?");
    questions.push("Какой результат тебе нужен? Что ты хочешь получить?");
    questions.push("Представь идеальную ситуацию. Как это выглядит?");
  } else {
    questions.push("Как вам хочется? К чему вы хотите прийти?");
    questions.push("Какой результат вам нужен? Что вы хотите получить?");
    questions.push("Представьте идеальную ситуацию. Как это выглядит?");
  }
  
  // Вопросы на основе ресурсов
  if (synthesis.keyResources.length > 0) {
    const resource = synthesis.keyResources[0];
    questions.push(`Как ты видишь себя, когда используешь ${resource.toLowerCase()}?`);
  }
  
  // Универсальные вопросы для любых запросов
  questions.push("Что для тебя важно? Что ты хочешь изменить?");
  questions.push("Какой результат ты хочешь получить? За какой срок?");
  
  return questions.slice(0, 6);
}

/**
 * Генерирует опции для Точки Б (универсальные, для любых запросов)
 */
function generatePointBOptions(
  codes: SALCodes,
  synthesis: ProfileSynthesis
): string[] {
  const options: string[] = [];
  
  // Используем ключевые ресурсы
  synthesis.keyResources.slice(0, 3).forEach(r => {
    if (r.length < 50) options.push(r);
  });
  
  // Универсальные опции для разных сфер жизни
  const baseOptions = [
    "Улучшить отношения в семье",
    "Найти партнера / построить отношения",
    "Развить свой бизнес",
    "Найти свое призвание",
    "Улучшить отношения с детьми",
    "Повысить доход",
    "Достичь финансовой свободы",
    "Реализовать творческий потенциал",
    "Получить признание",
    "Создать гармонию в жизни",
    "Решить проблемы со здоровьем",
    "Найти баланс между работой и личной жизнью",
    "Развить навыки и компетенции",
    "Помогать другим",
    "Достичь внутренней гармонии",
  ];
  
  options.push(...baseOptions);
  
  return Array.from(new Set(options)).slice(0, 12);
}

/**
 * Генерирует фразы для Точки Б (универсальные)
 */
function generatePointBPhrases(
  codes: SALCodes,
  synthesis: ProfileSynthesis
): string[] {
  const phrases: string[] = [];
  
  if (synthesis.communicationStyle === "direct") {
    phrases.push("Как хочется? К чему ты хочешь прийти?");
    phrases.push("Какой результат тебе нужен? Что ты хочешь получить?");
    phrases.push("Представь идеальную ситуацию. Как это выглядит?");
  } else {
    phrases.push("Как вам хочется? К чему вы хотите прийти?");
    phrases.push("Какой результат вам нужен? Что вы хотите получить?");
    phrases.push("Представьте идеальную ситуацию. Как это выглядит?");
  }
  
  phrases.push("Хорошо, представь что это всё уже есть, что дальше?");
  phrases.push("Какой ты себя видишь через 5-10 лет?");
  phrases.push("Закрой глаза и представь картинку мечты. Что ты видишь?");
  phrases.push("Что для тебя важно? Что ты хочешь изменить в своей жизни?");
  phrases.push("Опиши свою мечту. Как она выглядит?");
  
  return phrases;
}

/**
 * Анализирует ресурсы: может ли прийти к точке Б и за счет чего (универсально для любых запросов)
 */
function generateResourcesAnalysis(
  codes: SALCodes,
  synthesis: ProfileSynthesis,
  pointAProblems?: string[],
  pointBGoals?: string[]
): string {
  const parts: string[] = [];
  
  // Анализ на основе ресурсов
  if (synthesis.keyResources.length > 0) {
    parts.push(`С точки зрения САЛ, у вас есть ресурсы: ${synthesis.keyResources.slice(0, 3).join(", ")}.`);
  }
  
  // Анализ на основе доминирующих кодов
  if (synthesis.dominantCodes.length > 0 && synthesis.dominantCodes.length < 5) {
    parts.push(`Ваш доминирующий код ${synthesis.dominantCodes[0]} дает вам природную силу в этой области.`);
  }
  
  // Анализ возможности достижения цели (универсально)
  if (pointBGoals && pointBGoals.length > 0) {
    parts.push(`Вы можете прийти к своей цели "${pointBGoals[0]}" за счет ваших природных ресурсов.`);
  } else {
    parts.push("Вы можете достичь своей цели за счет ваших природных ресурсов.");
  }
  
  // Упоминание искажений, которые могут мешать
  if (synthesis.keyDistortions.length > 0) {
    parts.push(`Важно учесть, что ${synthesis.keyDistortions[0].toLowerCase()} может мешать, но это решаемо.`);
  }
  
  // Базовый анализ
  if (parts.length === 0) {
    return "С точки зрения САЛ, у вас есть все необходимые ресурсы для достижения цели. Важно правильно их активировать.";
  }
  
  return parts.join(" ") + " Это коротко и тезисно - подробности узнаете в полном разборе.";
}

/**
 * Генерирует фразы для Ресурсов
 */
function generateResourcesPhrases(
  codes: SALCodes,
  synthesis: ProfileSynthesis
): string[] {
  const phrases: string[] = [];
  
  if (synthesis.keyResources.length > 0) {
    phrases.push(`У тебя есть ресурс - ${synthesis.keyResources[0].toLowerCase()}. Как ты можешь его использовать?`);
  }
  
  phrases.push("Какие есть ресурсы, которые помогут прийти в точку «Б»?");
  phrases.push("Смотри, если у тебя будут все необходимые ресурсы, технологии, пошаговый план, поддержка, ты быстрее придёшь в свою точку «Б»?");
  
  return phrases;
}

/**
 * Генерирует фразы для Закрытия
 */
function generateClosingPhrases(
  codes: SALCodes,
  synthesis: ProfileSynthesis,
  pointAProblems?: string[],
  pointBGoals?: string[]
): string[] {
  const phrases: string[] = [];
  
  // Персонализированные фразы
  if (pointAProblems && pointAProblems.length > 0 && pointBGoals && pointBGoals.length > 0) {
    if (synthesis.communicationStyle === "direct") {
      phrases.push(`Смотри, у тебя есть проблема: ${pointAProblems[0]}. И ты хочешь прийти к: ${pointBGoals[0]}. Все верно?`);
    } else {
      phrases.push(`У вас есть проблема: ${pointAProblems[0]}. И вы хотите прийти к: ${pointBGoals[0]}. Все верно?`);
    }
  }
  
  // Фразы на основе задач развития
  if (synthesis.keyChallenges.length > 0) {
    phrases.push(`Твоя задача развития - ${synthesis.keyChallenges[0].toLowerCase()}. Мы поможем тебе с этим.`);
  }
  
  // Универсальные фразы
  phrases.push("Супер, а на сколько для тебя это важно от 1 до 10?");
  phrases.push("Супер, когда для человека действительно важно, всё обязательно получается");
  phrases.push("Смотри, я могу помочь точечно или комплексно, что интересней?");
  phrases.push("Когда готов начинать? Супер, смотри, я начинаю работать только после оплаты.");
  
  return phrases;
}

/**
 * Генерирует персонализированный оффер (универсально для любых запросов)
 */
function generateOfferTemplate(
  codes: SALCodes,
  synthesis: ProfileSynthesis,
  pointAProblems?: string[],
  pointBGoals?: string[]
): string {
  let template = "Мы сегодня вскрыли только верхушку айсберга, но уже видно, насколько сильно это влияет на разные сферы.\n\n";
  
  // Используем проблемы и цели (универсально)
  if (pointAProblems && pointAProblems.length > 0) {
    template += `Ты видишь, что у тебя есть проблемы: ${pointAProblems.slice(0, 2).join(", ")}. `;
  }
  
  if (pointBGoals && pointBGoals.length > 0) {
    template += `И ты хочешь прийти к: ${pointBGoals.slice(0, 2).join(", ")}. `;
  }
  
  // Используем синтез
  if (synthesis.keyChallenges.length > 0) {
    template += `Твоя задача развития - ${synthesis.keyChallenges[0].toLowerCase()}. `;
  }
  
  if (synthesis.keyResources.length > 0) {
    template += `Ты можешь реализоваться через ${synthesis.keyResources[0].toLowerCase()}, но что-то мешает. `;
  }
  
  template += "\nДальше есть два пути, которые реально помогут поменять ситуацию:\n";
  template += "– Личный разбор — на нём мы детально посмотрим на все твои природные ресурсы и скрытые конфликты. Ты получишь конкретную стратегию, как реализовать сильные стороны и обойти внутренние ограничения. Это поможет тебе достичь своей цели.\n";
  template += "– Парная консультация — если важна тема отношений (семья, партнер, дети), разберём совместимость, выясним, как строить гармоничные отношения или найти подходящего человека.\n\n";
  template += "Какой формат тебе сейчас ближе?";
  
  return template;
}

/**
 * Получает персонализированный контент на основе синтеза всех кодов
 */
export function getPersonalizedContent(
  codes: SALCodes,
  interpretations: CodeInterpretations,
  pointAProblems?: string[],
  pointBGoals?: string[],
  profileOpener?: string
): PersonalizedContent {
  // Создаем синтез профиля
  const synthesis = createProfileSynthesis(codes, interpretations);
  
  return {
    contactPhrases: generateContactPhrases(synthesis),
    opener: generateOpener(codes, synthesis, profileOpener),
    pointAQuestions: generatePointAQuestions(codes, synthesis, interpretations),
    pointAOptions: generatePointAOptions(codes, synthesis),
    pointAPhrases: generatePointAPhrases(codes, synthesis, interpretations),
    pointBQuestions: generatePointBQuestions(codes, synthesis, interpretations),
    pointBOptions: generatePointBOptions(codes, synthesis),
    pointBPhrases: generatePointBPhrases(codes, synthesis),
    resourcesAnalysis: generateResourcesAnalysis(codes, synthesis, pointAProblems, pointBGoals),
    resourcesPhrases: generateResourcesPhrases(codes, synthesis),
    closingPhrases: generateClosingPhrases(codes, synthesis, pointAProblems, pointBGoals),
    offerTemplate: generateOfferTemplate(codes, synthesis, pointAProblems, pointBGoals),
  };
}

