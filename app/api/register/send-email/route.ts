import { NextRequest, NextResponse } from "next/server";
import { sendRegistrationEmail } from "./send-email";

export const dynamic = "force-dynamic";

/**
 * API endpoint для отправки email подтверждения регистрации
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, firstName, lastName } = body;

    if (!email) {
      return NextResponse.json({ message: "Email не указан" }, { status: 400 });
    }

    await sendRegistrationEmail({ email, firstName, lastName });

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

