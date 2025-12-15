"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    
    // Логи только в development режиме
    if (process.env.NODE_ENV === 'development') {
      console.log("[CLIENT LOGIN] Login attempt");
    }
    
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      if (res.ok) {
        if (process.env.NODE_ENV === 'development') {
          console.log("[CLIENT LOGIN] Login successful");
        }
        router.push("/dashboard");
      } else {
        const data = await res.json().catch(() => ({ message: "Login failed" }));
        // В продакшене показываем только общее сообщение об ошибке
        setError(data?.message || "Ошибка входа");
      }
    } catch (err: any) {
      // В продакшене не логируем детали ошибок
      setError("Ошибка подключения к серверу");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md animate-fade-in">
        <div className="surface-muted shadow-2xl border-0 space-y-7">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-18 h-18 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl mb-5 sm:mb-6 shadow-lg shadow-blue-500/20">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">САЛ ПРОФИ</h1>
            <p className="text-gray-600 text-base sm:text-lg font-medium">Войдите в систему</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">Email</label>
              <input
                className="w-full"
                type="email"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">Пароль</label>
              <input
                className="w-full"
                type="password"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <div className="p-4 bg-red-50 border border-red-200/60 rounded-2xl">
                <p className="text-red-600 text-sm font-semibold">{error}</p>
              </div>
            )}
            <button 
              type="submit"
              className="btn btn-primary btn-lg w-full"
            >
              Войти
            </button>
          </form>

            <div className="text-center text-sm text-gray-600 pt-6 border-t border-gray-200/80 space-y-3">
              <div>
                Нет аккаунта?{" "}
                <Link href="/register" className="text-blue-600 hover:text-blue-800 font-bold transition-colors">
                  Зарегистрироваться
                </Link>
              </div>
              <div>
                <Link href="/forgot-password" className="text-blue-600 hover:text-blue-800 font-bold transition-colors">
                  Забыли пароль?
                </Link>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
