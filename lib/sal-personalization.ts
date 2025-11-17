/**
 * Персонализация экспресс-консультации на основе САЛ-кодов и их трактовок
 * Использует реальные трактовки из book_information для максимальной персонализации
 */

import { SALCodes } from "./sal-codes";

export interface CodeInterpretations {
  personality?: string;
  connector?: string;
  realization?: string;
  generator?: string;
  mission?: string;
}

export interface PersonalizedContent {
  // Вопросы для Точки А (текущая ситуация)
  pointAQuestions: string[];
  pointAOptions: string[];
  pointAPhrases: string[]; // Готовые фразы для консультанта
  
  // Вопросы для Точки Б (желания)
  pointBQuestions: string[];
  pointBOptions: string[];
  pointBPhrases: string[];
  
  // Ресурсы
  resourcesPhrases: string[];
  
  // Закрытие и продажа
  closingPhrases: string[];
  offerTemplate: string; // Шаблон оффера с плейсхолдерами
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

  // Извлекаем ресурсы (ищем фразы типа "В ресурсе", "Ресурсное проявление", "Что работает")
  const resourceSection = interpretation.match(/(?:Ресурсное проявление|В ресурсе|Что работает|ресурсная форма)[\s\S]*?(?=Искажённое|Что не работает|искажение|$)/i);
  if (resourceSection) {
    const resourceText = resourceSection[0];
    // Извлекаем ключевые фразы
    const resourceMatches = resourceText.match(/(?:—|•|-)\s*([^\.\n]+)/g);
    if (resourceMatches) {
      result.resources = resourceMatches.map(m => m.replace(/^[—•-]\s*/, "").trim()).slice(0, 5);
    }
  }

  // Извлекаем искажения (ищем фразы типа "Искажённое проявление", "Что не работает", "искажение")
  const distortionSection = interpretation.match(/(?:Искажённое проявление|Что не работает|искажение|искажения)[\s\S]*?(?=Задача развития|Рекомендация|Что мешает|$)/i);
  if (distortionSection) {
    const distortionText = distortionSection[0];
    const distortionMatches = distortionText.match(/(?:—|•|-)\s*([^\.\n]+)/g);
    if (distortionMatches) {
      result.distortions = distortionMatches.map(m => m.replace(/^[—•-]\s*/, "").trim()).slice(0, 5);
    }
  }

