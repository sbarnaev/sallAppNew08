"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [communicationMethod, setCommunicationMethod] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/clients/${id}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const c = data?.data || null;
        if (!c) throw new Error("Клиент не найден или нет доступа");
        const [first = "", last = ""] = (c.name || " ").split(" ", 2);
        setFirstName(first);
        setLastName(last);
        if (c.birth_date) setBirthDate(String(c.birth_date).slice(0, 10));
        if (c.phone) setPhone(c.phone);
        if (c.email) setEmail(c.email);
        if (c.source) setSource(c.source);
        if (c.communication_method) setCommunicationMethod(c.communication_method);
        if (c.notes) setNotes(c.notes);
      } catch (e: any) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const name = `${firstName.trim()} ${lastName.trim()}`.trim();
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          birth_date: birthDate || null,
          phone: phone || null,
          email: email || null,
          source: source || null,
          communication_method: communicationMethod || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Не удалось сохранить изменения");
      }
      router.push(`/clients/${id}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="card">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Редактировать клиента</h1>
        <button onClick={() => router.back()} className="text-sm text-gray-600 hover:text-gray-900">← Назад</button>
      </div>

      <form onSubmit={onSubmit} className="card max-w-2xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Имя</label>
            <input className="w-full rounded-xl border p-3" value={firstName} onChange={(e)=>setFirstName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm mb-1">Фамилия</label>
            <input className="w-full rounded-xl border p-3" value={lastName} onChange={(e)=>setLastName(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Дата рождения</label>
          <input className="w-full rounded-xl border p-3" type="date" value={birthDate} onChange={(e)=>setBirthDate(e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Телефон</label>
            <input className="w-full rounded-xl border p-3" value={phone} onChange={(e)=>setPhone(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input className="w-full rounded-xl border p-3" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Откуда пришел</label>
            <select className="w-full rounded-xl border p-3 bg-white" value={source} onChange={(e)=>setSource(e.target.value)}>
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
          <div>
            <label className="block text-sm mb-1">Способ общения</label>
            <select className="w-full rounded-xl border p-3 bg-white" value={communicationMethod} onChange={(e)=>setCommunicationMethod(e.target.value)}>
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
        <div>
          <label className="block text-sm mb-1">Заметки</label>
          <textarea className="w-full rounded-xl border p-3 h-28" value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Дополнительная информация" />
        </div>

        {error && <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>}

        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={() => router.back()} className="btn btn-secondary w-full sm:w-auto">Отмена</button>
          <button type="submit" disabled={saving} className="btn btn-primary w-full sm:w-auto">{saving ? "Сохраняю..." : "Сохранить"}</button>
        </div>
      </form>
    </div>
  );
}


