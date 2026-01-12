"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ClientSearchModal } from "@/app/(protected)/profiles/ClientSearchModal";

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);

  const handleOpenMenu = useCallback(() => setIsOpen(true), []);
  const handleCloseMenu = useCallback(() => setIsOpen(false), []);
  const handleOpenClientSearch = useCallback(() => {
    setIsClientSearchOpen(true);
    setIsOpen(false);
  }, []);
  const handleCloseClientSearch = useCallback(() => setIsClientSearchOpen(false), []);

  return (
    <>
      {/* Мобильный top-bar (всегда виден на мобиле) - Glassmorphism */}
      <header className="md:hidden fixed top-0 inset-x-0 z-[60]">
        <div className="pt-[env(safe-area-inset-top)] bg-white/50 backdrop-blur-[25px] border-b border-white/60">
          <div className="h-14 px-3 flex items-center gap-2.5">
            <button
              onClick={() => setIsOpen(true)}
              className="w-9 h-9 rounded-xl bg-white/50 backdrop-blur-[15px] border border-white/60 shadow-[0_1px_4px_0_rgba(0,0,0,0.03)] hover:bg-white/65 transition-all flex items-center justify-center"
              aria-label="Открыть меню"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link href="/dashboard" className="min-w-0 flex-1" onClick={() => setIsOpen(false)}>
              <div className="truncate text-sm font-semibold text-gray-900">
                САЛ ПРОФИ
              </div>
              <div className="truncate text-[10px] text-gray-600">Панель • клиенты • расчёты</div>
            </Link>

            <div className="flex items-center gap-1.5">
              <Link
                href="/clients/new"
                className="w-9 h-9 rounded-xl bg-white/50 backdrop-blur-[15px] border border-white/60 shadow-[0_1px_4px_0_rgba(0,0,0,0.03)] hover:bg-white/65 transition-all flex items-center justify-center"
                aria-label="Новый клиент"
              >
                <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </Link>
              <button
                onClick={() => {
                  setIsClientSearchOpen(true);
                  setIsOpen(false); // Закрываем меню при открытии модалки
                }}
                className="w-9 h-9 rounded-xl bg-white/50 backdrop-blur-[15px] border border-white/60 shadow-[0_1px_4px_0_rgba(0,0,0,0.03)] hover:bg-white/65 transition-all flex items-center justify-center"
                aria-label="Новый расчёт"
              >
                <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Overlay (только на мобильных) - Glassmorphism */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Мобильное меню - Glassmorphism */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-[75vw] max-w-[300px] bg-white/60 backdrop-blur-[30px] border-r border-white/60 shadow-[0_4px_16px_0_rgba(0,0,0,0.08)] z-50 transform transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex flex-col h-full p-4 pt-[calc(16px+env(safe-area-inset-top))]">
          {/* Заголовок с кнопкой закрытия */}
          <div className="flex items-center justify-between mb-6">
            <div className="font-semibold text-sm text-gray-900">
              САЛ ПРОФИ
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/50 transition-colors"
              aria-label="Закрыть меню"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Навигация */}
          <nav className="flex-1 space-y-1">
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl hover:bg-white/50 transition-colors"
            >
              <svg className="w-5 h-5 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="ml-3 font-medium text-sm text-gray-800">Панель</span>
            </Link>
            <Link
              href="/clients"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl hover:bg-white/50 transition-colors"
            >
              <svg className="w-5 h-5 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="ml-3 font-medium text-sm text-gray-800">Клиенты</span>
            </Link>
            <Link
              href="/profiles"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl hover:bg-white/50 transition-colors"
            >
              <svg className="w-5 h-5 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="ml-3 font-medium text-sm text-gray-800">Расчёты</span>
            </Link>
            <Link
              href="/consultations"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl hover:bg-white/50 transition-colors"
            >
              <svg className="w-5 h-5 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="ml-3 font-medium text-sm text-gray-800">Консультации</span>
            </Link>
            <Link
              href="/tests"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl hover:bg-white/50 transition-colors"
            >
              <svg className="w-5 h-5 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="ml-3 font-medium text-sm text-gray-800">Тесты</span>
            </Link>
          </nav>

          {/* Кнопка выхода */}
          <form action="/api/logout" method="post" className="mt-auto">
            <button
              type="submit"
              className="flex items-center w-full px-3 py-2.5 rounded-xl hover:bg-white/50 text-gray-600 hover:text-red-700 transition-colors"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="ml-3 font-medium text-sm">Выйти</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Модальное окно выбора клиента для нового расчета */}
      <ClientSearchModal isOpen={isClientSearchOpen} onClose={() => setIsClientSearchOpen(false)} />
    </>
  );
}

