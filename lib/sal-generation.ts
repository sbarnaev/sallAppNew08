/**
 * Библиотека для генерации консультаций САЛ на сервере
 * Заменяет функциональность n8n для генерации консультаций
 */

import { logger } from "./logger";
import { getProfileCodes, formatCodesForPrompt, ProfileCodes } from "./sal-interpretations";
import { loadPrompt, getSystemPrompt, getJsonSchema, getTextFormat, getModel, getReasoning } from "./prompt-loader";
import { validateConsultation } from "./consultation-validator";

export type ConsultationType = "base" | "target" | "partner" | "child";

export interface BaseCalculationInput {
  name: string;
  birthday: string;
  clientId?: number;
  gender?: string | null;
}

export interface TargetCalculationInput extends BaseCalculationInput {
  request: string;
}

export interface PartnerCalculationInput {
  name: string;
  birthday: string;
  partnerName: string;
  partnerBirthday: string;
  goal: string;
  clientId?: number;
  gender?: string | null;
}

export interface ChildCalculationInput {
  name: string;
  birthday: string;
  request?: string | null; // Опциональный запрос от родителей
  clientId?: number;
  gender?: string | null;
}

/**
 * Формирует пользовательские промпты для базового расчета
 * Возвращает массив из двух сообщений, как в оригинальном промпте n8n
 */
function createBaseUserPrompts(
  name: string,
  birthday: string,
  codesDescription: string
): Array<{ role: string; content: string }> {
  // Форматируем дату в DD.MM.YYYY
  const formattedBirthday = birthday.includes(".")
    ? birthday
    : birthday.split("-").reverse().join(".");

  return [
    {
      role: "user",
      content: `Входные данные профиля САЛ клиента ${name} ${formattedBirthday} в поле codes:`,
    },
    {
      role: "user",
      content: `Входные данные профиля САЛ в поле codes: ${codesDescription}`,
    },
  ];
}

/**
 * Формирует пользовательский промпт для целевого расчета
 */
function createTargetUserPrompt(
  request: string,
  codesDescription: string
): string {
  return `Запрос клиента: ${request} ${codesDescription}`;
}

/**
 * Формирует пользовательский промпт для партнерского расчета
 */
function createPartnerUserPrompt(
  goal: string,
  firstParticipant: { name: string; birthday: string; codesDescription: string },
  secondParticipant: { name: string; birthday: string; codesDescription: string }
): string {
  // Форматируем даты
  const formatBirthday = (bd: string) =>
    bd.includes(".") ? bd : bd.split("-").reverse().join(".");

  return `Запрос пары: ${goal}

Профиль первого участника: ${firstParticipant.name} ${formatBirthday(firstParticipant.birthday)} ${firstParticipant.codesDescription}

Профиль второго участника: ${secondParticipant.name} ${formatBirthday(secondParticipant.birthday)} ${secondParticipant.codesDescription}`;
}

/**
 * Формирует пользовательские промпты для детского расчета
 * Возвращает массив из двух сообщений, как в оригинальном промпте n8n
 * Второе сообщение может содержать запрос родителей, если он указан
 */
function createChildUserPrompts(
  name: string,
  birthday: string,
  codesDescription: string,
  request?: string | null
): Array<{ role: string; content: string }> {
  // Форматируем дату в DD.MM.YYYY
  const formattedBirthday = birthday.includes(".")
    ? birthday
    : birthday.split("-").reverse().join(".");

  const secondMessage = request
    ? `Входные данные профиля САЛ в поле codes: ${codesDescription}\n\nЗапрос родителей: ${request}`
    : `Входные данные профиля САЛ в поле codes: ${codesDescription}`;

  return [
    {
      role: "user",
      content: `Входные данные профиля САЛ ребенка ${name} ${formattedBirthday} в поле codes:`,
    },
    {
      role: "user",
      content: secondMessage,
    },
  ];
}

/**
 * Вызывает OpenAI API для генерации консультации
 */
