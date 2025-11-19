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
        const body = await req.json();
        const { topic, customRequest, stage = "diagnostics", confirmedIssues = [] } = body;
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
            // STAGE 1: Generate Hypotheses
            systemPrompt = `Ты - эксперт по системе самопознания САЛ.
Твоя задача - на основе профиля клиента и его запроса сформулировать 5-7 гипотез о его проблемах ("болях").
Эти гипотезы консультант будет проверять в диалоге.

Клиент: ${client.name} (${client.birth_date})
Запрос: "${requestText}"

Данные из учебника (Book Information):
${JSON.stringify(bookInfo, null, 2)}

Коды клиента:
${JSON.stringify(codes)}

Сформулируй гипотезы как утверждения или вопросы, на которые клиент может ответить "Да".
Примеры: "Вам часто кажется, что вас используют?", "Деньги приходят и сразу уходят?", "Вам сложно просить о помощи?".
Гипотезы должны быть основаны на "минусовых" проявлениях его кодов.

Верни ответ строго в формате JSON:
{
  "hypotheses": ["Гипотеза 1", "Гипотеза 2", ...]
}`;
            userPrompt = "Сгенерируй гипотезы.";
        } else {
            // STAGE 2: Generate Solution
            systemPrompt = `Ты - эксперт по системе самопознания САЛ.
Твоя задача - составить сценарий продажи консультации, опираясь на ПОДТВЕРЖДЕННЫЕ проблемы клиента.

Клиент: ${client.name} (${client.birth_date})
Запрос: "${requestText}"

Подтвержденные проблемы (то, что клиент признал):
${JSON.stringify(confirmedIssues)}

Данные из учебника (Book Information):
${JSON.stringify(bookInfo, null, 2)}

Коды клиента:
${JSON.stringify(codes)}

Твоя задача - сгенерировать 2 блока текста (Точка Б и Решение).
Текст должен быть готовыми фразами для консультанта.

Структура ответа (JSON):
{
  "vision": "Точка Б. Опиши вдохновляющее будущее, где эти конкретные проблемы решены. Используй 'плюсовые' проявления кодов. (3-4 предложения)",
  "solution": "Решение через САЛ. Объясни, как именно знание кодов поможет прийти в Точку Б. Используй названия кодов (Личность, Коннектор и т.д.). (3-4 предложения)",
  "sales_phrases": ["Короткая продающая фраза 1", "Короткая продающая фраза 2"]
}

Ответ на русском языке.`;
            userPrompt = "Сгенерируй решение.";
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
