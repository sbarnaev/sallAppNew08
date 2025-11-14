"use client";

import { useState } from "react";
import Link from "next/link";

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Кнопка открытия меню (только на мобильных) */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 w-12 h-12 bg-white border border-gray-300 rounded-xl shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
        aria-label="Открыть меню"
      >
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Overlay (только на мобильных) */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Мобильное меню */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-64 bg-white border-r shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full p-4">
          {/* Заголовок с кнопкой закрытия */}
          <div className="flex items-center justify-between mb-6">
            <div className="font-semibold text-lg">SAL App</div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Закрыть меню"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Навигация */}
          <nav className="flex-1 space-y-2">
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-3 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <span className="inline-block w-6 text-center shrink-0">📊</span>
              <span className="ml-3">Панель</span>
            </Link>
            <Link
              href="/clients"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-3 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <span className="inline-block w-6 text-center shrink-0">👥</span>
              <span className="ml-3">Клиенты</span>
            </Link>
            <Link
              href="/profiles"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-3 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <span className="inline-block w-6 text-center shrink-0">📈</span>
              <span className="ml-3">Расчёты</span>
            </Link>
          </nav>

          {/* Кнопка выхода */}
          <form action="/api/logout" method="post" className="mt-auto">
            <button
              type="submit"
              className="flex items-center w-full px-4 py-3 rounded-xl hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <span className="inline-block w-6 text-center shrink-0">🚪</span>
              <span className="ml-3">Выйти</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