async function callOpenAI(
  systemPrompt: string,
  userPrompts: string | Array<{ role: string; content: string }>,
  jsonSchemaOrTextFormat: any,
  model: string,
  reasoning: any
): Promise<any> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  // Определяем endpoint в зависимости от модели
  // Если модель содержит "gpt-5", используем специальный endpoint
  const isGpt5 = model.includes("gpt-5");
  const apiUrl = isGpt5
    ? "https://api.openai.com/v1/responses" // Специальный endpoint для gpt-5
    : "https://api.openai.com/v1/chat/completions"; // Стандартный endpoint

  // Формируем массив сообщений
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // Добавляем user сообщения
  if (typeof userPrompts === "string") {
    messages.push({ role: "user", content: userPrompts });
  } else if (Array.isArray(userPrompts)) {
    messages.push(...userPrompts);
  } else {
    throw new Error("Invalid userPrompts format");
  }

  const requestBody: any = {
    model,
    input: messages,
  };

  // Добавляем reasoning если есть
  if (reasoning) {
    requestBody.reasoning = reasoning;
  }

  // Добавляем JSON schema для структурированного ответа
  // Важно: для OpenAI Responses API при type=json_schema обязательны text.format.name и schema
  if (jsonSchemaOrTextFormat) {
    const schema = jsonSchemaOrTextFormat?.schema ?? jsonSchemaOrTextFormat;
    const name = jsonSchemaOrTextFormat?.name ?? "sal_consult_schema";
    const strict =
      typeof jsonSchemaOrTextFormat?.strict === "boolean"
        ? jsonSchemaOrTextFormat.strict
        : true;

    requestBody.text = {
      format: {
        type: "json_schema",
        name,
        strict,
        schema,
      },
    };
  }

  logger.debug("[SAL-GENERATION] OpenAI request:", {
    url: apiUrl,
    model,
    hasSchema: !!jsonSchemaOrTextFormat,
    hasReasoning: !!reasoning,
    systemPromptLength: systemPrompt.length,
    userPromptsCount: Array.isArray(userPrompts) ? userPrompts.length : 1,
    totalMessagesCount: messages.length,
    requestBodyKeys: Object.keys(requestBody),
  });

  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(120000), // 120 секунд таймаут
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        logger.error(`[SAL-GENERATION] OpenAI API error (attempt ${attempt}):`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 500),
        });

        // Если это ошибка клиента (4xx), не повторяем
        if (response.status < 500) {
          throw new Error(
            `OpenAI API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`
          );
        }

        lastError = new Error(
          `OpenAI API error: ${response.status} - ${errorText.substring(0, 200)}`
        );
        
        // Ждем перед повтором
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
        continue;
      }

      const data = await response.json().catch(() => ({}));
      
      logger.debug("[SAL-GENERATION] OpenAI response:", {
        hasOutput: !!data?.output,
        hasChoices: !!data?.choices,
        hasText: !!data?.text,
        keys: Object.keys(data),
      });
      
      // Обрабатываем ответ в зависимости от формата
      if (isGpt5) {
        // Для gpt-5 Responses API формат: { output: [...] } или { outputs: [...] }
        const outputs = data?.output || data?.outputs || [];
        
        if (Array.isArray(outputs) && outputs.length > 0) {
          // Ищем message в outputs
          const msg = outputs.find((o: any) => o.type === 'message');
          if (msg?.content) {
            // Ищем output_text в content
            const textContent = Array.isArray(msg.content)
              ? msg.content.find((c: any) => c.type === 'output_text')?.text
              : msg.content;
            
            if (textContent) {
              try {
                // Пытаемся распарсить JSON
                const parsed = typeof textContent === 'string' ? JSON.parse(textContent) : textContent;
                logger.debug("[SAL-GENERATION] Successfully parsed gpt-5 response");
                return parsed;
              } catch (e: any) {
                logger.error("[SAL-GENERATION] Failed to parse output_text as JSON:", {
                  error: e?.message || String(e),
                  textPreview: typeof textContent === 'string' ? textContent.substring(0, 300) : String(textContent).substring(0, 300),
                });
                throw new Error(`Ошибка парсинга JSON из ответа модели: ${e?.message || String(e)}`);
              }
            } else {
              logger.warn("[SAL-GENERATION] No output_text found in message content");
            }
          } else {
            logger.warn("[SAL-GENERATION] No message found in outputs");
          }
        }
        
        // Альтернативный формат: прямой output объект
        if (data?.output && typeof data.output === 'object' && !Array.isArray(data.output)) {
          logger.debug("[SAL-GENERATION] Using direct output object");
          return data.output;
        }
        
        // Альтернативный формат: output как строка
        if (data?.output && typeof data.output === 'string') {
          try {
            logger.debug("[SAL-GENERATION] Parsing output string");
            return JSON.parse(data.output);
          } catch (e: any) {
            logger.error("[SAL-GENERATION] Failed to parse output string:", e);
            throw new Error(`Ошибка парсинга JSON из output: ${e?.message || String(e)}`);
          }
        }
        
        // Альтернативный формат: text поле
        if (data?.text) {
          try {
            logger.debug("[SAL-GENERATION] Parsing text field");
            return typeof data.text === 'string' ? JSON.parse(data.text) : data.text;
          } catch (e: any) {
            logger.error("[SAL-GENERATION] Failed to parse text field:", e);
            throw new Error(`Ошибка парсинга JSON из text: ${e?.message || String(e)}`);
          }
        }
        
        // Если ничего не найдено, выбрасываем ошибку
        logger.error("[SAL-GENERATION] No valid response format found in gpt-5 response:", {
          keys: Object.keys(data),
          hasOutput: !!data?.output,
          hasOutputs: !!data?.outputs,
          hasText: !!data?.text,
        });
        throw new Error("Не найден output_text в ответе модели gpt-5");
      }
      
      // Стандартный формат OpenAI
      if (data?.choices?.[0]?.message?.content) {
        const content = data.choices[0].message.content;
        try {
          const parsed = JSON.parse(content);
          logger.debug("[SAL-GENERATION] Successfully parsed standard OpenAI response");
          return parsed;
        } catch (e: any) {
          logger.warn("[SAL-GENERATION] Failed to parse standard OpenAI response as JSON:", {
            error: e?.message || String(e),
            contentPreview: content.substring(0, 300),
          });
          // Если не удалось распарсить, возвращаем как есть (может быть текстовый ответ)
          return content;
        }
      }
      
      // Альтернативные форматы
      if (data?.output) {
        if (typeof data.output === 'string') {
          try {
            logger.debug("[SAL-GENERATION] Parsing output string");
            return JSON.parse(data.output);
          } catch (e: any) {
            logger.warn("[SAL-GENERATION] Failed to parse output string:", e);
            return data.output;
          }
        }
        logger.debug("[SAL-GENERATION] Using output object directly");
        return data.output;
      }
      
      if (data?.text) {
        try {
          logger.debug("[SAL-GENERATION] Parsing text field");
          return typeof data.text === 'string' ? JSON.parse(data.text) : data.text;
        } catch (e: any) {
          logger.warn("[SAL-GENERATION] Failed to parse text field:", e);
          return data.text;
        }
      }
      
      // Если ничего не найдено, логируем детали и выбрасываем ошибку
      logger.error("[SAL-GENERATION] Unexpected response format:", {
        keys: Object.keys(data),
        hasChoices: !!data?.choices,
        hasOutput: !!data?.output,
        hasText: !!data?.text,
        dataPreview: JSON.stringify(data).substring(0, 500),
      });
      throw new Error("Не удалось распознать формат ответа от API. Проверьте логи для деталей.");
    } catch (error: any) {
      logger.error(`[SAL-GENERATION] Request error (attempt ${attempt}):`, {
        message: error?.message || String(error),
        name: error?.name,
      });

      lastError = error;

      // Если это не таймаут или сетевой сбой, не повторяем
      if (error?.name !== "AbortError" && error?.name !== "TypeError") {
        throw error;
      }

      // Ждем перед повтором
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError || new Error("All retry attempts failed");
}

