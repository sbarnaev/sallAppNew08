import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b bg-white">
      <div className="container flex items-center justify-between h-14">
        <Link href="/dashboard" className="font-medium">SAL App</Link>
        <form action="/api/logout" method="post">
          <button className="text-sm text-gray-600 hover:text-gray-900">Выйти</button>
        </form>
      </div>
    </header>
  );
}
