import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDirectusUrl } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Сохраняет шаг экспресс-консультации
 * Пока используем consultation_details для хранения шагов
 * В будущем можно создать отдельную коллекцию consultation_steps
 */
export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  
  if (!token || !baseUrl) {
    return NextResponse.json({ message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });
  }

  const { id } = ctx.params;

  // Валидация ID
  if (!id || isNaN(Number(id)) || Number(id) <= 0) {
    return NextResponse.json({ message: "Invalid consultation ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { step_type, step_order, question, response, response_type, selected_options } = body;

    if (!step_type || !step_order) {
      return NextResponse.json(
        { message: "step_type and step_order are required" },
        { status: 400 }
      );
    }

    // Сохраняем шаг в consultation_details
    // Используем section для типа шага и order, content для данных
    const stepData = {
      consultation_id: Number(id),
      section: `${step_type}_${step_order}`, // например: "point_a_1"
      content: JSON.stringify({
        question,
        response,
        response_type,
        selected_options,
        step_type,
        step_order,
        created_at: new Date().toISOString(),
      }),
    };

    const url = `${baseUrl}/items/consultation_details`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(stepData),
      cache: "no-store",
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      logger.error("Error saving consultation step:", data);
      return NextResponse.json(
        { message: data?.errors?.[0]?.message || "Failed to save step" },
        { status: r.status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    logger.error("Save consultation step error:", error);
    return NextResponse.json(
      { message: "Server error" },
      { status: 500 }
    );
  }
}

