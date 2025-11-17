import { NextRequest, NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, email, password, firstName, lastName } = body;

    if (!code || !email || !password) {
      return NextResponse.json({ message: "Не все обязательные поля заполнены" }, { status: 400 });
    }

    // Валидация email с помощью регулярного выражения
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ message: "Некорректный email" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ message: "Пароль должен содержать минимум 6 символов" }, { status: 400 });
    }

    const directusUrl = getDirectusUrl();
    if (!directusUrl) {
      return NextResponse.json({ message: "Ошибка конфигурации сервера" }, { status: 500 });
    }

    const adminToken = process.env.DIRECTUS_ADMIN_TOKEN;
    if (!adminToken) {
      return NextResponse.json({ message: "Ошибка конфигурации сервера" }, { status: 500 });
    }

    // Проверяем код
    const checkRes = await fetch(`${directusUrl}/items/registration_codes?filter[code][_eq]=${encodeURIComponent(code.trim())}&fields=id,code,used,used_by,expires_at,max_uses,use_count,role`, {
      headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
      cache: "no-store",
    });

    if (!checkRes.ok) {
      return NextResponse.json({ message: "Ошибка проверки кода" }, { status: 500 });
    }

    const checkData = await checkRes.json();
    const codes = checkData?.data || [];
    
    if (codes.length === 0) {
      return NextResponse.json({ message: "Код не найден" }, { status: 400 });
    }

    const codeData = codes[0];
    
    // Проверяем срок действия
    if (codeData.expires_at) {
      const expiresAt = new Date(codeData.expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json({ message: "Код истек" }, { status: 400 });
      }
    }

    // Проверяем, использован ли код (для одноразовых кодов)
    if (codeData.used && (codeData.max_uses === null || codeData.max_uses === 1)) {
      return NextResponse.json({ message: "Код уже использован" }, { status: 400 });
    }

    // Проверяем количество использований (для многоразовых кодов)
    if (codeData.max_uses !== null && codeData.use_count >= codeData.max_uses) {
      return NextResponse.json({ message: "Код уже использован максимальное количество раз" }, { status: 400 });
    }

    // Проверяем, не зарегистрирован ли уже пользователь с таким email
    const userCheckRes = await fetch(`${directusUrl}/users?filter[email][_eq]=${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
      cache: "no-store",
    });

    if (userCheckRes.ok) {
      const userCheckData = await userCheckRes.json();
      if (userCheckData?.data && userCheckData.data.length > 0) {
        return NextResponse.json({ message: "Пользователь с таким email уже зарегистрирован" }, { status: 400 });
      }
    }

    // Создаем пользователя
    const role = codeData.role || "client";
    
    // Получаем ID роли по имени
    const rolesRes = await fetch(`${directusUrl}/roles?filter[name][_eq]=${role}`, {
      headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
      cache: "no-store",
    });

    let roleId = null;
    if (rolesRes.ok) {
      const rolesData = await rolesRes.json();
      if (rolesData?.data && rolesData.data.length > 0) {
        roleId = rolesData.data[0].id;
      }
    }

    const userPayload: any = {
      email,
      password,
      status: "active",
    };

    if (firstName) userPayload.first_name = firstName;
    if (lastName) userPayload.last_name = lastName;
    if (roleId) userPayload.role = roleId;

    const createUserRes = await fetch(`${directusUrl}/users`, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${adminToken}`, 
        "Content-Type": "application/json",
        Accept: "application/json" 
      },
      body: JSON.stringify(userPayload),
      cache: "no-store",
    });

    if (!createUserRes.ok) {
      const errorData = await createUserRes.json().catch(() => ({}));
      logger.error("Error creating user:", errorData);
      return NextResponse.json({ 
        message: errorData?.errors?.[0]?.message || "Ошибка создания пользователя" 
      }, { status: createUserRes.status });
    }

    const userData = await createUserRes.json();
    const userId = userData?.data?.id;

    if (!userId) {
      return NextResponse.json({ message: "Ошибка создания пользователя" }, { status: 500 });
    }

    // Обновляем код регистрации
    const updateCodePayload: any = {
      use_count: (codeData.use_count || 0) + 1,
    };

    // Если код одноразовый (max_uses = 1 или не указан), помечаем как использованный
    if (codeData.max_uses === null || codeData.max_uses === 1) {
      updateCodePayload.used = true;
      updateCodePayload.used_by = userId;
      updateCodePayload.used_at = new Date().toISOString();
    } else {
      // Для многоразовых кодов обновляем used_by только если это первое использование
      if (codeData.use_count === 0) {
        updateCodePayload.used_by = userId;
        updateCodePayload.used_at = new Date().toISOString();
      }
    }

    await fetch(`${directusUrl}/items/registration_codes/${codeData.id}`, {
      method: "PATCH",
      headers: { 
        Authorization: `Bearer ${adminToken}`, 
        "Content-Type": "application/json",
        Accept: "application/json" 
      },
      body: JSON.stringify(updateCodePayload),
      cache: "no-store",
    });

    // Автоматически логиним пользователя
    const loginRes = await fetch(`${directusUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    if (!loginRes.ok) {
      // Пользователь создан, но автологин не удался - это не критично
      logger.warn("User created but auto-login failed");
      return NextResponse.json({ 
        message: "Регистрация успешна, но автоматический вход не удался. Пожалуйста, войдите вручную.",
        userId 
      }, { status: 201 });
    }

    const loginData = await loginRes.json();
    const accessToken = loginData?.data?.access_token;
    const refreshToken = loginData?.data?.refresh_token;

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ 
        message: "Регистрация успешна, но автоматический вход не удался. Пожалуйста, войдите вручную.",
        userId 
      }, { status: 201 });
    }

    // Устанавливаем cookies
    const response = NextResponse.json({ 
      message: "Регистрация успешна",
      user: userData?.data 
    }, { status: 200 });

    response.cookies.set("directus_access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 дней
      path: "/",
    });

    response.cookies.set("directus_refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 дней
      path: "/",
    });

    return response;
  } catch (error: any) {
    logger.error("Registration error:", error);
    return NextResponse.json({ 
      message: error?.message || "Ошибка регистрации" 
    }, { status: 500 });
  }
}

