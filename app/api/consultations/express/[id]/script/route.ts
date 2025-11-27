import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDirectusUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "dummy", // Prevent build crash if env is missing
});

export async function POST(
    req: NextRequest,
    ctx: { params: { id: string } }
) {
    const token = cookies().get("directus_access_token")?.value;
    const baseUrl = getDirectusUrl();
    const { id } = ctx.params;

    if (!token || !baseUrl) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ message: "OpenAI API key not configured" }, { status: 500 });
    }

    try {
        let body: any = {};
        try {
            body = await req.json();
        } catch (error) {
            return NextResponse.json({ message: "Ошибка обработки данных запроса" }, { status: 400 });
        }
        const { topic, customRequest, stage = "diagnostics", confirmedIssues = [], clientDesires = "" } = body;
        const requestText = customRequest || topic || "Общий разбор";

        // 1. Fetch consultation and profile data
        const consultationRes = await fetch(`${baseUrl}/items/consultations/${id}?fields=*,client_id.*`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });

        if (!consultationRes.ok) {
            return NextResponse.json({ message: "Consultation not found" }, { status: 404 });
        }

        const { data: consultation } = await consultationRes.json();
        const client = consultation.client_id;

        // Fetch profile data including book_information
        let profileData = null;
        if (consultation.profile_id) {
            const profileRes = await fetch(`${baseUrl}/items/profiles/${consultation.profile_id}?fields=*`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            });
            if (profileRes.ok) {
                const json = await profileRes.json();
                profileData = json.data;
            }
        }

        // If no profile linked, try to find latest profile for client
        if (!profileData) {
            const profilesRes = await fetch(`${baseUrl}/items/profiles?filter[client_id][_eq]=${client.id}&sort=-created_at&limit=1`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            });
            if (profilesRes.ok) {
                const json = await profilesRes.json();
                if (json.data?.length > 0) {
                    profileData = json.data[0];
                }
            }
        }

        if (!profileData) {
            return NextResponse.json({ message: "Profile data not found. Please wait for calculation." }, { status: 400 });
        }

        // Extract book information
        const bookInfo = profileData.book_information || {};
        const codes = profileData.digits || profileData.raw_json?.codes || "Неизвестно";

        let systemPrompt = "";
        let userPrompt = "";

        if (stage === "diagnostics") {
            // STAGE 1: Generate Questions for Point A and Point B
            systemPrompt = `Ты - эксперт по системе самопознания САЛ.
Твоя задача - помочь консультанту провести глубокую диагностику клиента.
Нужно сгенерировать два набора вопросов:
1. Для Точки А (Боль): вопросы, которые вскроют негативные проявления кодов клиента.
2. Для Точки Б (Видение): вопросы, которые помогут клиенту помечтать и увидеть свой потенциал (плюсовые проявления).

Клиент: ${client.name} (${client.birth_date})
Запрос: "${requestText}"

Данные из учебника (Book Information):
${JSON.stringify(bookInfo, null, 2)}

Коды клиента:
${JSON.stringify(codes)}

Формат ответа (JSON):
{
  "point_a_questions": ["Вопрос 1 (про боль/минус)", "Вопрос 2", ...],
  "point_b_questions": ["Вопрос 1 (про мечту/плюс)", "Вопрос 2", ...]
}

Вопросы должны быть глубокими, "про клиента", чтобы он узнал себя.
Для Точки А: спрашивай про конкретные трудности, свойственные его кодам.
Для Точки Б: спрашивай, хочет ли он чувствовать себя так, как описано в плюсе его кодов.`;
            userPrompt = "Сгенерируй вопросы для диагностики.";
        } else {
            // STAGE 2: Generate Solution
            systemPrompt = `Ты - эксперт по системе самопознания САЛ.
Твоя задача - составить финальный скрипт продажи, который свяжет Боль клиента (Точка А) и его Желания (Точка Б) через решение САЛ.

Клиент: ${client.name} (${client.birth_date})
Запрос: "${requestText}"

Подтвержденные проблемы (Точка А):
${JSON.stringify(confirmedIssues)}

Желания клиента (Точка Б):
"${clientDesires}"

Данные из учебника (Book Information):
${JSON.stringify(bookInfo, null, 2)}

Коды клиента:
${JSON.stringify(codes)}

Твоя задача - сгенерировать текст продажи.
Структура ответа (JSON):
{
  "vision": "Точка Б. Красиво опиши будущее клиента, объединив его желания с плюсовыми проявлениями его кодов. (3-4 предложения)",
  "solution": "Решение через САЛ. Объясни, что именно знание кодов (назови их) поможет перейти из А в Б. Покажи, что САЛ - это инструкция.",
  "sales_phrases": ["Короткая фраза 1", "Короткая фраза 2"]
}

Ответ на русском языке.`;
            userPrompt = "Сгенерируй продающее решение.";
        }

        // Call OpenAI
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(completion.choices[0].message.content || "{}");

        return NextResponse.json({ data: result });

    } catch (error: any) {
        logger.error("Script generation error:", error);
        return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 });
    }
}
