"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteClient({ id }: { id: string }) {
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
      const res = await fetch(`/api/clients/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      }, { cache: 'no-store' } as any);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Не удалось удалить клиента");
      }
      router.replace(`/clients?fresh=${Date.now()}`);
      setTimeout(()=>router.refresh(), 0);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {!confirmStage ? (
        <button
          type="button"
          onClick={() => { setConfirmStage(true); setConfirm(false); setError(null); }}
          className="rounded-xl border border-red-300 text-red-700 px-4 py-2 hover:bg-red-50"
        >
          Удалить
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            Подтвердить удаление
          </label>
          <button
            type="button"
            onClick={onDelete}
            disabled={!confirm || loading}
            className="rounded-xl border border-red-300 text-red-700 px-4 py-2 hover:bg-red-50 disabled:opacity-60"
          >
            {loading ? "Удаляю..." : "Удалить окончательно"}
          </button>
          <button
            type="button"
            onClick={() => { setConfirmStage(false); setConfirm(false); setError(null); }}
            className="rounded-xl border px-3 py-2 text-gray-700 hover:bg-gray-50"
          >
            Отмена
          </button>
        </div>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}


