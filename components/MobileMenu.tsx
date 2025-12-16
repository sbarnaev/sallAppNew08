"use client";

import { useState } from "react";
import Link from "next/link";
import { ClientSearchModal } from "@/app/(protected)/profiles/ClientSearchModal";

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);

  return (
    <>
      {/* Мобильный top-bar (всегда виден на мобиле) */}
      <header className="md:hidden fixed top-0 inset-x-0 z-[60]">
        <div className="pt-[env(safe-area-inset-top)] bg-white/80 backdrop-blur-md border-b border-gray-200/60">
          <div className="h-14 px-3 flex items-center gap-2.5">
      <button
        onClick={() => setIsOpen(true)}
              className="w-9 h-9 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow transition-all flex items-center justify-center"
        aria-label="Открыть меню"
      >
              <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

            <Link href="/dashboard" className="min-w-0 flex-1" onClick={() => setIsOpen(false)}>
              <div className="truncate text-sm font-bold bg-gradient-to-r from-brand-700 via-gray-900 to-brand-700 bg-clip-text text-transparent">
                САЛ ПРОФИ
              </div>
              <div className="truncate text-[10px] text-gray-600">Панель • клиенты • расчёты</div>
            </Link>

            <div className="flex items-center gap-1.5">
              <Link
                href="/clients/new"
                className="w-9 h-9 rounded-lg bg-green-600 text-white shadow-sm hover:shadow transition-all flex items-center justify-center"
                aria-label="Новый клиент"
              >
                <span className="text-[16px] leading-none">👤</span>
              </Link>
              <button
                onClick={() => {
                  setIsClientSearchOpen(true);
                  setIsOpen(false); // Закрываем меню при открытии модалки
                }}
                className="w-9 h-9 rounded-lg bg-brand-600 text-white shadow-sm hover:shadow transition-all flex items-center justify-center"
                aria-label="Новый расчёт"
              >
                <span className="text-[16px] leading-none">🧾</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Overlay (только на мобильных) */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-[1px] z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Мобильное меню - Glassmorphism */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-[75vw] max-w-[300px] backdrop-blur-2xl border-r border-white/30 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.5)'}}
      >
        <div className="flex flex-col h-full p-3 pt-[calc(12px+env(safe-area-inset-top))]">
          {/* Заголовок с кнопкой закрытия */}
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold text-base bg-gradient-to-r from-brand-700 to-gray-900 bg-clip-text text-transparent">
              САЛ ПРОФИ
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/40 backdrop-blur-md border border-white/40 hover:bg-white/60 transition-all"
              aria-label="Закрыть меню"
            >
              <svg className="w-4.5 h-4.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Навигация */}
          <nav className="flex-1 space-y-1.5">
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl hover:bg-white/30 hover:backdrop-blur-md transition-all"
            >
              <span className="inline-block w-5 text-center shrink-0 text-lg">📊</span>
              <span className="ml-2.5 font-semibold text-sm text-gray-800">Панель</span>
            </Link>
            <Link
              href="/clients"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl hover:bg-white/30 hover:backdrop-blur-md transition-all"
            >
              <span className="inline-block w-5 text-center shrink-0 text-lg">👥</span>
              <span className="ml-2.5 font-semibold text-sm text-gray-800">Клиенты</span>
            </Link>
            <Link
              href="/profiles"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl hover:bg-white/30 hover:backdrop-blur-md transition-all"
            >
              <span className="inline-block w-5 text-center shrink-0 text-lg">📈</span>
              <span className="ml-2.5 font-semibold text-sm text-gray-800">Расчёты</span>
            </Link>
            <Link
              href="/consultations"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl hover:bg-white/30 hover:backdrop-blur-md transition-all"
            >
              <span className="inline-block w-5 text-center shrink-0 text-lg">💬</span>
              <span className="ml-2.5 font-semibold text-sm text-gray-800">Консультации</span>
            </Link>
            <Link
              href="/tests"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl hover:bg-white/30 hover:backdrop-blur-md transition-all"
            >
              <span className="inline-block w-5 text-center shrink-0 text-lg">🧪</span>
              <span className="ml-2.5 font-semibold text-sm text-gray-800">Тесты</span>
            </Link>
          </nav>

          {/* Кнопка выхода */}
          <form action="/api/logout" method="post" className="mt-auto">
            <button
              type="submit"
              className="flex items-center w-full px-3 py-2.5 rounded-xl hover:bg-white/30 hover:backdrop-blur-md text-gray-600 hover:text-red-700 transition-all"
            >
              <span className="inline-block w-5 text-center shrink-0 text-lg">🚪</span>
              <span className="ml-2.5 font-semibold text-sm">Выйти</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Модальное окно выбора клиента для нового расчета */}
      <ClientSearchModal isOpen={isClientSearchOpen} onClose={() => setIsClientSearchOpen(false)} />
    </>
  );
}

