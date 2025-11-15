import { getDirectusUrl } from "@/lib/env";
import fs from "fs";
import path from "path";

/**
 * Отправляет email с подтверждением регистрации
 * Использует Directus для отправки email
 */
export async function sendRegistrationEmail({
  email,
  firstName,
  lastName,
}: {
  email: string;
  firstName?: string;
  lastName?: string;
}) {
  const directusUrl = getDirectusUrl();
  if (!directusUrl) {
    throw new Error("DIRECTUS_URL is not set");
  }

  const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
  if (!adminToken) {
    throw new Error("DIRECTUS_ADMIN_TOKEN is not set");
  }

  // Читаем HTML шаблон
  const templatePath = path.join(process.cwd(), "app/emails/registration-confirmation.html");
  let htmlTemplate = "";
  
  try {
    htmlTemplate = fs.readFileSync(templatePath, "utf-8");
  } catch (error) {
    console.error("Error reading email template:", error);
    throw new Error("Error loading email template");
  }

  // Получаем базовый URL приложения
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://sal.sposobniymaster.online";

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
  // Directus использует endpoint /utils/send-mail или можно использовать встроенную функцию
  // Проверяем, есть ли у Directus встроенная отправка email
  const emailRes = await fetch(`${directusUrl}/utils/send-mail`, {
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
    // Если /utils/send-mail не работает, пробуем альтернативный способ
    // Многие установки Directus используют SMTP напрямую через настройки
    // В этом случае можно использовать внешний сервис отправки email
    console.warn("Directus email sending failed, email will not be sent");
    throw new Error("Email sending failed");
  }

  return { success: true };
}

