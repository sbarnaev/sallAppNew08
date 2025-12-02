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
    
    console.log("[CLIENT LOGIN] ===== Login attempt =====", {
      hasEmail: !!email,
      emailLength: email.length,
      hasPassword: !!password,
      passwordLength: password.length,
      emailPrefix: email.substring(0, 3) + "***"
    });
    
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      console.log("[CLIENT LOGIN] Response received:", {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        headers: Object.fromEntries(res.headers.entries())
      });
      
      if (res.ok) {
        console.log("[CLIENT LOGIN] Login successful, redirecting to dashboard");
        router.push("/dashboard");
      } else {
        const data = await res.json().catch((err) => {
          console.error("[CLIENT LOGIN] Failed to parse error response:", err);
          return { message: "Login failed" };
        });
        console.error("[CLIENT LOGIN] Login failed:", {
          status: res.status,
          data: data
        });
        setError(data?.message || "Ошибка входа");
      }
    } catch (err: any) {
      console.error("[CLIENT LOGIN] Network error:", {
        message: err?.message || String(err),
        name: err?.name,
        stack: err?.stack?.substring(0, 500)
      });
      setError("Ошибка подключения к серверу");
    }
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
            <h1 className="text-3xl font-bold text-gray-900">САЛ ПРОФИ</h1>
            <p className="text-gray-600">Войдите в систему</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                type="email"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Пароль</label>
              <input
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                type="password"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
            <button 
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 font-semibold hover:from-blue-700 hover:to-purple-700 transition shadow-lg hover:shadow-xl"
            >
              Войти
            </button>
          </form>

            <div className="text-center text-sm text-gray-600 pt-4 border-t border-gray-200 space-y-2">
              <div>
                Нет аккаунта?{" "}
                <Link href="/register" className="text-blue-600 hover:text-blue-800 font-medium">
                  Зарегистрироваться
                </Link>
              </div>
              <div>
                <Link href="/forgot-password" className="text-blue-600 hover:text-blue-800 font-medium">
                  Забыли пароль?
                </Link>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
