/**
 * Утилита для загрузки промптов из JSON файлов
 */

import { readFileSync } from "fs";
import { join } from "path";
import { logger } from "./logger";

// Кэш для загруженных промптов
const promptCache: Record<string, any> = {};

/**
 * Загружает промпт из JSON файла
 */
export function loadPrompt(promptType: "base" | "target" | "partner" | "child"): any {
  const cacheKey = promptType;
  
  // Проверяем кэш
  if (promptCache[cacheKey]) {
    return promptCache[cacheKey];
  }

  try {
    const filenameMap: Record<string, string> = {
      base: "базовый.json",
      target: "целевой.json",
      partner: "партнерский.json",
      child: "детский.json",
    };

    const filename = filenameMap[promptType];
    if (!filename) {
      throw new Error(`Unknown prompt type: ${promptType}`);
    }

    // Путь к файлам промптов (с учетом возможных вариантов названия папки)
    const possiblePaths = [
      join(process.cwd(), "от меня", "промпты в n8n", filename),
      join(process.cwd(), "от меня ", "промпты в n8n", filename), // с пробелом в конце
    ];
    
    let filePath = possiblePaths[0];
    let fileContent: string | null = null;
    
    // Пробуем найти файл по разным путям
    for (const path of possiblePaths) {
      try {
        fileContent = readFileSync(path, "utf-8");
        filePath = path;
        break;
      } catch (e) {
        // Продолжаем поиск
      }
    }
    
    if (!fileContent) {
      throw new Error(`Prompt file not found: ${filename}. Tried paths: ${possiblePaths.join(", ")}`);
    }
    
    const parsed = JSON.parse(fileContent);
    
    // Кэшируем результат
    promptCache[cacheKey] = parsed;
    return parsed;
  } catch (error: any) {
    logger.error(`[PROMPT-LOADER] Error loading prompt ${promptType}:`, {
      error: error?.message || String(error),
      code: error?.code,
    });
    throw error;
  }
}

/**
 * Получает системный промпт из загруженного промпта
 */
export function getSystemPrompt(promptType: "base" | "target" | "partner" | "child"): string {
  const prompt = loadPrompt(promptType);
  return prompt?.input?.[0]?.content || "";
}

/**
 * Получает JSON schema из загруженного промпта
 */
export function getJsonSchema(promptType: "base" | "target" | "partner" | "child"): any {
  const prompt = loadPrompt(promptType);
  return prompt?.text?.format?.schema || null;
}

/**
 * Получает модель из загруженного промпта
 */
export function getModel(promptType: "base" | "target" | "partner" | "child"): string {
  const prompt = loadPrompt(promptType);
  return prompt?.model || "gpt-4o-mini"; // fallback на стандартную модель
}

/**
 * Получает параметры reasoning из загруженного промпта
 */
export function getReasoning(promptType: "base" | "target" | "partner" | "child"): any {
  const prompt = loadPrompt(promptType);
  return prompt?.reasoning || null;
}
