"use client";

import { useState, useEffect } from "react";

interface Template {
  id: string;
  name: string;
  content: string;
  category: string;
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "first-meeting",
    name: "Первая встреча",
    category: "Общие",
    content: "<p><strong>Первая встреча</strong></p><p>Дата: </p><p>Основные темы обсуждения:</p><ul><li></li></ul><p>Выводы:</p><p></p>"
  },
  {
    id: "feedback",
    name: "Фидбек после консультации",
    category: "Общие",
    content: "<p><strong>Фидбек</strong></p><p>Дата: </p><p>Реакция клиента:</p><p></p><p>Что сработало:</p><ul><li></li></ul><p>Что требует доработки:</p><ul><li></li></ul>"
  },
  {
    id: "homework",
    name: "Домашнее задание",
    category: "Задачи",
    content: "<p><strong>Домашнее задание</strong></p><p>Дата выдачи: </p><p>Задание:</p><ul><li></li></ul><p>Срок выполнения: </p><p>Комментарии:</p><p></p>"
  },
  {
    id: "goal-discussion",
    name: "Обсуждение цели",
    category: "Цели",
    content: "<p><strong>Обсуждение цели</strong></p><p>Цель клиента:</p><p></p><p>Текущее состояние:</p><p></p><p>План действий:</p><ol><li></li></ol>"
  },
  {
    id: "progress",
    name: "Отслеживание прогресса",
    category: "Цели",
    content: "<p><strong>Прогресс</strong></p><p>Дата: </p><p>Достигнуто:</p><ul><li></li></ul><p>Трудности:</p><ul><li></li></ul><p>Следующие шаги:</p><ul><li></li></ul>"
  },
  {
    id: "reminder",
    name: "Напоминание",
    category: "Общие",
    content: "<p><strong>Напоминание</strong></p><p>Дата: </p><p>Важно помнить:</p><p></p>"
  }
];

export function NotesTemplates({ onSelect }: { onSelect: (content: string) => void }) {
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Все");
  const [isOpen, setIsOpen] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", content: "", category: "Общие" });

  useEffect(() => {
    // Загружаем кастомные шаблоны из localStorage
    try {
      const saved = localStorage.getItem("notes_templates");
      if (saved) {
        const parsed = JSON.parse(saved);
        setCustomTemplates(parsed);
      }
    } catch (e) {
      console.warn("Failed to load templates from localStorage", e);
    }
  }, []);

  const allTemplates = [...templates, ...customTemplates];
  const categories = Array.from(new Set(allTemplates.map(t => t.category)));
  const filteredTemplates = selectedCategory === "Все" 
    ? allTemplates 
    : allTemplates.filter(t => t.category === selectedCategory);

  function handleSelect(template: Template) {
    onSelect(template.content);
    setIsOpen(false);
  }

  function handleSaveCustom() {
    if (!newTemplate.name.trim() || !newTemplate.content.trim()) {
      alert("Заполните название и содержимое");
      return;
    }

    const template: Template = {
      id: `custom-${Date.now()}`,
      name: newTemplate.name,
      content: newTemplate.content,
      category: newTemplate.category
    };

    const updated = [...customTemplates, template];
    setCustomTemplates(updated);
    localStorage.setItem("notes_templates", JSON.stringify(updated));
    setNewTemplate({ name: "", content: "", category: "Общие" });
    setShowNewTemplate(false);
  }

  function handleDeleteCustom(id: string) {
    if (!confirm("Удалить этот шаблон?")) return;
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    localStorage.setItem("notes_templates", JSON.stringify(updated));
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-2xl border border-gray-300/80 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-300"
        type="button"
      >
        📋 Шаблоны
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] grid place-items-center p-4" onClick={() => setIsOpen(false)}>
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100/80 max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold tracking-tight leading-tight">Шаблоны заметок</h2>
          <button className="text-gray-500 hover:text-gray-800 text-2xl" onClick={() => setIsOpen(false)}>×</button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow">
          {/* Категории */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setSelectedCategory("Все")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                selectedCategory === "Все"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Все
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  selectedCategory === cat
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Шаблоны */}
          {!showNewTemplate ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {filteredTemplates.map(template => (
                  <div
                    key={template.id}
                    className="p-4 border-2 border-gray-200 rounded-2xl hover:border-brand-300 hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => handleSelect(template)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 group-hover:text-brand-600 transition-colors">
                          {template.name}
                        </h3>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full inline-block mt-1">
                          {template.category}
                        </span>
                      </div>
                      {template.id.startsWith("custom-") && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustom(template.id);
                          }}
                          className="text-red-500 hover:text-red-700 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          type="button"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                    <div
                      className="text-sm text-gray-600 line-clamp-3"
                      dangerouslySetInnerHTML={{ __html: template.content }}
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowNewTemplate(true)}
                className="w-full rounded-2xl border border-gray-300/80 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-300"
                type="button"
              >
                + Создать свой шаблон
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Название</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  placeholder="Например: Консультация по карьере"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Категория</label>
                <select
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  {!categories.includes(newTemplate.category) && (
                    <option value={newTemplate.category}>{newTemplate.category}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Содержимое (HTML)</label>
                <textarea
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 min-h-32 font-mono text-sm"
                  placeholder="<p>Ваш текст</p>"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveCustom}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 text-white px-6 py-3 font-semibold text-sm shadow-lg shadow-brand-500/20 hover:from-brand-700 hover:to-brand-800 hover:shadow-xl hover:shadow-brand-500/30 transition-all duration-300 active:scale-[0.98]"
                  type="button"
                >
                  Сохранить шаблон
                </button>
                <button
                  onClick={() => {
                    setShowNewTemplate(false);
                    setNewTemplate({ name: "", content: "", category: "Общие" });
                  }}
                  className="rounded-2xl border border-gray-300/80 px-6 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-300"
                  type="button"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

