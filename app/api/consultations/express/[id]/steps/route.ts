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
    let body: any = {};
    try {
      body = await req.json();
    } catch (error) {
      return NextResponse.json({ message: "Ошибка обработки данных запроса" }, { status: 400 });
    }
    const { step_type, step_order, question, response, response_type, selected_options } = body;

    if (!step_type || !step_order) {
      return NextResponse.json(
        { message: "step_type and step_order are required" },
        { status: 400 }
      );
    }

    // Проверяем, существует ли уже шаг с таким типом и порядком
    // Если да, обновляем его, если нет - создаем новый
    const existingStepRes = await fetch(
      `${baseUrl}/items/consultation_details?filter[consultation_id][_eq]=${id}&filter[section][_eq]=${step_type}_${step_order}&limit=1`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      }
    );

    const existingStepData = await existingStepRes.json().catch(() => ({ data: [] }));
    const existingStep = existingStepData?.data?.[0];

    const stepContent = {
      question: question || "",
      response: response || "",
      response_type: response_type || "text",
      selected_options: selected_options || [],
      step_type,
      step_order,
      created_at: existingStep ? JSON.parse(existingStep.content || "{}").created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existingStep) {
      // Обновляем существующий шаг
      const updateRes = await fetch(`${baseUrl}/items/consultation_details/${existingStep.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          content: JSON.stringify(stepContent),
        }),
        cache: "no-store",
      });

      result = await updateRes.json().catch(() => ({}));
      if (!updateRes.ok) {
        throw new Error(result?.errors?.[0]?.message || "Failed to update step");
      }
    } else {
      // Создаем новый шаг
      const stepData = {
        consultation_id: Number(id),
        section: `${step_type}_${step_order}`, // например: "point_a_1"
        content: JSON.stringify(stepContent),
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

      result = await r.json().catch(() => ({}));

      if (!r.ok) {
        logger.error("Error saving consultation step:", result);
        return NextResponse.json(
          { message: result?.errors?.[0]?.message || "Failed to save step" },
          { status: r.status }
        );
      }
    }

    return NextResponse.json({
      data: result?.data || result,
    }, { status: 200 });
  } catch (error: any) {
    logger.error("Save consultation step error:", error);
    return NextResponse.json(
      { message: "Server error" },
      { status: 500 }
    );
  }
}

