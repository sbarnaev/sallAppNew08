import { NextResponse } from "next/server";
import { getProfileCodes, formatCodesForPrompt } from "@/lib/sal-interpretations";
import { SYSTEM_PROMPT_BASE_CALCULATION, createUserPromptForBaseCalculation } from "@/lib/prompt-base-calculation";
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

    // Используем готовый промпт из оптимизированного файла
    const systemPrompt = SYSTEM_PROMPT_BASE_CALCULATION;
    const userPrompt = createUserPromptForBaseCalculation(name, birthday, codesDescription);

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
        reasoning: { effort: "medium" },
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "sal_consult_prep",
            strict: true,
            schema: SAL_BASE_SCHEMA,
          },
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}

