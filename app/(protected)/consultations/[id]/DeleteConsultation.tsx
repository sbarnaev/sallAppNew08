"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
}

export default function DeleteConsultation({ id }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleDelete() {
    if (!confirm("Вы уверены, что хотите удалить эту консультацию? Это действие нельзя отменить.")) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/consultations/${id}`, {
        method: "DELETE",
      });

      // Если подписка истекла, api-interceptor обработает редирект
      if (res.status === 403) {
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Ошибка удаления консультации");
      }

      router.push("/consultations");
      router.refresh();
    } catch (error: any) {
      alert(error.message || "Ошибка удаления консультации");
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="px-4 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      {loading ? "Удаление..." : "Удалить"}
    </button>
  );
}