/**
 * Генерирует базовую консультацию
 */
export async function generateBaseConsultation(
  input: BaseCalculationInput
): Promise<any> {
  logger.debug("[SAL-GENERATION] Generating base consultation:", {
    name: input.name,
    birthday: input.birthday,
  });

  // Получаем коды и трактовки
  const profileCodes = getProfileCodes(input.birthday);
  if (!profileCodes) {
    throw new Error("Failed to calculate SAL codes");
  }

  const codesDescription = formatCodesForPrompt(profileCodes);

  // Загружаем промпт
  const systemPrompt = getSystemPrompt("base");
  const textFormat =
    getTextFormat("base") ?? {
      schema: getJsonSchema("base"),
      name: "sal_consult_prep",
      strict: true,
    };
  const model = getModel("base");
  const reasoning = getReasoning("base");

  // Формируем пользовательские промпты (два сообщения для базового расчета)
  const userPrompts = createBaseUserPrompts(input.name, input.birthday, codesDescription);

  // Вызываем API
  const result = await callOpenAI(systemPrompt, userPrompts, textFormat, model, reasoning);

  // Валидация результата
  const validation = validateConsultation(result, "base");
  if (!validation.valid) {
    logger.error("[SAL-GENERATION] Base consultation validation failed:", validation.errors);
    throw new Error(`Валидация базовой консультации не прошла: ${validation.errors.join(", ")}`);
  }
  if (validation.warnings.length > 0) {
    logger.warn("[SAL-GENERATION] Base consultation validation warnings:", validation.warnings);
  }

  logger.debug("[SAL-GENERATION] Base consultation generated and validated successfully");

  return result;
}

