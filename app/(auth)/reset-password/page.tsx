"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Отсутствует токен сброса пароля");
      return;
    }

    if (password.length < 6) {
      setError("Пароль должен содержать минимум 6 символов");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      } else {
        setError(data.message || "Ошибка сброса пароля");
      }
    } catch (err: any) {
      setError("Ошибка сети. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
        <div className="w-full max-w-md">
          <div className="card shadow-xl border-0 space-y-6 p-8">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Пароль успешно изменен!</h1>
              <p className="text-gray-600">
                Ваш пароль был успешно обновлен. Вы будете перенаправлены на страницу входа...
              </p>
              <div className="pt-4">
                <Link
                  href="/login"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Перейти к входу →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
        <div className="w-full max-w-md">
          <div className="card shadow-xl border-0 space-y-6 p-8">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Неверная ссылка</h1>
              <p className="text-gray-600">
                Ссылка для сброса пароля недействительна или истекла.
              </p>
              <div className="pt-4 space-y-2">
                <Link
                  href="/forgot-password"
                  className="block text-blue-600 hover:text-blue-800 font-medium"
                >
                  Запросить новую ссылку
                </Link>
                <Link
                  href="/login"
                  className="block text-gray-600 hover:text-gray-800"
                >
                  ← Вернуться к входу
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="w-full max-w-md">
        <div className="card shadow-xl border-0 space-y-6 p-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Новый пароль</h1>
            <p className="text-gray-600">Введите новый пароль для вашего аккаунта</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Новый пароль</label>
              <input
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Подтвердите пароль</label>
              <input
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите пароль"
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 font-semibold hover:from-blue-700 hover:to-purple-700 transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Сброс пароля..." : "Изменить пароль"}
            </button>

            <div className="text-center text-sm text-gray-600">
              <Link href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
                ← Вернуться к входу
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

