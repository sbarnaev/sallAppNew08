"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export function TestClientSelector({ currentClientId }: { currentClientId?: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

  useEffect(() => {
    if (currentClientId) {
      fetch(`/api/clients/${currentClientId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.data) {
            setSelectedClient(data.data);
          }
        })
        .catch(() => {});
    }
  }, [currentClientId]);

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

  function handleSelectClient(client: any) {
    setSelectedClient(client);
    setIsOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("clientId", String(client.id));
    router.push(url.toString());
  }

  function handleRemoveClient() {
    setSelectedClient(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("clientId");
    router.push(url.toString());
  }

  return (
    <>
      <div className="card p-4 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {selectedClient ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg">
                  {selectedClient.name?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900 truncate">{selectedClient.name || `Клиент #${selectedClient.id}`}</div>
                  <div className="text-xs text-gray-600">
                    Результаты будут сохранены
                  </div>
                </div>
                <button
                  onClick={handleRemoveClient}
                  className="text-gray-500 hover:text-gray-700 text-sm font-semibold px-3 py-1.5 rounded-xl hover:bg-white/80 transition-colors"
                >
                  Убрать
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-2xl flex items-center justify-center text-xl">
                  👤
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-700 mb-1">Тест без привязки к клиенту</div>
                  <div className="text-xs text-gray-600">
                    Результаты не будут сохранены в истории клиента
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(true)}
                  className="rounded-2xl bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2 text-sm font-semibold hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 transition-all duration-300"
                >
                  Выбрать клиента
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-[60] grid place-items-center p-4" onClick={() => setIsOpen(false)}>
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100/80 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold tracking-tight leading-tight">Выбрать клиента</h2>
              <button className="text-gray-500 hover:text-gray-800 text-2xl" onClick={() => setIsOpen(false)}>×</button>
            </div>
            <div className="p-6">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по имени, email, телефону..."
                className="w-full px-4 py-3 rounded-2xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 mb-4"
                autoFocus
              />
              {loading ? (
                <div className="text-center text-gray-500 py-8">Загрузка...</div>
              ) : clients.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {search ? "Клиенты не найдены" : "Начните вводить имя клиента"}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                      className="w-full text-left p-4 rounded-2xl border-2 border-gray-200 hover:bg-gray-50 hover:border-purple-300 transition-all duration-300"
                    >
                      <div className="font-bold text-gray-900">{client.name || `Клиент #${client.id}`}</div>
                      {client.birth_date && (
                        <div className="text-sm text-gray-600 mt-1">
                          Дата рождения: {new Date(client.birth_date).toLocaleDateString("ru-RU")}
                        </div>
                      )}
                      {client.email && (
                        <div className="text-xs text-gray-500 mt-1">{client.email}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