/**
 * Генерирует целевую консультацию
 */
export async function generateTargetConsultation(
  input: TargetCalculationInput
): Promise<any> {
  logger.debug("[SAL-GENERATION] Generating target consultation:", {
    name: input.name,
    birthday: input.birthday,
    requestLength: input.request?.length,
  });

  // Получаем коды и трактовки
  const profileCodes = getProfileCodes(input.birthday);
  if (!profileCodes) {
    throw new Error("Failed to calculate SAL codes");
  }

  const codesDescription = formatCodesForPrompt(profileCodes);

  // Загружаем промпт
  const systemPrompt = getSystemPrompt("target");
  const textFormat =
    getTextFormat("target") ?? {
      schema: getJsonSchema("target"),
      name: "sal_target_consult",
      strict: true,
    };
  const model = getModel("target");
  const reasoning = getReasoning("target");

  // Формируем пользовательский промпт
  const userPrompt = createTargetUserPrompt(input.request, codesDescription);

  // Вызываем API
  const result = await callOpenAI(systemPrompt, userPrompt, textFormat, model, reasoning);

  // Валидация результата
  const validation = validateConsultation(result, "target");
  if (!validation.valid) {
    logger.error("[SAL-GENERATION] Target consultation validation failed:", validation.errors);
    throw new Error(`Валидация целевой консультации не прошла: ${validation.errors.join(", ")}`);
  }
  if (validation.warnings.length > 0) {
    logger.warn("[SAL-GENERATION] Target consultation validation warnings:", validation.warnings);
  }

  logger.debug("[SAL-GENERATION] Target consultation generated and validated successfully");

  return result;
}

/**
 * Генерирует партнерскую консультацию
 */
export async function generatePartnerConsultation(
  input: PartnerCalculationInput
): Promise<any> {
  logger.debug("[SAL-GENERATION] Generating partner consultation:", {
    name: input.name,
    partnerName: input.partnerName,
    goalLength: input.goal?.length,
  });

  // Получаем коды и трактовки для обоих участников
  const firstProfileCodes = getProfileCodes(input.birthday);
  const secondProfileCodes = getProfileCodes(input.partnerBirthday);

  if (!firstProfileCodes || !secondProfileCodes) {
    throw new Error("Failed to calculate SAL codes for one or both participants");
  }

  const firstCodesDescription = formatCodesForPrompt(firstProfileCodes);
  const secondCodesDescription = formatCodesForPrompt(secondProfileCodes);

  // Загружаем промпт
  const systemPrompt = getSystemPrompt("partner");
  const textFormat =
    getTextFormat("partner") ?? {
      schema: getJsonSchema("partner"),
      name: "sal_partner_consult",
      strict: true,
    };
  const model = getModel("partner");
  const reasoning = getReasoning("partner");

  // Формируем пользовательский промпт
  const userPrompt = createPartnerUserPrompt(
    input.goal,
    {
      name: input.name,
      birthday: input.birthday,
      codesDescription: firstCodesDescription,
    },
    {
      name: input.partnerName,
      birthday: input.partnerBirthday,
      codesDescription: secondCodesDescription,
    }
  );

  // Вызываем API
  const result = await callOpenAI(systemPrompt, userPrompt, textFormat, model, reasoning);

  // Валидация результата
  const validation = validateConsultation(result, "partner");
  if (!validation.valid) {
    logger.error("[SAL-GENERATION] Partner consultation validation failed:", validation.errors);
    throw new Error(`Валидация партнерской консультации не прошла: ${validation.errors.join(", ")}`);
  }
  if (validation.warnings.length > 0) {
    logger.warn("[SAL-GENERATION] Partner consultation validation warnings:", validation.warnings);
  }

  logger.debug("[SAL-GENERATION] Partner consultation generated and validated successfully");

  return result;
}

/**
 * Генерирует детскую консультацию
 */
