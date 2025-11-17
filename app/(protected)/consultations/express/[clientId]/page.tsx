"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import ExpressConsultationFlow from "@/components/ExpressConsultationFlow";

export default function ExpressConsultationPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consultationId, setConsultationId] = useState<number | null>(null);

  useEffect(() => {
    async function startConsultation() {
      if (!clientId) {
        setError("Не указан ID клиента");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/consultations/express/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: Number(clientId) }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.message || "Не удалось создать консультацию");
        }

        setConsultationId(data?.data?.id || null);
      } catch (err: any) {
        setError(err.message || "Ошибка создания консультации");
      } finally {
        setLoading(false);
      }
    }

    startConsultation();
  }, [clientId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Создание консультации...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-600">{error}</p>
          <Link href="/consultations" className="text-blue-600 hover:underline">
            Вернуться к консультациям
          </Link>
        </div>
      </div>
    );
  }

  if (!consultationId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Не удалось создать консультацию</p>
          <Link href="/consultations" className="text-blue-600 hover:underline mt-4 inline-block">
            Вернуться к консультациям
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Экспресс-консультация</h1>
        <Link
          href="/consultations"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Назад к консультациям
        </Link>
      </div>

      <ExpressConsultationFlow consultationId={consultationId} clientId={Number(clientId)} />
    </div>
  );
}

