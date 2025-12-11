import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";
import { refreshAccessToken } from "@/lib/auth";
import { getProfileCodes, formatCodesForPrompt, getCodeLegend } from "@/lib/sal-interpretations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// JSON Schema для структурированного ответа GPT
export const SAL_BASE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    opener: {
      type: "string",
      description: "Вводная фраза, которую консультант прочитает клиенту для установления доверия. Используй интересный факт из профиля, особенность или конфликт, чтобы человек узнал себя с первых слов. Простым, понятным языком."
    },
    personalitySummary: {
      type: "array",
      description: "Ровно 3-4 абзаца описания личности простым, понятным языком. В тексте указываются ресурсы с цифрами. Используй бытовые примеры и ситуации из жизни.",
      minItems: 3,
      maxItems: 4,
      items: { type: "string" }
    },
    strengths: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      description: "Ровно 7 сильных сторон клиента — его таланты и способности. Указывай ресурс с цифрой, например: 'Лидерские качества — Личность (1)'. НЕ ПУТАТЬ с resourceSignals!",
      items: { type: "string" }
    },
    weaknesses: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      description: "Ровно 7 слабых сторон клиента — риски, сложности, то, что может мешать. Указывай ресурс с цифрой, например: 'Импульсивность и рассеянность — Личность (3): риск недоведения дел до конца'. НЕ ПУТАТЬ с deficitSignals!",
      items: { type: "string" }
    },
    happinessFormula: {
      type: "array",
      description: "2–3 абзаца формулы счастья простым, понятным языком. Первые два абзаца — объяснение, последний (если есть) — примеры/сцены из жизни. Указывать ресурсы и цифры.",
      minItems: 2,
      maxItems: 3,
      items: { type: "string" }
    },
    resourceSignals: {
      type: "array",
      minItems: 10,
      maxItems: 10,
      description: "Ровно 10 признаков плюса — конкретные признаки, что ресурс работает хорошо. Например: 'Вы легко начинаете разговоры и люди тянутся — признак активной Личности (3)'. НЕ ПУТАТЬ с strengths!",
      items: { type: "string" }
    },
    deficitSignals: {
      type: "array",
      minItems: 10,
      maxItems: 10,
      description: "Ровно 10 признаков минуса — конкретные признаки, что ресурс в дефиците. Например: 'Трудно начать разговор, чувствуете себя неловко — признак дефицита Личности (3)'. НЕ ПУТАТЬ с weaknesses!",
      items: { type: "string" }
    },
    codesExplanation: {
      type: "array",
      description: "5-6 абзацев пояснения кодов простым, понятным языком. Объясни, из каких ресурсов состоит человек, как они сочетаются или конфликтуют, с бытовыми примерами. Указывать ресурсы и цифры. В конце должен быть синтез — к чему этот синтез приводит и что дает.",
      minItems: 5,
      maxItems: 6,
      items: { type: "string" }
    },
    conflicts: {
      type: "array",
      description: "Конфликты и проблемы — внутренние противоречия в профиле клиента. Описывай простым языком с примерами.",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          manifestations: { type: "array", items: { type: "string" } },
          advice: { type: "string" }
        },
        required: ["title", "description", "manifestations", "advice"]
      }
    },
    practices: {
      type: "object",
      description: "Практики для развития каждого ресурса. Для каждого ресурса (personality, connector, realization, generator, mission) — ровно 3 практики. Каждая практика содержит title, p1, p2. Описывай простым языком.",
      additionalProperties: false,
      properties: {
        personality: { "$ref": "#/$defs/practiceTriplet" },
        connector: { "$ref": "#/$defs/practiceTriplet" },
        realization: { "$ref": "#/$defs/practiceTriplet" },
        generator: { "$ref": "#/$defs/practiceTriplet" },
        mission: { "$ref": "#/$defs/practiceTriplet" }
      },
      required: ["personality", "connector", "realization", "generator", "mission"]
    }
  },
  required: [
    "opener",
    "personalitySummary",
    "strengths",
    "weaknesses",
  "happinessFormula",
    "resourceSignals",
    "deficitSignals",
    "codesExplanation",
    "conflicts",
    "practices"
  ],
  $defs: {
    practiceTriplet: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          p1: { type: "string" },
          p2: { type: "string" }
        },
        required: ["title", "p1", "p2"]
      }
    }
  }
};

