import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MobileMenu } from "@/components/MobileMenu";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get("directus_access_token")?.value;
  if (!token) redirect("/login");

  return (
    <div className="min-h-screen flex">
      {/* Мобильное меню */}
      <MobileMenu />
      
      {/* Десктопное меню (скрыто на мобильных) */}
      <aside className="hidden md:flex bg-white border-r p-4 transition-all duration-300 w-[60px] hover:w-[240px] group relative flex-col h-screen">
        <div className="font-semibold mb-6 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">SAL App</div>
        <nav className="space-y-2 text-sm flex-1 flex flex-col">
          <div className="flex flex-col space-y-2">
            <Link className="flex items-center px-3 py-2 rounded-xl hover:bg-gray-100 whitespace-nowrap" href="/dashboard">
              <span className="inline-block w-6 text-center shrink-0">📊</span>
              <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">Панель</span>
            </Link>
            <Link className="flex items-center px-3 py-2 rounded-xl hover:bg-gray-100 whitespace-nowrap" href="/clients">
              <span className="inline-block w-6 text-center shrink-0">👥</span>
              <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">Клиенты</span>
            </Link>
            <Link className="flex items-center px-3 py-2 rounded-xl hover:bg-gray-100 whitespace-nowrap" href="/profiles">
              <span className="inline-block w-6 text-center shrink-0">📈</span>
              <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">Расчёты</span>
            </Link>
          </div>
          <form action="/api/logout" method="post" className="mt-auto">
            <button type="submit" className="flex items-center px-3 py-2 rounded-xl hover:bg-gray-100 whitespace-nowrap w-full text-sm text-gray-600 hover:text-gray-900">
              <span className="inline-block w-6 text-center shrink-0">🚪</span>
              <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">Выйти</span>
            </button>
          </form>
        </nav>
      </aside>
      
      {/* Основной контент */}
      <main className="flex-1 p-4 md:p-6 pt-16 md:pt-6">{children}</main>
    </div>
  );
}
