"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Вход</h1>
        <div className="space-y-2">
          <label className="block text-sm">Email</label>
          <input
            className="w-full rounded-xl border p-3"
            type="email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm">Пароль</label>
          <input
            className="w-full rounded-xl border p-3"
            type="password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="w-full rounded-2xl bg-brand-600 text-white py-3 font-medium hover:bg-brand-700 transition">
          Войти
        </button>
        <p className="text-xs text-gray-500">
          Авторизация через Directus (email/password). Поменяйте настройки SMTP в Directus.
        </p>
      </form>
    </div>
  );
}
