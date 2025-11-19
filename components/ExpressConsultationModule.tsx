"use client";

import { useState } from "react";
import ExpressConsultationFlow from "./ExpressConsultationFlow";

interface ExpressConsultationModuleProps {
  clientId: number;
  profileId?: number | null;
}

export default function ExpressConsultationModule({
  clientId,
  profileId,
}: ExpressConsultationModuleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [consultationId, setConsultationId] = useState<number | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(profileId ?? null);
  const [error, setError] = useState<string | null>(null);

  async function initConsultation() {
    setInitializing(true);
    setError(null);
    try {
      const res = await fetch("/api/consultations/express/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, profileId: activeProfileId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || "Не удалось инициализировать консультацию");
      }

      const id = json?.data?.id;
      if (!id) {
        throw new Error("Сервер не вернул идентификатор консультации");
      }

      setConsultationId(id);
      if (json?.profileId) {
        setActiveProfileId(Number(json.profileId));
      }
    } catch (err: any) {
      setError(err?.message || "Ошибка инициализации экспресс диагностики");
      setIsOpen(false);
      console.error("Error init consultation:", err);
    } finally {
      setInitializing(false);
    }
  }

  async function handleToggle() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setError(null);
    setIsOpen(true);
    if (!consultationId) {
      await initConsultation();
    }
  }

  return (
    <div className="card overflow-hidden transition-all duration-300 border-2 border-transparent hover:border-brand-100">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-3 text-left focus:outline-none"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isOpen ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-600"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Экспресс-разбор</h2>
            <p className="text-sm text-gray-500">Быстрая диагностика и продажа через САЛ</p>
          </div>
        </div>
        <div className={`transform transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {error && (
        <div className="px-4 pb-4">
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        </div>
      )}

      {isOpen && (
        <div className="mt-6 pt-6 border-t border-gray-100 animate-fadeIn">
          {initializing ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            </div>
          ) : consultationId ? (
            <ExpressConsultationFlow
              consultationId={consultationId}
              clientId={clientId}
              profileId={activeProfileId || undefined}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
