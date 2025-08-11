export default async function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Панель</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card">Быстрый доступ</div>
        <div className="card">Недавние профили</div>
        <div className="card">Статистика (позже)</div>
      </div>
    </div>
  );
}
