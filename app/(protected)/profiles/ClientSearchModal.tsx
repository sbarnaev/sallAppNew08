"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export function ClientSearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    
    const fetchClients = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) {
          params.set("search", search.trim());
        }
        params.set("limit", "20");
        
        const res = await fetch(`/api/clients?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        setClients(data?.data || []);
      } catch (error) {
        console.error("Error fetching clients:", error);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchClients();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [search, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <div className="font-semibold text-lg">Выберите клиента для расчёта</div>
          <button className="text-gray-500 hover:text-gray-800 text-2xl" onClick={onClose}>×</button>
        </div>
        <div className="p-6 border-b">
          <input
            type="text"
            className="w-full rounded-xl border p-3 text-base"
            placeholder="Поиск по имени, фамилии или дате рождения..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="p-6 overflow-y-auto flex-grow">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Загрузка...</div>
          ) : clients.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {search ? "Клиенты не найдены" : "Начните вводить имя клиента"}
            </div>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => {
                    router.push(`/profiles/new?clientId=${client.id}`);
                    onClose();
                  }}
                  className="w-full text-left p-4 rounded-xl border hover:bg-gray-50 hover:border-blue-300 transition-colors"
                >
                  <div className="font-medium text-gray-900">{client.name || `Клиент #${client.id}`}</div>
                  {client.birth_date && (
                    <div className="text-sm text-gray-500 mt-1">
                      Дата рождения: {new Date(client.birth_date).toLocaleDateString("ru-RU")}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

