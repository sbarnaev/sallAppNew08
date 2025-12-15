import Link from "next/link";
import { MobileMenu } from "@/components/MobileMenu";
import { requireAuthAndSubscription } from "@/lib/guards";
import { SubscriptionStatus } from "@/components/SubscriptionStatus";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // Автоматически проверяет и обновляет токен при необходимости
  // И проверяет доступ по подписке
  await requireAuthAndSubscription();

  return (
    <div className="min-h-screen flex">
      {/* Мобильное меню */}
      <MobileMenu />
      
      {/* Десктопное меню (скрыто на мобильных) */}
      <aside className="hidden md:flex bg-white/70 backdrop-blur-xl border-r border-gray-200/70 p-4 transition-all duration-300 w-[60px] hover:w-[248px] group relative flex-col h-screen shadow-[0_1px_0_rgba(15,23,42,0.02),0_8px_30px_rgba(15,23,42,0.06)]">
        <div className="font-bold mb-6 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-lg bg-gradient-to-r from-brand-600 to-brand-700 bg-clip-text text-transparent">САЛ ПРОФИ</div>
        <nav className="space-y-2 text-sm flex-1 flex flex-col">
          <div className="flex flex-col space-y-2">
            <Link className="nav-item hover:bg-gradient-to-r hover:from-brand-50 hover:to-transparent" href="/dashboard">
              <span className="inline-block w-6 text-center shrink-0 text-xl">📊</span>
              <span className="nav-item-label">Панель</span>
            </Link>
            <Link className="nav-item hover:bg-gradient-to-r hover:from-green-50 hover:to-transparent" href="/clients">
              <span className="inline-block w-6 text-center shrink-0 text-xl">👥</span>
              <span className="nav-item-label">Клиенты</span>
            </Link>
            <Link className="nav-item hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent" href="/profiles">
              <span className="inline-block w-6 text-center shrink-0 text-xl">📈</span>
              <span className="nav-item-label">Расчёты</span>
            </Link>
            <Link className="nav-item hover:bg-gradient-to-r hover:from-purple-50 hover:to-transparent" href="/tests">
              <span className="inline-block w-6 text-center shrink-0 text-xl">🧪</span>
              <span className="nav-item-label">Тесты</span>
            </Link>
          </div>
          <form action="/api/logout" method="post" className="mt-auto">
            <button type="submit" className="nav-item w-full text-sm text-gray-600 hover:text-red-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-transparent">
              <span className="inline-block w-6 text-center shrink-0 text-xl">🚪</span>
              <span className="nav-item-label font-medium">Выйти</span>
            </button>
          </form>
        </nav>
      </aside>
      
      {/* Основной контент */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 pt-24 md:pt-8 pb-12">
        <SubscriptionStatus />
        {children}
      </main>
    </div>
  );
}
