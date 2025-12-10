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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card shadow-2xl border-0 space-y-8 p-10 bg-gradient-to-br from-white via-gray-50/50 to-white">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl mb-6 shadow-lg shadow-blue-500/20">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 leading-tight">САЛ ПРОФИ</h1>
            <p className="text-gray-600 text-lg font-medium">Войдите в систему</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">Email</label>
              <input
                className="w-full rounded-2xl border border-gray-300/80 p-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200/50 transition-all duration-300 bg-white hover:border-gray-400 text-base"
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
                className="w-full rounded-2xl border border-gray-300/80 p-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200/50 transition-all duration-300 bg-white hover:border-gray-400 text-base"
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
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 font-bold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] text-base"
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
