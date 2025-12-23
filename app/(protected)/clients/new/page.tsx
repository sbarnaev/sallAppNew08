"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function NewClientPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [communicationMethod, setCommunicationMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !birthDate.trim() || !gender) return;

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
          gender: gender || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          source: source.trim() || null,
          communication_method: communicationMethod.trim() || null,
          notes: notes || null,
        }),
      });

      const responseData = await res.json().catch(() => ({}));

      if (res.ok) {
        // Получаем ID созданного клиента
        const clientId = responseData?.data?.id || responseData?.id;
        
        if (clientId) {
          // Сразу переходим на карточку созданного клиента
          router.push(`/clients/${clientId}`);
        } else {
          // Если ID не получен, переходим на список (fallback)
          console.warn("Client created but no ID returned:", responseData);
          router.push("/clients");
        }
      } else {
        const data = responseData;
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
    <div className="space-y-8 md:space-y-10 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="page-title text-3xl sm:text-4xl md:text-4xl">Новый клиент</h1>
          <p className="page-subtitle">Заполните ключевые данные и контакты</p>
        </div>
        <button onClick={() => router.back()} className="btn btn-ghost btn-sm">
          ← Назад
        </button>
      </div>

      <form onSubmit={onSubmit} className="surface max-w-2xl space-y-6">
        {/* Основная информация */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Основная информация</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label>Имя *</label>
              <input
                className="w-full"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Иван"
                required
              />
            </div>

            <div className="space-y-2">
              <label>Фамилия *</label>
              <input
                className="w-full"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Иванов"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label>Дата рождения *</label>
              <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <input
                  className="w-full"
                  type="text"
                  inputMode="numeric"
                  placeholder="дд.мм.гггг"
                  value={birthDate}
                  onChange={(e) => {
                    // Маска: DD.MM.YYYY (ввод подряд цифр)
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
                    const masked = parts.join(".");
                    setBirthDate(masked);
                  }}
                  required
                />
                <input
                  className="bg-white"
                  type="date"
                  value={(birthDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/) ? `${birthDate.slice(6, 10)}-${birthDate.slice(3, 5)}-${birthDate.slice(0, 2)}` : "")}
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Пол *</label>
              <select
                className="w-full"
                value={gender}
                onChange={(e) => setGender(e.target.value as "male" | "female" | "")}
                required
              >
                <option value="">Выберите пол</option>
                <option value="male">Мужской</option>
                <option value="female">Женский</option>
              </select>
            </div>
          </div>
        </div>

        {/* Контактная информация */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Контактная информация</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label>Номер телефона</label>
              <input
                className="w-full"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (999) 123-45-67"
              />
            </div>

            <div className="space-y-2">
              <label>Email</label>
              <input
                className="w-full"
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
          <h2 className="text-lg font-bold text-gray-900">Дополнительная информация</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Откуда пришел</label>
              <select
                className="w-full"
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
              <label className="text-sm font-medium text-gray-700">Способ общения</label>
              <select
                className="w-full"
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
          <label>Заметки</label>
          <textarea
            className="w-full h-28"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Любая дополнительная информация по клиенту"
          />
        </div>



        {error && (
          <div className="p-4 bg-red-50 border border-red-200/70 rounded-2xl">
            <p className="text-red-700 text-sm font-semibold">{error}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-secondary w-full sm:w-auto"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={loading || !firstName.trim() || !lastName.trim() || !birthDate.trim() || !gender}
            className="btn btn-success w-full sm:w-auto"
          >
            {loading ? "Создание..." : "Создать клиента"}
          </button>
        </div>
      </form>
    </div>
  );
}
