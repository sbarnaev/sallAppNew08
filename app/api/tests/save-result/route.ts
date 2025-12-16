import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";
import { ClientTestData, TestResult } from "@/lib/test-types";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) {
    return NextResponse.json({ message: "Unauthorized or no DIRECTUS_URL" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { clientId, testId, result } = body;

    if (!testId || !result) {
      return NextResponse.json({ message: "testId and result are required" }, { status: 400 });
    }

    // Если есть clientId, сохраняем результат в клиента
    if (clientId) {
      // Получаем текущие данные клиента
      const clientRes = await fetch(`${baseUrl}/items/clients/${clientId}?fields=id,testirovanie`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store"
      });

      if (!clientRes.ok) {
        return NextResponse.json({ message: "Client not found" }, { status: 404 });
      }

      const clientData = await clientRes.json().catch(() => ({ data: {} }));
      let currentTestData: ClientTestData = {};
      
      // Обрабатываем testirovanie (может быть объектом или строкой JSON)
      const testirovanieRaw = clientData?.data?.testirovanie;
      if (testirovanieRaw) {
        if (typeof testirovanieRaw === "string") {
          try {
            currentTestData = JSON.parse(testirovanieRaw);
          } catch (e) {
            logger.warn("Failed to parse testirovanie JSON:", e);
            currentTestData = {};
          }
        } else if (typeof testirovanieRaw === "object") {
          currentTestData = testirovanieRaw;
        }
      }

      // Добавляем новый результат
      if (!currentTestData[testId]) {
        currentTestData[testId] = [];
      }
      currentTestData[testId].push(result as TestResult);

      // Обновляем клиента
      const updateRes = await fetch(`${baseUrl}/items/clients/${clientId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ testirovanie: currentTestData })
      });

      if (!updateRes.ok) {
        const error = await updateRes.json().catch(() => ({}));
        return NextResponse.json({ message: "Failed to save result", error }, { status: updateRes.status });
      }

      return NextResponse.json({ success: true, data: currentTestData });
    }

    // Если нет clientId, просто возвращаем результат (можно сохранить в localStorage на клиенте)
    return NextResponse.json({ success: true, result });
  } catch (error) {
    logger.error("Error saving test result:", error);
    return NextResponse.json(
      { message: "Error saving test result", error: String(error) },
      { status: 500 }
    );
  }
}

