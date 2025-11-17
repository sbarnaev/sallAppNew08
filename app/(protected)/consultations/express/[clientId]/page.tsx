"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import ExpressConsultationFlow from "@/components/ExpressConsultationFlow";
import { logger } from "@/lib/logger";

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
          const errorMessage = data?.message || data?.details?.errors?.[0]?.message || "Не удалось создать консультацию";
          const errorDetails = data?.details ? `\n\nДетали: ${JSON.stringify(data.details, null, 2)}` : "";
          throw new Error(errorMessage + errorDetails);
        }

        const consultationId = data?.data?.id || null;
        
        if (!consultationId) {
          throw new Error("Консультация создана, но ID не получен");
        }
        
        setConsultationId(consultationId);
        
        // Профиль генерируется в фоне через n8n
        logger.log("Consultation created, profile generation in progress");
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
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <div>
            <p className="text-gray-700 font-medium">Создание консультации...</p>
            <p className="text-sm text-gray-500 mt-2">Генерация базового профиля через n8n</p>
          </div>
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
    <div className="space-y-6 max-w-4xl mx-auto px-4 pb-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Экспресс-консультация</h1>
        <Link
          href="/consultations"
          className="text-sm text-gray-600 hover:text-gray-900 whitespace-nowrap"
        >
          ← Назад к консультациям
        </Link>
      </div>

      <ExpressConsultationFlow consultationId={consultationId} clientId={Number(clientId)} />
    </div>
  );
}

