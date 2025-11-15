import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Запрос на сброс пароля
 * Использует встроенный функционал Directus для генерации токена сброса
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ message: "Некорректный email" }, { status: 400 });
    }

    const directusUrl = getDirectusUrl();
    if (!directusUrl) {
      return NextResponse.json({ message: "Ошибка конфигурации сервера" }, { status: 500 });
    }

    // Используем встроенный endpoint Directus для запроса сброса пароля
    // Directus автоматически отправит письмо с токеном, если настроен SMTP
    const resetRes = await fetch(`${directusUrl}/auth/password/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
      cache: "no-store",
    });

    // Directus возвращает 204 No Content при успехе, даже если пользователь не найден
    // (для безопасности не раскрываем, существует ли пользователь)
    if (resetRes.ok || resetRes.status === 204) {
      // Отправляем вебхук о запросе сброса пароля
      const webhookUrl = "https://serv.sposobniymaster.online/webhook/3fae1200e8-436744-47tgrt35-aab5-a9f43f38ea23";
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            timestamp: new Date().toISOString(),
            type: "password_reset_request",
          }),
        }).catch(() => {
          // Игнорируем ошибки вебхука, чтобы не блокировать основной процесс
        });
      } catch {
        // Игнорируем ошибки вебхука
      }

      return NextResponse.json({
        message: "Если пользователь с таким email существует, инструкции отправлены на почту",
      });
    }

    const errorData = await resetRes.json().catch(() => ({}));
    return NextResponse.json(
      { message: errorData?.errors?.[0]?.message || "Ошибка запроса сброса пароля" },
      { status: resetRes.status }
    );
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { message: "Ошибка сервера" },
      { status: 500 }
    );
  }
}