  // Извлекаем задачи/вызовы (ищем фразы типа "Задача развития", "Испытание", "Что мешает")
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
 * Генерирует персонализированные вопросы для Точки А на основе трактовок
 */
function generatePointAQuestions(
  codes: SALCodes,
  interpretations: CodeInterpretations
): string[] {
  const questions: string[] = [];
  
  // Используем трактовку Личности для вопросов
  if (interpretations.personality) {
    const personality = extractKeyCharacteristics(interpretations.personality);
    
    // Вопросы на основе искажений
    if (personality.distortions.length > 0) {
      const distortion = personality.distortions[0];
      questions.push(`Где ты замечаешь, что ${distortion.toLowerCase()}?`);
      questions.push(`В каких ситуациях ты чувствуешь, что ${distortion.toLowerCase()}?`);
    }
    
    // Вопросы на основе вызовов
    if (personality.challenges.length > 0) {
      const challenge = personality.challenges[0];
      questions.push(`Что мешает тебе ${challenge.toLowerCase()}?`);
    }
  }
  
  // Используем трактовку Коннектора
  if (interpretations.connector) {
    const connector = extractKeyCharacteristics(interpretations.connector);
    if (connector.distortions.length > 0) {
      const distortion = connector.distortions[0];
      questions.push(`Как ты чувствуешь себя в общении, когда ${distortion.toLowerCase()}?`);
    }
  }
  
  // Используем трактовку Реализации
  if (interpretations.realization) {
    const realization = extractKeyCharacteristics(interpretations.realization);
    if (realization.distortions.length > 0) {
      const distortion = realization.distortions[0];
      questions.push(`Где ты видишь, что не получается реализоваться из-за ${distortion.toLowerCase()}?`);
    }
  }
  
  // Базовые вопросы, если персонализированных мало
  if (questions.length < 3) {
    questions.push("Что не получается? Что вас не устраивает в текущей ситуации?");
    questions.push("В какой области сейчас чувствуете самый большой затык?");
    questions.push("Что именно не получается, в чем сложности?");
  }
  
  return questions.slice(0, 5);
}

/**
 * Генерирует персонализированные опции для Точки А
 */
function generatePointAOptions(
  codes: SALCodes,
  interpretations: CodeInterpretations
): string[] {
  const options: string[] = [];
  
  // Используем искажения из трактовок
  if (interpretations.personality) {
    const personality = extractKeyCharacteristics(interpretations.personality);
    personality.distortions.slice(0, 2).forEach(d => {
      if (d.length < 50) options.push(d);
    });
  }
  
  if (interpretations.connector) {
    const connector = extractKeyCharacteristics(interpretations.connector);
    connector.distortions.slice(0, 2).forEach(d => {
      if (d.length < 50) options.push(d);
    });
  }
  
  if (interpretations.realization) {
    const realization = extractKeyCharacteristics(interpretations.realization);
    realization.distortions.slice(0, 2).forEach(d => {
      if (d.length < 50) options.push(d);
    });
  }
  
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
 * Генерирует готовые фразы для консультанта в Точке А
 */
function generatePointAPhrases(
  codes: SALCodes,
  interpretations: CodeInterpretations
): string[] {
  const phrases: string[] = [];
  
  // Фразы на основе трактовки Личности
  if (interpretations.personality) {
    const personality = extractKeyCharacteristics(interpretations.personality);
    
    if (personality.archetype) {
      phrases.push(`Я вижу, что у тебя код Личности ${codes.personality} - это ${personality.archetype}. Расскажи, где ты замечаешь это в своей жизни?`);
    }
    
    if (personality.distortions.length > 0) {
      const distortion = personality.distortions[0];
      phrases.push(`Давай по-честному, где ты чувствуешь, что ${distortion.toLowerCase()}?`);
      phrases.push(`В каких ситуациях это проявляется - ${distortion.toLowerCase()}?`);
    }
    
    if (personality.challenges.length > 0) {
      const challenge = personality.challenges[0];
      phrases.push(`Что мешает тебе ${challenge.toLowerCase()}?`);
    }
  }
  
  // Фразы на основе трактовки Коннектора
  if (interpretations.connector) {
    const connector = extractKeyCharacteristics(interpretations.connector);
    if (connector.distortions.length > 0) {
      const distortion = connector.distortions[0];
      phrases.push(`Как ты чувствуешь себя в общении, когда ${distortion.toLowerCase()}?`);
      phrases.push(`Где ты замечаешь, что тебя неправильно понимают из-за ${distortion.toLowerCase()}?`);
    }
  }
  
  // Фразы на основе трактовки Реализации
  if (interpretations.realization) {
    const realization = extractKeyCharacteristics(interpretations.realization);
    if (realization.distortions.length > 0) {
      const distortion = realization.distortions[0];
      phrases.push(`Где ты видишь, что не получается зарабатывать из-за ${distortion.toLowerCase()}?`);
    }
  }
  
  // Универсальные фразы
  phrases.push("Расскажи про свою текущую ситуацию. Что получается и что не получается?");
  phrases.push("Уже пробовала как-то решить? Если да, то что мешало достичь результата?");
  phrases.push("Что хорошо работает сейчас?");
  phrases.push("Почему ты вообще пришла на разбор?");
  phrases.push("Давай по-честному, если ты пришла на разбор - тебя явно что-то не устраивает. Расскажи что?");
  phrases.push("Как думаешь, почему у тебя не получается?");
  phrases.push("Устраивает ли тебя твой уровень жизни сейчас? Окей, чего еще не хватает?");
  
  return phrases;
}

/**
 * Генерирует вопросы для Точки Б
 */
function generatePointBQuestions(
  codes: SALCodes,
  interpretations: CodeInterpretations
): string[] {
  const questions: string[] = [];
  
  // Используем трактовку Реализации
  if (interpretations.realization) {
    const realization = extractKeyCharacteristics(interpretations.realization);
    if (realization.resources.length > 0) {
      const resource = realization.resources[0];
      questions.push(`Как ты видишь себя, когда ${resource.toLowerCase()}?`);
    }
    
    // Ищем формулу дохода в трактовке
    const formulaMatch = interpretations.realization.match(/Формула[:\s]+([^\.]+)/i);
    if (formulaMatch) {
      questions.push(`Сколько ты хочешь зарабатывать? ${formulaMatch[1]} - это твоя формула успеха.`);
    }
  }
  
  // Используем трактовку Генератора
  if (interpretations.generator) {
    const generator = extractKeyCharacteristics(interpretations.generator);
    if (generator.resources.length > 0) {
      const resource = generator.resources[0];
      questions.push(`Что заряжает тебя энергией? ${resource} - это твой источник силы.`);
    }
  }
  
  // Используем трактовку Миссии
  if (interpretations.mission) {
    const missionMatch = interpretations.mission.match(/Суть миссии[:\s]+([^\.]+)/i);
    if (missionMatch) {
      questions.push(`${missionMatch[1]} - это твоя миссия. Как ты видишь себя, когда она реализована?`);
    }
  }
  
  // Базовые вопросы
  if (questions.length < 3) {
    questions.push("К чему вы хотите прийти? Какой результат хотите получить?");
    questions.push("Сколько вы хотите зарабатывать? Сколько будет комфортно для жизни?");
    questions.push("Какой вы себя видите через 5-10 лет?");
  }
  
  return questions.slice(0, 5);
}

/**
 * Генерирует опции для Точки Б
 */
function generatePointBOptions(
  codes: SALCodes,
  interpretations: CodeInterpretations
): string[] {
  const options: string[] = [];
  
  // Используем ресурсы из трактовки Реализации
  if (interpretations.realization) {
    const realization = extractKeyCharacteristics(interpretations.realization);
    realization.resources.slice(0, 3).forEach(r => {
      if (r.length < 50) options.push(r);
    });
  }
  
  // Используем ресурсы из трактовки Генератора
  if (interpretations.generator) {
    const generator = extractKeyCharacteristics(interpretations.generator);
    generator.resources.slice(0, 2).forEach(r => {
      if (r.length < 50) options.push(r);
    });
  }
  
  // Базовые опции
  const baseOptions = [
    "Зарабатывать больше денег",
    "Жить в теплой стране",
    "Признание и медийность",
    "Написать книгу",
    "Выступать на сцене",
    "Создать семью",
    "Реализовать творческий потенциал",
    "Помогать другим",
  ];
  
  options.push(...baseOptions);
  
  return Array.from(new Set(options)).slice(0, 10);
}

/**
 * Генерирует фразы для Точки Б
 */
function generatePointBPhrases(
  codes: SALCodes,
  interpretations: CodeInterpretations
): string[] {
  const phrases: string[] = [];
  
  // Фразы на основе трактовки Реализации
  if (interpretations.realization) {
    const realization = extractKeyCharacteristics(interpretations.realization);
    const formulaMatch = interpretations.realization.match(/Формула[:\s]+([^\.]+)/i);
    if (formulaMatch) {
      phrases.push(`Сколько ты хочешь зарабатывать? ${formulaMatch[1]} - это твоя формула успеха.`);
    }
    
    if (realization.resources.length > 0) {
      phrases.push(`Ты реализуешься через ${realization.resources[0].toLowerCase()}. Как ты видишь себя, когда это работает?`);
    }
  }
  
  // Фразы на основе трактовки Генератора
  if (interpretations.generator) {
    const generator = extractKeyCharacteristics(interpretations.generator);
    if (generator.resources.length > 0) {
      phrases.push(`Что заряжает тебя энергией? ${generator.resources[0]} - это твой источник силы.`);
    }
  }
  
  // Фразы на основе трактовки Миссии
  if (interpretations.mission) {
    const missionMatch = interpretations.mission.match(/Суть миссии[:\s]+([^\.]+)/i);
    if (missionMatch) {
      phrases.push(`${missionMatch[1]} - это твоя миссия. Как ты видишь себя, когда она реализована?`);
    }
  }
  
  // Универсальные фразы
  phrases.push("Сколько ты хочешь зарабатывать? Сколько тебе будет комфортно для жизни, чтобы прям по кайфу?");
  phrases.push("К чему ты хочешь прийти? Какой результат ты хочешь получить? За какой срок?");
  phrases.push("Хорошо, представь что это всё уже есть, что дальше?");
  phrases.push("Какой ты себя видишь через 5-10 лет? Как ты себя чувствуешь? Что на тебе надето? Где ты?");
  phrases.push("Закрой глаза и представь картинку мечты. Что ты видишь?");
  
  return phrases;
}

/**
 * Генерирует фразы для Ресурсов
 */
function generateResourcesPhrases(
  codes: SALCodes,
  interpretations: CodeInterpretations
): string[] {
  const phrases: string[] = [];
  
  // Фразы на основе ресурсов из трактовок
  if (interpretations.realization) {
    const realization = extractKeyCharacteristics(interpretations.realization);
    if (realization.resources.length > 0) {
      phrases.push(`У тебя есть ресурс - ${realization.resources[0].toLowerCase()}. Как ты можешь его использовать?`);
    }
  }
  
  if (interpretations.generator) {
    const generator = extractKeyCharacteristics(interpretations.generator);
    if (generator.resources.length > 0) {
      phrases.push(`Твой источник энергии - ${generator.resources[0].toLowerCase()}. Как ты можешь его активировать?`);
    }
  }
  
  // Универсальные фразы
  phrases.push("Какие есть ресурсы, которые помогут прийти в точку «Б»? (время, деньги, люди, навыки, социальные сети и охваты в них и тд)");
  phrases.push("Отлично, что есть такие ресурсы, но я бы ещё добавила вот это: [перечисляем что он получит от нас]");
  phrases.push("Смотри, если у тебя будут все необходимые ресурсы, технологии, пошаговый план, поддержка и прочие ресурсы, которых тебе не хватает, ты быстрее придёшь в свою точку «Б»?");
  
  return phrases;
}

/**
 * Генерирует фразы для Закрытия
 */
function generateClosingPhrases(
  codes: SALCodes,
  interpretations: CodeInterpretations,
  pointAProblems?: string[],
  pointBGoals?: string[]
): string[] {
  const phrases: string[] = [];
  
  // Персонализированные фразы на основе проблем и целей
  if (pointAProblems && pointAProblems.length > 0 && pointBGoals && pointBGoals.length > 0) {
    const problem = pointAProblems[0];
    const goal = pointBGoals[0];
    phrases.push(`Смотри, у тебя есть проблема: ${problem}. И ты хочешь прийти к: ${goal}. Все верно?`);
  }
  
  // Фразы на основе трактовок
  if (interpretations.personality) {
    const personality = extractKeyCharacteristics(interpretations.personality);
    if (personality.challenges.length > 0) {
      phrases.push(`Твоя задача развития - ${personality.challenges[0].toLowerCase()}. Мы поможем тебе с этим.`);
    }
  }
  
  // Универсальные фразы
  phrases.push("Супер, а на сколько для тебя это важно от 1 до 10?");
  phrases.push("Супер, когда для человека действительно важно, всё обязательно получается");
  phrases.push("Смотри, я могу помочь точечно (прокачать продажи) или комплексно (простроить запуск и помочь заработать [сумма] на твоих ресурсах), что интересней?");
  phrases.push("Когда готов начинать? Супер, смотри, я начинаю работать только после оплаты.");
  
  return phrases;
}

/**
 * Генерирует персонализированный оффер
 */
function generateOfferTemplate(
  codes: SALCodes,
  interpretations: CodeInterpretations,
  pointAProblems?: string[],
  pointBGoals?: string[]
): string {
  let template = "Мы сегодня вскрыли только верхушку айсберга, но уже видно, насколько сильно это влияет на разные сферы.\n\n";
  
  // Используем проблемы из Точки А
  if (pointAProblems && pointAProblems.length > 0) {
    template += `Ты видишь, что у тебя есть проблемы: ${pointAProblems.slice(0, 2).join(", ")}. `;
  }
  
  // Используем цели из Точки Б
  if (pointBGoals && pointBGoals.length > 0) {
    template += `И ты хочешь прийти к: ${pointBGoals.slice(0, 2).join(", ")}. `;
  }
  
  // Используем трактовки для персонализации
  if (interpretations.personality) {
    const personality = extractKeyCharacteristics(interpretations.personality);
    if (personality.challenges.length > 0) {
      template += `Твоя задача развития - ${personality.challenges[0].toLowerCase()}. `;
    }
  }
  
  if (interpretations.realization) {
    const realization = extractKeyCharacteristics(interpretations.realization);
    if (realization.resources.length > 0) {
      template += `Ты можешь реализоваться через ${realization.resources[0].toLowerCase()}, но что-то мешает. `;
    }
  }
  
  template += "\nДальше есть два пути, которые реально помогут поменять ситуацию:\n";
  template += "– Личный разбор — на нём мы детально посмотрим на все твои природные ресурсы и скрытые конфликты. Ты получишь конкретную стратегию, как реализовать сильные стороны и обойти внутренние ограничения.\n";
  template += "– Парная консультация — если важна тема отношений, разберём совместимость с партнёром, выясним, как строить гармоничные отношения или найти подходящего человека.\n\n";
  template += "Какой формат тебе сейчас ближе?";
  
  return template;
}

/**
 * Получает персонализированный контент на основе САЛ-кодов и их трактовок
 */
export function getPersonalizedContent(
  codes: SALCodes,
  interpretations: CodeInterpretations,
  pointAProblems?: string[],
  pointBGoals?: string[]
): PersonalizedContent {
  return {
    pointAQuestions: generatePointAQuestions(codes, interpretations),
    pointAOptions: generatePointAOptions(codes, interpretations),
    pointAPhrases: generatePointAPhrases(codes, interpretations),
    pointBQuestions: generatePointBQuestions(codes, interpretations),
    pointBOptions: generatePointBOptions(codes, interpretations),
    pointBPhrases: generatePointBPhrases(codes, interpretations),
    resourcesPhrases: generateResourcesPhrases(codes, interpretations),
    closingPhrases: generateClosingPhrases(codes, interpretations, pointAProblems, pointBGoals),
    offerTemplate: generateOfferTemplate(codes, interpretations, pointAProblems, pointBGoals),
  };
}
