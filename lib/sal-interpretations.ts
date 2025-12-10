/**
 * Утилита для получения трактовок кодов САЛ из JSON файлов
 */

import { calculateSALCodes, SALCodes } from "./sal-codes";
import { readFileSync } from "fs";
import { join } from "path";

// Загружаем JSON файлы с трактовками
function loadJsonFile(filename: string): any[] {
  try {
    // Папка называется "от меня " (с пробелом в конце)
    const filePath = join(process.cwd(), "от меня ", filename);
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return [];
  }
}

const generatorData = loadJsonFile("generator.json");
const konnectorData = loadJsonFile("konnector.json");
const lichostData = loadJsonFile("lichost.json");
const missionData = loadJsonFile("mission.json");
const realizationData = loadJsonFile("realization.json");

export interface CodeInterpretation {
  code: number;
  description: string;
  [key: string]: any; // Дополнительные поля из JSON
}

export interface ProfileCodes {
  codes: SALCodes;
  interpretations: {
    personality: CodeInterpretation;
    connector: CodeInterpretation;
    realization: CodeInterpretation;
    generator: CodeInterpretation;
    mission: CodeInterpretation;
  };
}

/**
 * Получает трактовку для кода из указанного массива
 */
function getInterpretation(data: any[], code: number): CodeInterpretation | null {
  const item = data.find((item) => item.code === code);
  return item || null;
}

/**
 * Рассчитывает коды и получает все трактовки для профиля
 */
export function getProfileCodes(birthday: string): ProfileCodes | null {
  const codes = calculateSALCodes(birthday);
  if (!codes) return null;

  const personality = getInterpretation(lichostData, codes.personality);
  const connector = getInterpretation(konnectorData, codes.connector);
  const realization = getInterpretation(realizationData, codes.realization);
  const generator = getInterpretation(generatorData, codes.generator);
  const mission = getInterpretation(missionData, codes.mission);

  if (!personality || !connector || !realization || !generator || !mission) {
    return null;
  }

  return {
    codes,
    interpretations: {
      personality,
      connector,
      realization,
      generator,
      mission,
    },
  };
}

/**
 * Форматирует описания кодов для промпта
 */
export function formatCodesForPrompt(profileCodes: ProfileCodes): string {
  const { codes, interpretations } = profileCodes;
  
  return `Личность (${codes.personality}): ${interpretations.personality.description}
Коннектор (${codes.connector}): ${interpretations.connector.description}
Реализация (${codes.realization}): ${interpretations.realization.description}
Генератор (${codes.generator}): ${interpretations.generator.description}
Миссия (${codes.mission}): ${interpretations.mission.description}`;
}

/**
 * Получает полное описание кода для легенды
 */
export function getCodeLegend(): string {
  return `САЛ — это метод, который определяет ключевые аспекты личности через пять кодов по дате рождения:

1) Код Личности — ядро человека, его врожденная природа, способ мышления, характер. Определяется суммой цифр дня рождения (до 9).

2) Код Коннектора — как человек взаимодействует с миром, как его воспринимают окружающие. Определяется суммой всех цифр даты рождения (до 9).

3) Код Реализации — через что человек реализует себя, получает чувство пользы и результата. Определяется суммой последних двух цифр года рождения (до 9).

4) Код Генератора — что заряжает и истощает человека, что даёт смысл. Определяется произведением суммы цифр дня и суммы цифр месяца (до 9).

5) Код Миссии — какую энергию человек призван нести в мир, испытания и искажения. Определяется суммой Кода Личности и Кода Коннектора (может быть 11 или 22 — мастер-числа).

Каждый код влияет на разные аспекты жизни человека и проявляется в его поведении, реакциях и выборах.`;
}

