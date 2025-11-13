import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get("directus_access_token")?.value;
  if (!token) redirect("/login");

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="bg-white border-r p-4">
        <div className="font-semibold mb-6">SAL App</div>
        <nav className="space-y-2 text-sm">
          <Link className="block px-3 py-2 rounded-xl hover:bg-gray-100" href="/dashboard">📊 Панель</Link>
          <Link className="block px-3 py-2 rounded-xl hover:bg-gray-100" href="/clients">👥 Клиенты</Link>
          <Link className="block px-3 py-2 rounded-xl hover:bg-gray-100" href="/profiles">📈 Расчёты</Link>
          <Link className="block px-3 py-2 rounded-xl hover:bg-gray-100" href="/consultations">📅 Консультации</Link>
        </nav>
        <form action="/api/logout" method="post" className="mt-8">
          <button className="text-sm text-gray-600 hover:text-gray-900">Выйти</button>
        </form>
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}
