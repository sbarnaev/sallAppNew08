import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Сброс пароля по токену
 * Использует встроенный функционал Directus
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = body;

    if (!token) {
      return NextResponse.json({ message: "Токен не указан" }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { message: "Пароль должен содержать минимум 6 символов" },
        { status: 400 }
      );
    }

    const directusUrl = getDirectusUrl();
    if (!directusUrl) {
      return NextResponse.json({ message: "Ошибка конфигурации сервера" }, { status: 500 });
    }

    // Используем встроенный endpoint Directus для сброса пароля
    const resetRes = await fetch(`${directusUrl}/auth/password/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        password,
      }),
      cache: "no-store",
    });

    if (resetRes.ok || resetRes.status === 204) {
      return NextResponse.json({
        message: "Пароль успешно изменен",
      });
    }

    const errorData = await resetRes.json().catch(() => ({}));
    return NextResponse.json(
      {
        message:
          errorData?.errors?.[0]?.message ||
          "Токен недействителен или истек. Запросите новую ссылку для сброса пароля.",
      },
      { status: resetRes.status }
    );
  } catch (error: any) {
    console.error("Reset password error:", error);
    return NextResponse.json({ message: "Ошибка сервера" }, { status: 500 });
  }
}

