import Link from "next/link";
import { MobileMenu } from "@/components/MobileMenu";
import { SubscriptionStatus } from "@/components/SubscriptionStatus";
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
        <aside className="hidden md:flex bg-white/80 backdrop-blur-xl border-r border-gray-200/60 p-3 transition-all duration-300 w-[56px] hover:w-[220px] group relative flex-col h-screen shadow-[0_1px_0_rgba(15,23,42,0.02),0_4px_20px_rgba(15,23,42,0.05)]">
        <div className="font-bold mb-5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-base bg-gradient-to-r from-brand-600 to-brand-700 bg-clip-text text-transparent">САЛ ПРОФИ</div>
        <nav className="space-y-1.5 text-sm flex-1 flex flex-col">
          <div className="flex flex-col space-y-1.5">
              <Link className="nav-item hover:bg-gradient-to-r hover:from-brand-50 hover:to-transparent" href="/dashboard">
              <span className="inline-block w-5 text-center shrink-0 text-lg">📊</span>
                <span className="nav-item-label text-sm">Панель</span>
            </Link>
              <Link className="nav-item hover:bg-gradient-to-r hover:from-green-50 hover:to-transparent" href="/clients">
              <span className="inline-block w-5 text-center shrink-0 text-lg">👥</span>
                <span className="nav-item-label text-sm">Клиенты</span>
            </Link>
              <Link className="nav-item hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent" href="/profiles">
              <span className="inline-block w-5 text-center shrink-0 text-lg">📈</span>
                <span className="nav-item-label text-sm">Расчёты</span>
              </Link>
              <Link className="nav-item hover:bg-gradient-to-r hover:from-purple-50 hover:to-transparent" href="/tests">
                <span className="inline-block w-5 text-center shrink-0 text-lg">🧪</span>
                <span className="nav-item-label text-sm">Тесты</span>
            </Link>
          </div>
          <form action="/api/logout" method="post" className="mt-auto">
              <button type="submit" className="nav-item w-full text-xs text-gray-600 hover:text-red-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-transparent">
              <span className="inline-block w-5 text-center shrink-0 text-lg">🚪</span>
                <span className="nav-item-label font-medium text-sm">Выйти</span>
            </button>
          </form>
        </nav>
      </aside>
      
      {/* Основной контент */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-3 sm:px-5 md:px-8 lg:px-10 pt-20 md:pt-8 pb-8 md:pb-12">
          <SubscriptionStatus />
        {children}
      </main>
    </div>
    </ClientLayoutWrapper>
  );
}
