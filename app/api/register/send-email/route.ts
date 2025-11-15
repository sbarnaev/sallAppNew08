import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * Отправляет email с подтверждением регистрации
 * Использует Directus для отправки email
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, firstName, lastName } = body;

    if (!email) {
      return NextResponse.json({ message: "Email не указан" }, { status: 400 });
    }

    const directusUrl = getDirectusUrl();
    if (!directusUrl) {
      return NextResponse.json({ message: "Ошибка конфигурации сервера" }, { status: 500 });
    }

    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
    if (!adminToken) {
      return NextResponse.json({ message: "Ошибка конфигурации сервера" }, { status: 500 });
    }

    // Читаем HTML шаблон
    const templatePath = path.join(process.cwd(), "app/emails/registration-confirmation.html");
    let htmlTemplate = "";
    
    try {
      htmlTemplate = fs.readFileSync(templatePath, "utf-8");
    } catch (error) {
      console.error("Error reading email template:", error);
      return NextResponse.json({ message: "Ошибка загрузки шаблона письма" }, { status: 500 });
    }

    // Получаем базовый URL приложения
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : "https://sal.sposobniymaster.online";

    // Заменяем плейсхолдеры в шаблоне
    const html = htmlTemplate
      .replace(/{{firstName}}/g, firstName || "Пользователь")
      .replace(/{{lastName}}/g, lastName || "")
      .replace(/{{loginUrl}}/g, `${appUrl}/login`)
      .replace(/{{dashboardUrl}}/g, `${appUrl}/dashboard`)
      .replace(/{{clientsUrl}}/g, `${appUrl}/clients`)
      .replace(/{{profilesUrl}}/g, `${appUrl}/profiles`)
      .replace(/{{helpUrl}}/g, `${appUrl}/help`);

    // Отправляем email через Directus
    const emailRes = await fetch(`${directusUrl}/mail/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: email,
        subject: "Добро пожаловать в САЛ ПРОФИ!",
        html: html,
      }),
      cache: "no-store",
    });

    if (!emailRes.ok) {
      const errorData = await emailRes.json().catch(() => ({}));
      console.error("Error sending email:", errorData);
      // Не возвращаем ошибку, так как отправка email не критична для регистрации
      return NextResponse.json({ 
        message: "Регистрация успешна, но письмо не отправлено",
        emailSent: false 
      }, { status: 200 });
    }

    return NextResponse.json({ 
      message: "Email отправлен",
      emailSent: true 
    }, { status: 200 });
  } catch (error: any) {
    console.error("Email sending error:", error);
    // Не возвращаем ошибку, так как отправка email не критична
    return NextResponse.json({ 
      message: "Регистрация успешна, но письмо не отправлено",
      emailSent: false 
    }, { status: 200 });
  }
}

