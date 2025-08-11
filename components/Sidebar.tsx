import Link from "next/link";

export function Sidebar() {
  return (
    <aside className="bg-white border-r p-4">
      <div className="font-semibold mb-6">SAL App</div>
      <nav className="space-y-2 text-sm">
        <Link className="block px-3 py-2 rounded-xl hover:bg-gray-100" href="/dashboard">Панель</Link>
        <Link className="block px-3 py-2 rounded-xl hover:bg-gray-100" href="/profiles">Профили</Link>
      </nav>
    </aside>
  );
}
