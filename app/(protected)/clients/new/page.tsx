"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewClientPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [communicationMethod, setCommunicationMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !birthDate.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Преобразуем маску ДД.ММ.ГГГГ в ISO YYYY-MM-DD
      let isoBirth: string | null = null;
      const m = birthDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (m) {
        const [, dd, mm, yyyy] = m;
        isoBirth = `${yyyy}-${mm}-${dd}`;
      }
      
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          birth_date: isoBirth,
          phone: phone.trim() || null,
          email: email.trim() || null,
          source: source.trim() || null,
          communication_method: communicationMethod.trim() || null,
          notes: notes || null,
        }),
      });
      
      if (res.ok) {
        router.push("/clients");
      } else {
        const data = await res.json().catch(() => ({}));
        console.log("Form error:", { status: res.status, data });
        
        // Если токен истек или нет авторизации, перенаправляем на логин
        if (res.status === 401) {
          setError("Сессия истекла. Перенаправление на страницу входа...");
          setTimeout(() => {
            router.push("/login");
          }, 2000);
          return;
        }
        
        setError(data?.message || "Ошибка создания клиента");
      }
    } catch (err) {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Новый клиент</h1>
        <button 
          onClick={() => router.back()}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Назад
        </button>
      </div>

      <form onSubmit={onSubmit} className="card max-w-2xl space-y-6">
        {/* Основная информация */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Основная информация</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Имя *</label>
              <input
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Иван"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Фамилия *</label>
              <input
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Иванов"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Дата рождения *</label>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
              <input
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                type="text"
                inputMode="numeric"
                placeholder="дд.мм.гггг"
                value={birthDate}
                onChange={(e) => {
                  // Маска: DD.MM.YYYY (ввод подряд цифр)
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                  const parts = [digits.slice(0,2), digits.slice(2,4), digits.slice(4,8)].filter(Boolean);
                  const masked = parts.join(".");
                  setBirthDate(masked);
                }}
                required
              />
              <input
                className="rounded-xl border border-gray-300 p-3 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
                type="date"
                value={(birthDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/) ? `${birthDate.slice(6,10)}-${birthDate.slice(3,5)}-${birthDate.slice(0,2)}` : "")}
                onChange={(e) => {
                  const iso = e.target.value; // YYYY-MM-DD
                  if (iso) {
                    const [yyyy, mm, dd] = iso.split("-");
                    setBirthDate(`${dd}.${mm}.${yyyy}`);
                  } else {
                    setBirthDate("");
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Контактная информация */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Контактная информация</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Номер телефона</label>
              <input
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ivan@example.com"
              />
            </div>
          </div>
        </div>

        {/* Дополнительная информация */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Дополнительная информация</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Откуда пришел</label>
              <select
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white appearance-none [background-image:linear-gradient(45deg,transparent 50%,#9CA3AF 50%),linear-gradient(135deg,#9CA3AF 50%,transparent 50%),linear-gradient(to_right,#d1d5db,#d1d5db)]; [background-position:calc(100%-20px) calc(1em+2px),calc(100%-15px) calc(1em+2px),calc(100%-2.5rem) 0.5em]; [background-size:5px_5px,5px_5px,1px_1.5em]; [background-repeat:no-repeat]"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Выберите источник</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="vk">VK</option>
                <option value="telegram">Telegram</option>
                <option value="website">Сайт</option>
                <option value="recommendation">Рекомендация</option>
                <option value="advertising">Реклама</option>
                <option value="other">Другое</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Способ общения</label>
              <select
                className="w-full rounded-xl border border-gray-300 p-3 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white appearance-none [background-image:linear-gradient(45deg,transparent 50%,#9CA3AF 50%),linear-gradient(135deg,#9CA3AF 50%,transparent 50%),linear-gradient(to_right,#d1d5db,#d1d5db)]; [background-position:calc(100%-20px) calc(1em+2px),calc(100%-15px) calc(1em+2px),calc(100%-2.5rem) 0.5em]; [background-size:5px_5px,5px_5px,1px_1.5em]; [background-repeat:no-repeat]"
                value={communicationMethod}
                onChange={(e) => setCommunicationMethod(e.target.value)}
              >
                <option value="">Выберите способ</option>
                <option value="phone">Телефон</option>
                <option value="email">Email</option>
                <option value="telegram">Telegram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="vk">VK</option>
                <option value="in_person">Лично</option>
                <option value="other">Другое</option>
              </select>
            </div>
          </div>
        </div>

        {/* Заметки */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Заметки</label>
          <textarea
            className="w-full rounded-xl border border-gray-300 p-3 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 h-28"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Любая дополнительная информация по клиенту"
          />
        </div>


        
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        
        <div className="flex gap-3 pt-4">
          <button 
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-2xl border border-gray-300 text-gray-700 py-3 font-medium hover:bg-gray-50 transition"
          >
            Отмена
          </button>
          <button 
            type="submit"
            disabled={loading || !firstName.trim() || !lastName.trim() || !birthDate.trim()}
            className="flex-1 rounded-2xl bg-brand-600 text-white py-3 font-medium hover:bg-brand-700 transition disabled:opacity-50"
          >
            {loading ? "Создание..." : "Создать клиента"}
          </button>
        </div>
      </form>
    </div>
  );
}
