import Link from "next/link";
import { MobileMenu } from "@/components/MobileMenu";
import { requireAuthAndSubscription } from "@/lib/guards";
import ClientLayoutWrapper from "./ClientLayout";
import { Snowflakes } from "@/components/Snowflakes";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // Проверяем доступ на сервере
  await requireAuthAndSubscription();

  return (
    <ClientLayoutWrapper>
    <div className="min-h-screen relative">
      {/* Новогодние снежинки */}
      <Snowflakes />
      {/* Мобильное меню */}
      <MobileMenu />
      
      {/* Десктопное меню (скрыто на мобильных) - Glassmorphism - Фиксированное */}
        <aside className="hidden md:flex fixed left-0 top-0 bottom-0 bg-white/50 backdrop-blur-[25px] border-r border-white/60 transition-all duration-300 w-[64px] hover:w-[240px] group flex-col h-screen shadow-[0_2px_8px_0_rgba(0,0,0,0.04)] z-50">
        <div className="px-4 pt-5 pb-4">
          <div className="font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm text-gray-900">САЛ ПРОФИ</div>
        </div>
        <nav className="flex-1 flex flex-col px-2 overflow-y-auto">
          <div className="flex flex-col space-y-1">
              <Link className="nav-item" href="/dashboard">
              <svg className="w-5 h-5 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
                <span className="nav-item-label text-sm">Панель</span>
            </Link>
              <Link className="nav-item" href="/clients">
              <svg className="w-5 h-5 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
                <span className="nav-item-label text-sm">Клиенты</span>
            </Link>
              <Link className="nav-item" href="/profiles">
              <svg className="w-5 h-5 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
                <span className="nav-item-label text-sm">Расчёты</span>
              </Link>
              <Link className="nav-item" href="/consultations">
                <svg className="w-5 h-5 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="nav-item-label text-sm">Консультации</span>
            </Link>
              <Link className="nav-item" href="/tests">
                <svg className="w-5 h-5 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="nav-item-label text-sm">Тесты</span>
            </Link>
          </div>
          <form action="/api/logout" method="post" className="mt-auto mb-4">
              <button type="submit" className="nav-item w-full text-gray-600 hover:text-red-700 hover:bg-white/40">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
                <span className="nav-item-label font-medium text-sm">Выйти</span>
            </button>
          </form>
        </nav>
      </aside>
      
      {/* Основной контент с отступом для фиксированного меню */}
      <main className="w-full md:ml-[64px] md:w-[calc(100%-64px)] flex justify-center pt-20 md:pt-8 pb-8 md:pb-12 relative z-10">
        <div className="w-full max-w-7xl px-4 sm:px-6 md:px-8">
          {children}
        </div>
      </main>
    </div>
    </ClientLayoutWrapper>
  );
}
