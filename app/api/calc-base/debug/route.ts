import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";
import { refreshAccessToken } from "@/lib/auth";
import { getProfileCodes, formatCodesForPrompt, getCodeLegend } from "@/lib/sal-interpretations";
import { SAL_BASE_SCHEMA } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Эндпоинт для отладки - показывает пример промпта без отправки запроса
 */
export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams;
  const name = searchParams.get("name") || "Тестовый Клиент";
  const birthday = searchParams.get("birthday") || "1990-01-15";

  try {
    // Рассчитываем коды
    const profileCodes = getProfileCodes(birthday);
    if (!profileCodes) {
      return NextResponse.json(
        { error: "Failed to calculate codes" },
        { status: 400 }
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

    return NextResponse.json({
      success: true,
      profileCodes: profileCodes.codes,
      systemPrompt: {
        length: systemPrompt.length,
        preview: systemPrompt.substring(0, 500) + "...",
        full: systemPrompt,
      },
      userPrompt: {
        length: userPrompt.length,
        preview: userPrompt.substring(0, 500) + "...",
        full: userPrompt,
      },
      codesDescription: {
        length: codesDescription.length,
        full: codesDescription,
      },
      requestExample: {
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
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}