/**
 * Сохраняет промежуточные результаты в Directus
 * Гарантирует сохранение данных даже при ошибках
 */
async function saveToDirectus(
  profileId: number,
  partialData: any,
  token: string,
  directusUrl: string,
  refreshToken: string | undefined,
  retries: number = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Обновляем токен перед каждой попыткой
      let currentToken = token;
      if (refreshToken && attempt > 1) {
        const freshToken = await refreshAccessToken(refreshToken);
        if (freshToken) currentToken = freshToken;
      }

      const response = await fetch(`${directusUrl}/items/profiles/${profileId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          base_profile_json: partialData, // Новое поле для нового формата базового расчета
        }),
        cache: "no-store",
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`[CALC-BASE] Error saving to Directus (attempt ${attempt}/${retries}):`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 200),
          profileId
        });
        
        // Если это 401 и есть refresh token, попробуем обновить
        if (response.status === 401 && attempt < retries && refreshToken) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        if (attempt === retries) {
          return false;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      console.log(`[CALC-BASE] Successfully saved to Directus, profileId: ${profileId}, attempt: ${attempt}`);
      return true;
    } catch (error: any) {
      console.error(`[CALC-BASE] Error saving to Directus (attempt ${attempt}/${retries}):`, {
        error: error?.message || String(error),
        profileId
      });
      
      if (attempt === retries) {
        return false;
      }
      
      // Экспоненциальная задержка перед повтором
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  return false;
}

export async function POST(req: Request) {
  console.log("[CALC-BASE] ===== POST /api/calc-base called =====");
  console.log("[CALC-BASE] Request URL:", req.url);
  console.log("[CALC-BASE] Request method:", req.method);
  console.log("[CALC-BASE] Request headers:", Object.fromEntries(req.headers.entries()));

  let token = cookies().get("directus_access_token")?.value;
  const refreshToken = cookies().get("directus_refresh_token")?.value;
  const directusUrl = getDirectusUrl();
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!token && refreshToken) {
    const freshToken = await refreshAccessToken(refreshToken);
    if (freshToken) token = freshToken;
  }

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!openaiKey) {
    return NextResponse.json(
      { message: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const { clientId, name, birthday, stream: wantStream } = payload;
  
  // Логируем входящие параметры
  console.log("[CALC-BASE] ===== INCOMING REQUEST PARAMS =====");
  console.log("[CALC-BASE] clientId:", clientId);
  console.log("[CALC-BASE] name:", name);
  console.log("[CALC-BASE] birthday:", birthday);
  console.log("[CALC-BASE] stream (wantStream):", wantStream);
  console.log("[CALC-BASE] ===== END INCOMING PARAMS =====");

  // Валидация входных данных
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json(
      { message: "Имя клиента обязательно и не может быть пустым" },
      { status: 400 }
    );
  }

  if (!birthday || typeof birthday !== 'string') {
    return NextResponse.json(
      { message: "Дата рождения обязательна" },
      { status: 400 }
    );
  }

  // Проверяем формат даты (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(birthday)) {
    return NextResponse.json(
      { message: "Неверный формат даты рождения. Ожидается формат YYYY-MM-DD" },
      { status: 400 }
    );
  }

  // Рассчитываем коды и получаем трактовки
  const profileCodes = getProfileCodes(birthday);
  if (!profileCodes) {
    console.error("[CALC-BASE] Failed to calculate codes for birthday:", birthday);
    return NextResponse.json(
      { message: "Не удалось рассчитать коды САЛ по указанной дате рождения. Проверьте корректность даты." },
      { status: 400 }
    );
  }

  // Создаем профиль в Directus
  let profileId: number | null = null;
  if (directusUrl) {
    try {
      let ownerUserId: string | null = null;
      try {
        const meRes = await fetch(`${directusUrl}/users/me`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          cache: "no-store",
        });
        if (meRes.ok) {
          const me = await meRes.json().catch(() => ({}));
          ownerUserId = me?.data?.id || null;
        }
      } catch {}

      const createRes = await fetch(`${directusUrl}/items/profiles`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId ? Number(clientId) : null,
          ...(ownerUserId ? { owner_user: ownerUserId } : {}),
          digits: profileCodes.codes, // Сохраняем коды сразу
        }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (createRes.ok && createData?.data?.id) {
        profileId = Number(createData.data.id);
        console.log("[CALC-BASE] Profile created:", profileId);
      }
    } catch (error) {
      console.error("[CALC-BASE] Error creating profile:", error);
    }
  }

  if (!profileId) {
    return NextResponse.json(
      { message: "Failed to create profile" },
      { status: 500 }
    );
  }

  // Формируем промпт
  const codesDescription = formatCodesForPrompt(profileCodes);
  const codeLegend = getCodeLegend();

  // Проверяем, что у нас есть все необходимые данные для промпта
  if (!codesDescription || codesDescription.trim().length === 0) {
    console.error("[CALC-BASE] Empty codes description");
    return NextResponse.json(
      { message: "Не удалось сформировать описание кодов. Проверьте данные профиля." },
      { status: 500 }
    );
  }

  // Детальное логирование для отладки
  console.log("[CALC-BASE] ===== PROMPT DEBUG INFO =====");
  console.log("[CALC-BASE] Profile ID:", profileId);
  console.log("[CALC-BASE] Client name:", name);
  console.log("[CALC-BASE] Birthday:", birthday);
  console.log("[CALC-BASE] Codes calculated:", profileCodes.codes);
  console.log("[CALC-BASE] Codes description length:", codesDescription.length);
  console.log("[CALC-BASE] Codes description preview:", codesDescription.substring(0, 200) + "...");

  const systemPrompt = `Ты — эксперт по системному анализу личности (САЛ), который помогает консультанту провести консультацию для клиента. Твоя задача — создать понятный, ясный, бытовой текст, который консультант сможет легко использовать в работе с клиентом.

${codeLegend}

## СТИЛЬ И ТОНАЛЬНОСТЬ

ВАЖНО: Пиши простым, понятным языком, как будто объясняешь другу. Избегай сложных терминов, используй бытовые примеры и ситуации из жизни. Текст должен быть:
- Живым и образным, с конкретными примерами из повседневной жизни
- Поддерживающим и вдохновляющим, но честным
- Структурированным и легко читаемым
- С акцентом на практическую применимость

## ЖЁСТКИЕ ПРАВИЛА ПО СТРУКТУРЕ

### opener (вводная фраза)
Одна яркая, запоминающаяся фраза (2-4 предложения), которую консультант прочитает клиенту для установления доверия. Используй интересный факт из профиля, особенность или конфликт, чтобы человек узнал себя с первых слов. Должна вызывать "эффект узнавания".

### personalitySummary (описание личности)
Ровно 3-4 абзаца. Каждый абзац — законченная мысль. Первый абзац — общее впечатление о человеке. Второй — как проявляются коды в поведении. Третий — особенности взаимодействия с миром. Четвертый (если есть) — синтез и уникальность. В тексте обязательно указывай ресурсы с цифрами, например: "Ваша Личность (3) делает вас..."

### codesExplanation (пояснения кодов)
Ровно 5-6 абзацев. Простое, понятное объяснение того, как каждый код работает в этом человеке, в чем проявляется, и синтез — к чему этот синтез приводит и что дает. Структура:
- Абзац 1-2: Как работает каждый код по отдельности (с примерами)
- Абзац 3-4: Как коды взаимодействуют между собой
- Абзац 5-6: Синтез — к чему это приводит, что дает человеку, какие возможности открывает

### strengths (сильные стороны)
Ровно 7 пунктов. Это то, что у человека хорошо получается, его таланты и способности. Каждый пункт должен быть конкретным и практичным. Формат: "Краткое название — Ресурс (цифра): описание". Пример: "Лидерские качества — Личность (1): Вы естественно берете инициативу и ведете за собой, люди доверяют вашему видению".

### weaknesses (слабые стороны)
Ровно 7 пунктов. Это риски, сложности, то, что может мешать. НЕ ПУТАТЬ с deficitSignals! Формат: "Название риска — Ресурс (цифра): описание риска и его последствий". Пример: "Импульсивность и рассеянность — Личность (3): риск недоведения дел до конца из-за переключения внимания".

### resourceSignals (признаки плюса)
Ровно 10 пунктов. Это конкретные, наблюдаемые признаки, что ресурс работает хорошо. Формат: "Конкретное проявление — признак активной Ресурс (цифра)". Пример: "Вы легко начинаете разговоры и люди тянутся к вам — признак активной Личности (3)".

### deficitSignals (признаки минуса)
Ровно 10 пунктов. Это конкретные, наблюдаемые признаки, что ресурс в дефиците. Формат: "Конкретное проявление — признак дефицита Ресурс (цифра)". Пример: "Трудно начать разговор, чувствуете себя неловко — признак дефицита Личности (3)".

### happinessFormula (формула счастья)
2-3 абзаца. Первые два абзаца — объяснение, что делает человека счастливым, исходя из его кодов. Последний (если есть) — конкретные примеры/сцены из жизни, когда человек чувствует себя в ресурсе. Указывай ресурсы и цифры.

### conflicts (конфликты и проблемы)
Ровно 5 конфликтов. Каждый конфликт — это внутреннее противоречие в профиле. Структура каждого:
- title: Краткое название конфликта (например: "Конфликт 2↔7")
- description: Объяснение сути конфликта простым языком
- manifestations: Массив из 3-5 конкретных проявлений этого конфликта в жизни
- advice: Практический совет, как работать с этим конфликтом

### practices (практики)
Для каждого из 5 ресурсов (personality, connector, realization, generator, mission) — ровно 3 практики. Каждая практика:
- title: Название практики
- p1: Первый абзац — описание и зачем это нужно
- p2: Второй абзац — как именно делать, конкретные шаги

## ВАЖНЫЕ ПРИНЦИПЫ

1. Во всех описательных местах явно указывай ресурс и его цифру в скобках, например: "Коннектор (2)" или "Личность (3)".
2. Избегай общих фраз. Используй конкретные примеры и ситуации.
3. Балансируй между поддержкой и честностью. Не только хвали, но и указывай на реальные сложности.
4. Текст должен быть практичным — консультант должен понимать, как это использовать в работе с клиентом.
5. Каждый блок должен быть самодостаточным, но при этом логично вписываться в общую картину.`;

  const userPrompt = `Входные данные профиля САЛ клиента ${name} ${birthday.split('-').reverse().join('.')} в поле codes:

${codesDescription}`;

  // Логируем полный промпт для отладки
  console.log("[CALC-BASE] ===== FULL PROMPT =====");
  console.log("[CALC-BASE] System prompt length:", systemPrompt.length);
  console.log("[CALC-BASE] User prompt length:", userPrompt.length);
  console.log("[CALC-BASE] System prompt preview:", systemPrompt.substring(0, 300) + "...");
  console.log("[CALC-BASE] User prompt:", userPrompt);
  console.log("[CALC-BASE] ===== END PROMPT DEBUG =====");

  // Проверяем, нужен ли стриминг
  const streamParam = new URL(req.url).searchParams.get("stream");
  const shouldStream = wantStream !== false && (wantStream === true || streamParam === "1");
  
  console.log("[CALC-BASE] ===== STREAMING CHECK =====");
  console.log("[CALC-BASE] wantStream:", wantStream);
  console.log("[CALC-BASE] streamParam:", streamParam);
  console.log("[CALC-BASE] shouldStream:", shouldStream);
  console.log("[CALC-BASE] ===== END STREAMING CHECK =====");

  if (shouldStream) {
    console.log("[CALC-BASE] Using STREAMING mode");
    // Реализуем стриминг с сохранением в Directus
    const encoder = new TextEncoder();
    
    // Сначала отправляем profileId клиенту
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // Отправляем profileId сразу
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ profileId })}\n\n`)
        );

        try {
          const requestBody = {
            model: "gpt-5-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "sal_consult_prep",
                strict: true,
                schema: SAL_BASE_SCHEMA,
              },
            },
            temperature: 0.7,
            stream: true,
          };

          console.log("[CALC-BASE] ===== OPENAI REQUEST =====");
          console.log("[CALC-BASE] Model: gpt-5-mini");
          console.log("[CALC-BASE] Messages count:", requestBody.messages.length);
          console.log("[CALC-BASE] System message length:", systemPrompt.length);
          console.log("[CALC-BASE] User message length:", userPrompt.length);
          console.log("[CALC-BASE] Has OpenAI key:", !!openaiKey);
          console.log("[CALC-BASE] ===== SENDING REQUEST =====");

          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify(requestBody),
          });

          console.log("[CALC-BASE] ===== OPENAI RESPONSE =====");
          console.log("[CALC-BASE] Status:", response.status);
          console.log("[CALC-BASE] Status text:", response.statusText);
          console.log("[CALC-BASE] OK:", response.ok);

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            let errorMessage = "Ошибка при обращении к OpenAI API";
            
            console.error("[CALC-BASE] ===== OPENAI ERROR =====");
            console.error("[CALC-BASE] Status:", response.status);
            console.error("[CALC-BASE] Error text:", errorText);
            
            // Улучшенная обработка ошибок OpenAI
            try {
              const errorData = JSON.parse(errorText);
              console.error("[CALC-BASE] Parsed error data:", errorData);
              if (errorData?.error?.message) {
                errorMessage = errorData.error.message;
              } else if (errorData?.message) {
                errorMessage = errorData.message;
              }
            } catch {
              // Если не удалось распарсить, используем текст ошибки
              if (errorText) {
                errorMessage = errorText.substring(0, 200);
              }
            }

            // Специфичные сообщения для разных статусов
            if (response.status === 401) {
              errorMessage = "Неверный API ключ OpenAI. Проверьте настройки сервера.";
            } else if (response.status === 429) {
              errorMessage = "Превышен лимит запросов к OpenAI API. Попробуйте позже.";
            } else if (response.status === 500) {
              errorMessage = "Внутренняя ошибка OpenAI. Попробуйте позже.";
            }

            console.error("[CALC-BASE] Final error message:", errorMessage);

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
            );
            controller.close();
            return;
          }

          console.log("[CALC-BASE] ===== STREAM STARTED =====");
          console.log("[CALC-BASE] Response OK, starting to read stream");

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          if (!reader) {
            controller.close();
            return;
          }

          let buffer = "";
          let accumulatedContent = "";
          let lastSaveTime = Date.now();
          const SAVE_INTERVAL = 5000; // Сохраняем каждые 5 секунд
          let hasFinalMessage = false;
          let finalParsedData: any = null;

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (!line.trim() || !line.startsWith("data:")) continue;
                const payload = line.slice(5).trim();
                if (payload === "[DONE]") {
                  // Сохраняем финальный результат в Directus
                  if (finalParsedData && profileId) {
                    const saved = await saveToDirectus(profileId, finalParsedData, token!, directusUrl, refreshToken);
                    if (saved) {
                      console.log("[CALC-BASE] Final data saved to Directus");
                    } else {
                      console.error("[CALC-BASE] Failed to save final data after retries");
                    }
                  } else if (accumulatedContent && profileId) {
                    // Пытаемся сохранить накопленный контент, даже если не полный
                    try {
                      const parsed = JSON.parse(accumulatedContent);
                      const saved = await saveToDirectus(profileId, parsed, token!, directusUrl, refreshToken);
                      if (saved) {
                        console.log("[CALC-BASE] Final data saved to Directus (from accumulated)");
                      }
                    } catch (e) {
                      console.error("[CALC-BASE] Error parsing final content, saving raw:", e);
                      // Сохраняем хотя бы сырые данные
                      await saveToDirectus(profileId, { raw_content: accumulatedContent }, token!, directusUrl, refreshToken);
                    }
                  }
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                  return;
                }

                try {
                  const json = JSON.parse(payload);
                  
                  // При JSON schema streaming, полный message приходит в конце
                  if (json?.choices?.[0]?.message?.content) {
                    accumulatedContent = json.choices[0].message.content;
                    hasFinalMessage = true;
                    console.log("[CALC-BASE] ===== FINAL MESSAGE RECEIVED =====");
                    console.log("[CALC-BASE] Content length:", accumulatedContent.length);
                    console.log("[CALC-BASE] Content preview:", accumulatedContent.substring(0, 300) + "...");
                    try {
                      finalParsedData = JSON.parse(accumulatedContent);
                      console.log("[CALC-BASE] Successfully parsed JSON");
                      console.log("[CALC-BASE] Parsed data keys:", Object.keys(finalParsedData));
                      // Сохраняем сразу, когда получили полный JSON
                      if (finalParsedData && profileId && typeof finalParsedData === 'object') {
                        console.log("[CALC-BASE] Attempting to save to Directus...");
                        const saved = await saveToDirectus(profileId, finalParsedData, token!, directusUrl, refreshToken);
                        if (saved) {
                          console.log("[CALC-BASE] ✅ Complete data saved to Directus successfully");
                          lastSaveTime = Date.now();
                          // Отправляем клиенту сигнал о завершении
                          controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ type: "complete", profileId })}\n\n`)
                          );
                        } else {
                          console.error("[CALC-BASE] ❌ Failed to save complete data to Directus");
                        }
                      } else {
                        console.error("[CALC-BASE] Invalid parsed data:", { 
                          hasData: !!finalParsedData, 
                          profileId, 
                          isObject: typeof finalParsedData === 'object' 
                        });
                      }
                    } catch (e) {
                      console.error("[CALC-BASE] ❌ Error parsing final message:", e);
                      console.error("[CALC-BASE] Content that failed to parse:", accumulatedContent.substring(0, 500));
                    }
                  }
                  
                  const delta = json?.choices?.[0]?.delta;
                  
                  // При JSON schema streaming, content может приходить частями как JSON строка
                  if (delta?.content) {
                    accumulatedContent += delta.content;
                    
                    // Отправляем клиенту для визуального отображения прогресса
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: "progress", length: accumulatedContent.length })}\n\n`)
                    );

                    // Периодически пытаемся сохранить промежуточные результаты
                    const now = Date.now();
                    if (now - lastSaveTime > SAVE_INTERVAL && accumulatedContent.length > 100) {
                      try {
                        const partial = JSON.parse(accumulatedContent);
                        if (partial && profileId && typeof partial === 'object') {
                          const saved = await saveToDirectus(profileId, partial, token!, directusUrl, refreshToken);
                          if (saved) {
                            console.log("[CALC-BASE] Intermediate data saved to Directus");
                            lastSaveTime = now;
                          }
                        }
                      } catch (e) {
                        // Игнорируем ошибки парсинга неполного JSON - это нормально
                      }
                    }
                  }
                } catch (e) {
                  // Игнорируем ошибки парсинга отдельных чанков
                  console.warn("[CALC-BASE] Failed to parse chunk:", e);
                }
              }
            }

            // Если стрим закончился без [DONE], все равно пытаемся сохранить
            if (accumulatedContent && profileId && !hasFinalMessage) {
              try {
                const parsed = JSON.parse(accumulatedContent);
                if (parsed && typeof parsed === 'object') {
                  const saved = await saveToDirectus(profileId, parsed, token!, directusUrl, refreshToken);
                  if (saved) {
                    console.log("[CALC-BASE] Data saved to Directus (stream ended without DONE)");
                  }
                } else {
                  // Сохраняем сырые данные как fallback
                  await saveToDirectus(profileId, { raw_content: accumulatedContent, error: "invalid_json" }, token!, directusUrl, refreshToken);
                  console.log("[CALC-BASE] Saved raw content as fallback");
                }
              } catch (e) {
                console.error("[CALC-BASE] Error parsing content at stream end:", e);
                // Сохраняем сырые данные как fallback
                await saveToDirectus(profileId, { raw_content: accumulatedContent, error: "parse_error", errorMessage: String(e) }, token!, directusUrl, refreshToken);
                console.log("[CALC-BASE] Saved raw content after parse error");
              }
            }

            // Гарантируем, что финальные данные сохранены
            if (finalParsedData && profileId && !hasFinalMessage) {
              const saved = await saveToDirectus(profileId, finalParsedData, token!, directusUrl, refreshToken);
              if (saved) {
                console.log("[CALC-BASE] Final data saved to Directus (fallback)");
              }
            }

            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch (error: any) {
            console.error("[CALC-BASE] Stream error:", error);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)
            );
          } finally {
            controller.close();
          }
        } catch (error: any) {
          console.error("[CALC-BASE] Outer stream error:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  // Non-streaming вариант
  console.log("[CALC-BASE] Using NON-STREAMING mode");
  try {
    const requestBody = {
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "sal_consult_prep",
          strict: true,
          schema: SAL_BASE_SCHEMA,
        },
      },
      temperature: 0.7,
    };

    console.log("[CALC-BASE] ===== OPENAI REQUEST (NON-STREAMING) =====");
    console.log("[CALC-BASE] Model: gpt-5-mini");
    console.log("[CALC-BASE] Messages count:", requestBody.messages.length);
    console.log("[CALC-BASE] Has OpenAI key:", !!openaiKey);
    console.log("[CALC-BASE] ===== SENDING REQUEST =====");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        reasoning: { effort: "medium" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "sal_consult_prep",
            strict: true,
            schema: SAL_BASE_SCHEMA,
          },
        },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return NextResponse.json(
        { message: "OpenAI API error", error: errorText },
        { status: response.status }
      );
    }

    const data = await response.json().catch(() => ({}));
    const content = data?.choices?.[0]?.message?.content;
    
    if (!content) {
      return NextResponse.json(
        { message: "No content in response" },
        { status: 500 }
      );
    }

    // Парсим JSON ответ
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      return NextResponse.json(
        { message: "Failed to parse response", error: String(e) },
        { status: 500 }
      );
    }

    // Сохраняем в Directus в новое поле base_profile_json
    if (profileId) {
      try {
        const response = await fetch(`${directusUrl}/items/profiles/${profileId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token!}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            base_profile_json: parsed, // Сохраняем в новое поле
          }),
          cache: "no-store",
        });
        
        if (!response.ok) {
          console.error("[CALC-BASE] Failed to save base_profile_json:", response.status);
        } else {
          console.log("[CALC-BASE] Successfully saved base_profile_json to Directus");
        }
      } catch (error) {
        console.error("[CALC-BASE] Error saving base_profile_json:", error);
      }
    }

    return NextResponse.json({
      profileId,
      data: parsed,
    });
  } catch (error: any) {
    console.error("[CALC-BASE] Error:", error);
    return NextResponse.json(
      { message: "Calculation failed", error: error.message },
      { status: 500 }
    );
  }
}

