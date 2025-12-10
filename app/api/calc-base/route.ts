import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";
import { refreshAccessToken } from "@/lib/auth";
import { getProfileCodes, formatCodesForPrompt, getCodeLegend } from "@/lib/sal-interpretations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// JSON Schema для структурированного ответа GPT
const SAL_BASE_SCHEMA = {
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
 */
async function saveToDirectus(
  profileId: number,
  partialData: any,
  token: string,
  directusUrl: string
): Promise<void> {
  try {
    const response = await fetch(`${directusUrl}/items/profiles/${profileId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        raw_json: partialData,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[CALC-BASE] Error saving to Directus:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 200)
      });
    } else {
      console.log("[CALC-BASE] Successfully saved to Directus, profileId:", profileId);
    }
  } catch (error) {
    console.error("[CALC-BASE] Error saving to Directus:", error);
    // Не прерываем процесс, если сохранение не удалось
  }
}

export async function POST(req: Request) {
  console.log("[CALC-BASE] ===== POST /api/calc-base called =====");

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

  const { clientId, name, birthday, stream: wantStream = true } = payload;

  if (!name || !birthday) {
    return NextResponse.json(
      { message: "Name and birthday are required" },
      { status: 400 }
    );
  }

  // Рассчитываем коды и получаем трактовки
  const profileCodes = getProfileCodes(birthday);
  if (!profileCodes) {
    return NextResponse.json(
      { message: "Failed to calculate codes" },
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

  const systemPrompt = `Ты — эксперт по системному анализу личности (САЛ), который помогает консультанту провести консультацию для клиента. Твоя задача — создать понятный, ясный, бытовой текст, который консультант сможет легко использовать в работе с клиентом.

${codeLegend}

ВАЖНО: Пиши простым, понятным языком, как будто объясняешь другу. Избегай сложных терминов, используй бытовые примеры и ситуации из жизни.

ЖЁСТКИЕ ПРАВИЛА ПО СТРУКТУРЕ:
- strengths (сильные стороны) — ровно 7 пунктов. Это то, что у человека хорошо получается, его таланты и способности. Указывай ресурс с цифрой, например: "Лидерские качества — Личность (1)".
- weaknesses (слабые стороны) — ровно 7 пунктов. Это риски, сложности, то, что может мешать. НЕ ПУТАТЬ с resourceSignals! Указывай ресурс с цифрой, например: "Импульсивность и рассеянность — Личность (3): риск недоведения дел до конца".
- resourceSignals (признаки плюса) — ровно 10 пунктов. Это конкретные признаки, что ресурс работает хорошо, например: "Вы легко начинаете разговоры и люди тянутся — признак активной Личности (3)".
- deficitSignals (признаки минуса) — ровно 10 пунктов. Это конкретные признаки, что ресурс в дефиците, например: "Трудно начать разговор, чувствуете себя неловко — признак дефицита Личности (3)".

Во всех описательных местах явно указывай ресурс и его цифру в скобках, например: "Коннектор (2)".

В opener напиши вводную фразу, которую консультант прочитает клиенту для установления доверия. Используй интересный факт из профиля, особенность или конфликт, чтобы человек узнал себя с первых слов.`;

  const userPrompt = `Входные данные профиля САЛ клиента ${name} ${birthday.split('-').reverse().join('.')} в поле codes:

${codesDescription}`;

  // Проверяем, нужен ли стриминг
  const streamParam = new URL(req.url).searchParams.get("stream");
  const shouldStream = wantStream || streamParam === "1";

  if (shouldStream) {
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
              stream: true,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: errorText })}\n\n`)
            );
            controller.close();
            return;
          }

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
                try {
                  const parsed = JSON.parse(accumulatedContent);
                  if (parsed && profileId) {
                    await saveToDirectus(profileId, parsed, token!, directusUrl);
                    console.log("[CALC-BASE] Final data saved to Directus");
                  }
                } catch (e) {
                  console.error("[CALC-BASE] Error parsing final content:", e);
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }

              try {
                const json = JSON.parse(payload);
                const delta = json?.choices?.[0]?.delta;
                
                // При JSON schema streaming, content может приходить частями
                if (delta?.content) {
                  accumulatedContent += delta.content;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(delta.content)}\n\n`)
                  );

                  // Периодически сохраняем промежуточные результаты
                  const now = Date.now();
                  if (now - lastSaveTime > SAVE_INTERVAL) {
                    try {
                      const partial = JSON.parse(accumulatedContent);
                      if (partial && profileId) {
                        await saveToDirectus(profileId, partial, token!, directusUrl);
                        console.log("[CALC-BASE] Intermediate data saved to Directus");
                        lastSaveTime = now;
                      }
                    } catch (e) {
                      // Игнорируем ошибки парсинга неполного JSON
                    }
                  }
                }

                // Если пришел полный message (в конце стрима)
                if (json?.choices?.[0]?.message?.content) {
                  accumulatedContent = json.choices[0].message.content;
                }
              } catch (e) {
                // Игнорируем ошибки парсинга
              }
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
  try {
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

    // Сохраняем в Directus
    if (profileId) {
      await saveToDirectus(profileId, parsed, token!, directusUrl);
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

