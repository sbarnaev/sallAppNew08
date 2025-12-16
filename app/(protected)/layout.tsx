import Link from "next/link";
import { MobileMenu } from "@/components/MobileMenu";
import { requireAuthAndSubscription } from "@/lib/guards";
import ClientLayoutWrapper from "./ClientLayout";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // Проверяем доступ на сервере
  await requireAuthAndSubscription();

  return (
    <ClientLayoutWrapper>
    <div className="min-h-screen flex">
      {/* Мобильное меню */}
      <MobileMenu />
      
      {/* Десктопное меню (скрыто на мобильных) */}
        <aside className="hidden md:flex bg-white border-r border-gray-200 transition-all duration-200 w-[64px] hover:w-[240px] group relative flex-col h-screen shadow-sm">
        <div className="px-4 pt-5 pb-4">
          <div className="font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-base text-gray-900">САЛ ПРОФИ</div>
        </div>
        <nav className="flex-1 flex flex-col px-2">
          <div className="flex flex-col space-y-0.5">
              <Link className="nav-item" href="/dashboard">
              <span className="inline-block w-6 text-center shrink-0 text-lg">📊</span>
                <span className="nav-item-label text-sm">Панель</span>
            </Link>
              <Link className="nav-item" href="/clients">
              <span className="inline-block w-6 text-center shrink-0 text-lg">👥</span>
                <span className="nav-item-label text-sm">Клиенты</span>
            </Link>
              <Link className="nav-item" href="/profiles">
              <span className="inline-block w-6 text-center shrink-0 text-lg">📈</span>
                <span className="nav-item-label text-sm">Расчёты</span>
              </Link>
              <Link className="nav-item" href="/consultations">
                <span className="inline-block w-6 text-center shrink-0 text-lg">💬</span>
                <span className="nav-item-label text-sm">Консультации</span>
            </Link>
              <Link className="nav-item" href="/tests">
                <span className="inline-block w-6 text-center shrink-0 text-lg">🧪</span>
                <span className="nav-item-label text-sm">Тесты</span>
            </Link>
          </div>
          <form action="/api/logout" method="post" className="mt-auto mb-4">
              <button type="submit" className="nav-item w-full text-gray-600 hover:text-red-700 hover:bg-red-50">
              <span className="inline-block w-6 text-center shrink-0 text-lg">🚪</span>
                <span className="nav-item-label font-medium text-sm">Выйти</span>
            </button>
          </form>
        </nav>
      </aside>
      
      {/* Основной контент */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-20 md:pt-8 pb-8 md:pb-12">
        {children}
      </main>
    </div>
    </ClientLayoutWrapper>
  );
}
