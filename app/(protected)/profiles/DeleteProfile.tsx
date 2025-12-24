"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteProfile({ id }: { id: string | number }) {
  const router = useRouter();
  const [confirmStage, setConfirmStage] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!confirm || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Не удалось удалить расчёт");
      }
      // Перенаправляем на список профилей
      router.replace(`/profiles?fresh=${Date.now()}`);
      setTimeout(() => router.refresh(), 0);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2 bg-white rounded-lg shadow-md border border-gray-200 p-2 min-w-[200px]">
      {!confirmStage ? (
        <button
          type="button"
          onClick={() => { setConfirmStage(true); setConfirm(false); setError(null); }}
          className="rounded-lg border border-red-300 text-red-700 px-3 py-1.5 hover:bg-red-50 transition-colors flex items-center gap-1.5 text-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Удалить
        </button>
      ) : (
        <>
          <label className="flex items-center gap-2 text-xs text-gray-700 w-full">
            <input
              type="checkbox"
              className="rounded border-gray-300 w-3.5 h-3.5"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            Подтвердить удаление
          </label>
          <div className="flex items-center gap-1.5 w-full">
            <button
              type="button"
              onClick={onDelete}
              disabled={!confirm || loading}
              className="flex-1 rounded-lg border border-red-300 text-red-700 px-2 py-1 hover:bg-red-50 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5 text-xs"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  Удаляю...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Удалить
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setConfirmStage(false); setConfirm(false); setError(null); }}
              className="rounded-lg border px-2 py-1 text-gray-700 hover:bg-gray-50 transition-colors text-xs"
            >
              Отмена
            </button>
          </div>
        </>
      )}
      {error && <span className="text-xs text-red-600 w-full text-center">{error}</span>}
    </div>
  );
}