export async function generateChildConsultation(
  input: ChildCalculationInput
): Promise<any> {
  logger.debug("[SAL-GENERATION] Generating child consultation:", {
    name: input.name,
    birthday: input.birthday,
    hasRequest: !!input.request,
    requestLength: input.request?.length,
  });

  // Получаем коды и трактовки
  const profileCodes = getProfileCodes(input.birthday);
  if (!profileCodes) {
    throw new Error("Failed to calculate SAL codes");
  }

  const codesDescription = formatCodesForPrompt(profileCodes);

  // Загружаем промпт
  const systemPrompt = getSystemPrompt("child");
  const textFormat =
    getTextFormat("child") ?? {
      schema: getJsonSchema("child"),
      name: "sal_child_consult_structure",
      strict: true,
    };
  const model = getModel("child");
  const reasoning = getReasoning("child");

  // Формируем пользовательские промпты (два сообщения для детского расчета)
  const userPrompts = createChildUserPrompts(
    input.name,
    input.birthday,
    codesDescription,
    input.request || null
  );

  // Вызываем API
  const result = await callOpenAI(systemPrompt, userPrompts, textFormat, model, reasoning);

  // Валидация результата
  const validation = validateConsultation(result, "child");
  if (!validation.valid) {
    logger.error("[SAL-GENERATION] Child consultation validation failed:", validation.errors);
    throw new Error(`Валидация детской консультации не прошла: ${validation.errors.join(", ")}`);
  }
  if (validation.warnings.length > 0) {
    logger.warn("[SAL-GENERATION] Child consultation validation warnings:", validation.warnings);
  }

  logger.debug("[SAL-GENERATION] Child consultation generated and validated successfully");

  return result;
}

/**
 * Сохраняет результат генерации в профиль Directus
 * С retry логикой для надежности
 */
export async function saveConsultationToProfile(
  profileId: number,
  consultationResult: any,
  consultationType: ConsultationType,
  codes: number[],
  token: string,
  directusUrl: string
): Promise<void> {
  logger.debug("[SAL-GENERATION] Saving consultation to profile:", {
    profileId,
    type: consultationType,
    codesLength: codes.length,
    resultKeys: Object.keys(consultationResult || {}),
  });

  // Валидация входных данных
  if (!profileId || profileId <= 0) {
    throw new Error(`Invalid profileId: ${profileId}`);
  }
  if (!codes || codes.length !== 5) {
    throw new Error(`Invalid codes array: expected 5 codes, got ${codes.length}`);
  }
  if (!consultationResult || typeof consultationResult !== "object") {
    throw new Error("Invalid consultation result: must be an object");
  }

  const updatePayload: any = {
    raw_json: consultationResult,
    digits: codes,
  };

  // Для базового расчета также сохраняем в base_profile_json
  if (consultationType === "base") {
    updatePayload.base_profile_json = consultationResult;
  }

  // Retry логика для сохранения
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${directusUrl}/items/profiles/${profileId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(updatePayload),
        cache: "no-store",
        signal: AbortSignal.timeout(30000), // 30 секунд таймаут
      });

      if (response.ok) {
        // Проверяем, что данные действительно сохранились
        const savedData = await response.json().catch(() => ({}));
        logger.debug("[SAL-GENERATION] Consultation saved successfully:", {
          attempt,
          profileId,
          hasRawJson: !!savedData?.data?.raw_json,
          hasDigits: !!savedData?.data?.digits,
        });
        return;
      }

      // Если это ошибка клиента (4xx), не повторяем
      if (response.status < 500) {
        const errorText = await response.text().catch(() => "");
        logger.error("[SAL-GENERATION] Failed to save consultation (client error):", {
          status: response.status,
          error: errorText.substring(0, 500),
        });
        throw new Error(
          `Failed to save consultation: ${response.status} - ${errorText.substring(0, 200)}`
        );
      }

      // Серверная ошибка (5xx) - повторяем
      const errorText = await response.text().catch(() => "");
      lastError = new Error(
        `Failed to save consultation (attempt ${attempt}): ${response.status} - ${errorText.substring(0, 200)}`
      );
      logger.warn(`[SAL-GENERATION] Save attempt ${attempt} failed:`, {
        status: response.status,
        error: errorText.substring(0, 200),
      });

      // Ждем перед повтором
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    } catch (error: any) {
      lastError = error;
      logger.error(`[SAL-GENERATION] Save attempt ${attempt} error:`, {
        message: error?.message || String(error),
        name: error?.name,
      });

      // Если это не таймаут или сетевой сбой, не повторяем
      if (error?.name !== "AbortError" && error?.name !== "TypeError") {
        throw error;
      }

      // Ждем перед повтором
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError || new Error("All save attempts failed");
}

