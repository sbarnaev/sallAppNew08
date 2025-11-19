import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDirectusUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

// Initialize OpenAI client
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

        // Fetch profile data (including interpretations if available)
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

        // 2. Construct Prompt for OpenAI
        const systemPrompt = `Ты - эксперт по системе самопознания САЛ (Системный Анализ Личности). 
Твоя задача - помочь консультанту провести экспресс-диагностику (продающую консультацию) для клиента.
Ты должен сгенерировать скрипт общения, вопросы и фразы, которые идеально подойдут именно этому человеку, исходя из его кодов.

Структура консультации:
1. Установление контакта (Opener)
2. Точка А (Текущая ситуация - боль)
3. Точка Б (Желаемое будущее - мечта)
4. Ресурсы (Что есть и что мы можем дать)
5. Закрытие (Продажа полной консультации)

Коды клиента:
${JSON.stringify(profileData.digits || profileData.raw_json?.codes || "Неизвестно")}

Трактовки (если есть):
${JSON.stringify(profileData.raw_json?.interpretations || "Нет данных")}

Твоя цель: дать консультанту конкретные фразы, которые "попадут" в клиента. 
- Если Коннектор мягкий (2,4,6,8) - фразы должны быть теплыми, поддерживающими.
- Если Коннектор жесткий (1,3,5,7,9) - фразы должны быть четкими, структурными, вызывающими на честность.
- Используй информацию о Личности и Реализации, чтобы подсветить сильные стороны и конфликты.

Верни ответ строго в формате JSON:
{
  "opener": "Текст для начала разговора...",
  "contact_phrases": ["фраза 1", "фраза 2"],
  "point_a": {
    "questions": ["Вопрос 1", "Вопрос 2"],
    "phrases": ["Фраза поддержки 1", "Фраза-провокация"],
    "context": "Почему мы спрашиваем именно это (для консультанта)"
  },
  "point_b": {
    "questions": ["Вопрос о мечте 1", "Вопрос о мечте 2"],
    "phrases": ["Фраза вдохновения"],
    "context": "На что давить в точке Б"
  },
  "resources": {
    "analysis": "Текст анализа ресурсов клиента",
    "phrases": ["Фраза о ресурсах"]
  },
  "closing": {
    "phrases": ["Продающая фраза 1", "Продающая фраза 2"],
    "offer_text": "Текст оффера (почему ему нужна полная консультация)"
  }
}`;

        // 3. Call OpenAI
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Сгенерируй скрипт для клиента ${client.name} (${client.birth_date}).` },
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
