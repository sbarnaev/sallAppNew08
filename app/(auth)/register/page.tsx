"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code") || "";

  const [code, setCode] = useState(codeParam);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);

  // Проверяем код при изменении
  useEffect(() => {
    if (code.trim().length >= 4) {
      const timeoutId = setTimeout(() => {
        checkCode();
      }, 500); // Debounce для избежания лишних запросов
      
      return () => clearTimeout(timeoutId);
    } else {
      setCodeValid(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function checkCode() {
    if (!code.trim() || code.trim().length < 4) {
      setCodeValid(null);
      setError(null);
      return;
    }

    setCheckingCode(true);
    setError(null);
    try {
      const res = await fetch(`/api/register/check-code?code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      
      if (data.valid) {
        setCodeValid(true);
        setError(null);
      } else {
        setCodeValid(false);
        setError(data.message || "Код недействителен");
      }
    } catch (err) {
      setCodeValid(false);
      setError("Ошибка проверки кода. Попробуйте позже.");
    } finally {
      setCheckingCode(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError("Введите код регистрации");
      return;
    }

    if (!codeValid) {
      setError("Код регистрации недействителен");
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError("Заполните все обязательные поля");
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
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          email: email.trim(),
          password,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Регистрация успешна, перенаправляем на dashboard
        router.push("/dashboard");
      } else {
        setError(data.message || "Ошибка регистрации");
      }
    } catch (err: any) {
      setError(err.message || "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="w-full max-w-md">
        <div className="card shadow-xl border-0 space-y-6 p-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Регистрация</h1>
            <p className="text-gray-600">Создайте аккаунт с кодом регистрации</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            {/* Код регистрации */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Код регистрации <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  className={`w-full rounded-xl border p-3 pr-10 focus:ring-2 transition ${
                    codeValid === true
                      ? "border-green-500 focus:border-green-500 focus:ring-green-200"
                      : codeValid === false
                      ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                      : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                  }`}
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Введите код регистрации"
                  required
                  disabled={loading}
                />
                {checkingCode && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                  </div>
                )}
                {codeValid === true && !checkingCode && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {codeValid === false && !checkingCode && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
              </div>
              {codeValid === false && (
                <p className="text-xs text-red-600 mt-1">Код недействителен или истек</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={loading || !codeValid}
              />
            </div>

            {/* Пароль */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Пароль <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                required
                disabled={loading || !codeValid}
                minLength={6}
              />
            </div>

            {/* Подтверждение пароля */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Подтвердите пароль <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите пароль"
                required
                disabled={loading || !codeValid}
                minLength={6}
              />
            </div>

            {/* Имя (опционально) */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Имя</label>
              <input
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Иван"
                disabled={loading || !codeValid}
              />
            </div>

            {/* Фамилия (опционально) */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Фамилия</label>
              <input
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Иванов"
                disabled={loading || !codeValid}
              />
            </div>

            {/* Согласие */}
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  disabled={loading || !codeValid}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  Я согласен с{" "}
                  <Link href="/terms" className="text-blue-600 hover:text-blue-800 underline" target="_blank">
                    пользовательским соглашением
                  </Link>{" "}
                  и{" "}
                  <Link href="/privacy" className="text-blue-600 hover:text-blue-800 underline" target="_blank">
                    политикой обработки персональных данных
                  </Link>
                  <span className="text-red-500">*</span>
                </span>
              </label>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !codeValid}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 font-semibold hover:from-blue-700 hover:to-purple-700 transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Регистрация..." : "Зарегистрироваться"}
            </button>

            <div className="text-center text-sm text-gray-600">
              Уже есть аккаунт?{" "}
              <Link href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
                Войти
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

