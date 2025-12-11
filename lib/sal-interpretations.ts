/**
 * Утилита для получения трактовок кодов САЛ из JSON файлов
 */

import { calculateSALCodes, SALCodes } from "./sal-codes";
import { readFileSync } from "fs";
import { join } from "path";

// Кэш для загруженных данных
let dataCache: {
  generator?: any[];
  konnector?: any[];
  lichost?: any[];
  mission?: any[];
  realization?: any[];
} = {};

// Загружаем JSON файлы с трактовками (с кэшированием)
function loadJsonFile(filename: string, cacheKey: keyof typeof dataCache): any[] {
  // Проверяем кэш
  if (dataCache[cacheKey]) {
    return dataCache[cacheKey]!;
  }

  try {
    // Папка называется "от меня " (с пробелом в конце)
    const filePath = join(process.cwd(), "от меня ", filename);
    const content = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content);
    
    // Кэшируем результат
    if (Array.isArray(parsed)) {
      dataCache[cacheKey] = parsed;
      return parsed;
    }
    
    console.error(`[SAL-INTERPRETATIONS] ${filename} is not an array`);
    return [];
  } catch (error: any) {
    console.error(`[SAL-INTERPRETATIONS] Error loading ${filename}:`, {
      error: error?.message || String(error),
      code: error?.code,
      path: join(process.cwd(), "от меня ", filename)
    });
    // Возвращаем пустой массив, чтобы не ломать работу
    dataCache[cacheKey] = [];
    return [];
  }
}

// Ленивая загрузка данных
function getGeneratorData() {
  return loadJsonFile("generator.json", "generator");
}

function getKonnectorData() {
  return loadJsonFile("konnector.json", "konnector");
}

function getLichostData() {
  return loadJsonFile("lichost.json", "lichost");
}

function getMissionData() {
  return loadJsonFile("mission.json", "mission");
}

function getRealizationData() {
  return loadJsonFile("realization.json", "realization");
}

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
  if (!codes) {
    console.error("[SAL-INTERPRETATIONS] Failed to calculate codes for birthday:", birthday);
    return null;
  }

  // Загружаем данные лениво
  const lichostData = getLichostData();
  const konnectorData = getKonnectorData();
  const realizationData = getRealizationData();
  const generatorData = getGeneratorData();
  const missionData = getMissionData();

  const personality = getInterpretation(lichostData, codes.personality);
  const connector = getInterpretation(konnectorData, codes.connector);
  const realization = getInterpretation(realizationData, codes.realization);
  const generator = getInterpretation(generatorData, codes.generator);
  const mission = getInterpretation(missionData, codes.mission);

  if (!personality || !connector || !realization || !generator || !mission) {
    console.error("[SAL-INTERPRETATIONS] Missing interpretations:", {
      personality: !!personality,
      connector: !!connector,
      realization: !!realization,
      generator: !!generator,
      mission: !!mission,
      codes
    });
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
 * Если description отсутствует или undefined, использует базовое описание
 */
export function formatCodesForPrompt(profileCodes: ProfileCodes): string {
  const { codes, interpretations } = profileCodes;
  
  // Базовые описания для каждого кода, если description отсутствует
  const getDescription = (code: number, type: string): string => {
    const interpretation = interpretations[type as keyof typeof interpretations];
    if (interpretation?.description && interpretation.description !== 'undefined' && interpretation.description.trim()) {
      return interpretation.description;
    }
    // Базовое описание по типу кода
    const baseDescriptions: Record<string, string> = {
      personality: `Код Личности ${code}: определяет ядро человека, его врожденную природу, способ мышления и характер`,
      connector: `Код Коннектора ${code}: определяет как человек взаимодействует с миром и как его воспринимают окружающие`,
      realization: `Код Реализации ${code}: определяет через что человек реализует себя и получает чувство пользы`,
      generator: `Код Генератора ${code}: определяет что заряжает и истощает человека, что даёт смысл`,
      mission: `Код Миссии ${code}: определяет какую энергию человек призван нести в мир, испытания и искажения`,
    };
    return baseDescriptions[type] || `Код ${type} (${code})`;
  };
  
  return `Личность (${codes.personality}): ${getDescription(codes.personality, 'personality')}
Коннектор (${codes.connector}): ${getDescription(codes.connector, 'connector')}
Реализация (${codes.realization}): ${getDescription(codes.realization, 'realization')}
Генератор (${codes.generator}): ${getDescription(codes.generator, 'generator')}
Миссия (${codes.mission}): ${getDescription(codes.mission, 'mission')}`;
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

