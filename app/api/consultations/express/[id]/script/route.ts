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
        const { topic, customRequest } = body;
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

        // 2. Construct Prompt for OpenAI
        const systemPrompt = `Ты - эксперт по системе самопознания САЛ (Системный Анализ Личности).
Твоя задача - составить сценарий экспресс-разбора для продажи полной консультации.

Клиент: ${client.name} (${client.birth_date})
Запрос клиента: "${requestText}"

Данные из учебника (Book Information) для этого клиента:
${JSON.stringify(bookInfo, null, 2)}

Коды клиента:
${JSON.stringify(codes)}

Твоя задача - сгенерировать 3 блока текста, которые консультант скажет клиенту.
Текст должен быть живым, разговорным, "бить в цель".

Структура ответа (JSON):
{
  "pain": "Актуализация боли. Надави на больное место, используя данные из учебника (минусовые проявления, искажения). Покажи, что ты видишь его проблему насквозь. Свяжи это с его запросом.",
  "vision": "Точка Б. Покажи, как может быть круто, если он выйдет в плюс. Опиши его идеальное состояние (ресурс, реализация) на основе данных учебника.",
  "solution": "Решение через САЛ. Объясни, что его проблема решается через знание конкретных кодов (упомяни их). Продай идею, что полная консультация даст ему инструкцию к самому себе."
}

Важно:
- Используй конкретные формулировки из book_information, но адаптируй их под разговорную речь.
- Не будь слишком абстрактным. Если у него Коннектор 8 - говори про структуру и холодность. Если 2 - про отношения и заботу.
- Ответ должен быть на русском языке.`;

        // 3. Call OpenAI
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Сгенерируй сценарий." },
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" },
        });

        const script = JSON.parse(completion.choices[0].message.content || "{}");

        return NextResponse.json({ data: script });

    } catch (error: any) {
        logger.error("Script generation error:", error);
        return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 });
    }
}
