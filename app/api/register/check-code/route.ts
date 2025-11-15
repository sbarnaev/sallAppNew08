import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return NextResponse.json({ valid: false, message: "Код не указан" }, { status: 400 });
  }

  const directusUrl = getDirectusUrl();
  if (!directusUrl) {
    return NextResponse.json({ valid: false, message: "Ошибка конфигурации сервера" }, { status: 500 });
  }

  // Получаем админский токен для проверки кода
  const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
  if (!adminToken) {
    // Пытаемся использовать токен текущего пользователя (если есть)
    const userToken = cookies().get("directus_access_token")?.value;
    if (!userToken) {
      return NextResponse.json({ valid: false, message: "Ошибка авторизации" }, { status: 401 });
    }
    
    try {
      const res = await fetch(`${directusUrl}/items/registration_codes?filter[code][_eq]=${encodeURIComponent(code.trim())}&fields=id,code,used,used_by,expires_at,max_uses,use_count,role`, {
        headers: { Authorization: `Bearer ${userToken}`, Accept: "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        return NextResponse.json({ valid: false, message: "Ошибка проверки кода" }, { status: res.status });
      }

      const data = await res.json();
      const codes = data?.data || [];
      
      if (codes.length === 0) {
        return NextResponse.json({ valid: false, message: "Код не найден" }, { status: 200 });
      }

      const codeData = codes[0];
      
      // Проверяем срок действия
      if (codeData.expires_at) {
        const expiresAt = new Date(codeData.expires_at);
        if (expiresAt < new Date()) {
          return NextResponse.json({ valid: false, message: "Код истек" }, { status: 200 });
        }
      }

      // Проверяем, использован ли код (для одноразовых кодов)
      if (codeData.used && (codeData.max_uses === null || codeData.max_uses === 1)) {
        return NextResponse.json({ valid: false, message: "Код уже использован" }, { status: 200 });
      }

      // Проверяем количество использований (для многоразовых кодов)
      if (codeData.max_uses !== null && codeData.use_count >= codeData.max_uses) {
        return NextResponse.json({ valid: false, message: "Код уже использован максимальное количество раз" }, { status: 200 });
      }

      return NextResponse.json({ 
        valid: true, 
        codeId: codeData.id,
        role: codeData.role || "client"
      }, { status: 200 });
    } catch (error) {
      console.error("Error checking code:", error);
      return NextResponse.json({ valid: false, message: "Ошибка сервера" }, { status: 500 });
    }
  }

  // Используем админский токен
  try {
    const res = await fetch(`${directusUrl}/items/registration_codes?filter[code][_eq]=${encodeURIComponent(code.trim())}&fields=id,code,used,used_by,expires_at,max_uses,use_count,role`, {
      headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ valid: false, message: "Ошибка проверки кода" }, { status: res.status });
    }

    const data = await res.json();
    const codes = data?.data || [];
    
    if (codes.length === 0) {
      return NextResponse.json({ valid: false, message: "Код не найден" }, { status: 200 });
    }

    const codeData = codes[0];
    
    // Проверяем срок действия
    if (codeData.expires_at) {
      const expiresAt = new Date(codeData.expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json({ valid: false, message: "Код истек" }, { status: 200 });
      }
    }

    // Проверяем, использован ли код (для одноразовых кодов)
    if (codeData.used && (codeData.max_uses === null || codeData.max_uses === 1)) {
      return NextResponse.json({ valid: false, message: "Код уже использован" }, { status: 200 });
    }

    // Проверяем количество использований (для многоразовых кодов)
    if (codeData.max_uses !== null && codeData.use_count >= codeData.max_uses) {
      return NextResponse.json({ valid: false, message: "Код уже использован максимальное количество раз" }, { status: 200 });
    }

    return NextResponse.json({ 
      valid: true, 
      codeId: codeData.id,
      role: codeData.role || "client"
    }, { status: 200 });
  } catch (error) {
    console.error("Error checking code:", error);
    return NextResponse.json({ valid: false, message: "Ошибка сервера" }, { status: 500 });
  }
}

