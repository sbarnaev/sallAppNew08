import Link from "next/link";
import { MobileMenu } from "@/components/MobileMenu";
import { requireAuth } from "@/lib/guards";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // Автоматически проверяет и обновляет токен при необходимости
  await requireAuth();

  return (
    <div className="min-h-screen flex">
      {/* Мобильное меню */}
      <MobileMenu />
      
      {/* Десктопное меню (скрыто на мобильных) */}
      <aside className="hidden md:flex bg-gradient-to-b from-white to-gray-50 border-r border-gray-200 p-4 transition-all duration-300 w-[60px] hover:w-[240px] group relative flex-col h-screen shadow-sm">
        <div className="font-bold mb-6 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-lg bg-gradient-to-r from-brand-600 to-brand-700 bg-clip-text text-transparent">САЛ ПРОФИ</div>
        <nav className="space-y-2 text-sm flex-1 flex flex-col">
          <div className="flex flex-col space-y-2">
            <Link className="flex items-center px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-brand-50 hover:to-transparent whitespace-nowrap transition-all duration-200 group-hover:shadow-sm" href="/dashboard">
              <span className="inline-block w-6 text-center shrink-0 text-xl">📊</span>
              <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-medium text-gray-700">Панель</span>
            </Link>
            <Link className="flex items-center px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-green-50 hover:to-transparent whitespace-nowrap transition-all duration-200 group-hover:shadow-sm" href="/clients">
              <span className="inline-block w-6 text-center shrink-0 text-xl">👥</span>
              <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-medium text-gray-700">Клиенты</span>
            </Link>
            <Link className="flex items-center px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent whitespace-nowrap transition-all duration-200 group-hover:shadow-sm" href="/profiles">
              <span className="inline-block w-6 text-center shrink-0 text-xl">📈</span>
              <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-medium text-gray-700">Расчёты</span>
            </Link>
          </div>
          <form action="/api/logout" method="post" className="mt-auto">
            <button type="submit" className="flex items-center px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-transparent whitespace-nowrap w-full text-sm text-gray-600 hover:text-red-600 transition-all duration-200 group-hover:shadow-sm">
              <span className="inline-block w-6 text-center shrink-0 text-xl">🚪</span>
              <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-medium">Выйти</span>
            </button>
          </form>
        </nav>
      </aside>
      
      {/* Основной контент */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 pt-24 md:pt-8 pb-12">
        {children}
      </main>
    </div>
  );
}
