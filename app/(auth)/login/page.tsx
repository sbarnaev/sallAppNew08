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
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      router.push("/dashboard");
    } else {
      const data = await res.json().catch(()=>({message:"Login failed"}));
      setError(data?.message || "Ошибка входа");
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

          <div className="text-center text-sm text-gray-600 pt-4 border-t border-gray-200">
            Нет аккаунта?{" "}
            <Link href="/register" className="text-blue-600 hover:text-blue-800 font-medium">
              Зарегистрироваться
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
