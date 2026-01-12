"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

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
    category: "Консультации",
    content: "<p><strong>Первая встреча</strong></p><p>Дата: </p><p><strong>Основные темы обсуждения:</strong></p><ul><li></li><li></li><li></li></ul><p><strong>Запрос клиента:</strong></p><p></p><p><strong>Выводы и наблюдения:</strong></p><p></p><p><strong>Следующие шаги:</strong></p><ul><li></li></ul>"
  },
  {
    id: "regular-consultation",
    name: "Обычная консультация",
    category: "Консультации",
    content: "<p><strong>Консультация</strong></p><p>Дата: </p><p><strong>Что обсуждали:</strong></p><ul><li></li><li></li></ul><p><strong>Прогресс клиента:</strong></p><p></p><p><strong>Задачи на следующую встречу:</strong></p><ul><li></li></ul>"
  },
  {
    id: "feedback",
    name: "Фидбек после консультации",
    category: "Консультации",
    content: "<p><strong>Фидбек после консультации</strong></p><p>Дата: </p><p><strong>Реакция клиента:</strong></p><p></p><p><strong>Что сработало:</strong></p><ul><li></li><li></li></ul><p><strong>Что требует доработки:</strong></p><ul><li></li></ul><p><strong>Рекомендации:</strong></p><p></p>"
  },
  {
    id: "homework",
    name: "Домашнее задание",
    category: "Задачи",
    content: "<p><strong>Домашнее задание</strong></p><p>Дата выдачи: </p><p><strong>Задание:</strong></p><ul><li></li><li></li><li></li></ul><p><strong>Срок выполнения:</strong> </p><p><strong>Комментарии и инструкции:</strong></p><p></p>"
  },
  {
    id: "homework-check",
    name: "Проверка домашнего задания",
    category: "Задачи",
    content: "<p><strong>Проверка домашнего задания</strong></p><p>Дата: </p><p><strong>Что выполнено:</strong></p><ul><li></li></ul><p><strong>Что не выполнено:</strong></p><ul><li></li></ul><p><strong>Трудности:</strong></p><p></p><p><strong>Обратная связь:</strong></p><p></p>"
  },
  {
    id: "goal-discussion",
    name: "Обсуждение цели",
    category: "Цели",
    content: "<p><strong>Обсуждение цели</strong></p><p>Дата: </p><p><strong>Цель клиента:</strong></p><p></p><p><strong>Текущее состояние:</strong></p><p></p><p><strong>План действий:</strong></p><ol><li></li><li></li><li></li></ol><p><strong>Ожидаемый результат:</strong></p><p></p>"
  },
  {
    id: "progress",
    name: "Отслеживание прогресса",
    category: "Цели",
    content: "<p><strong>Отслеживание прогресса</strong></p><p>Дата: </p><p><strong>Достигнуто:</strong></p><ul><li></li><li></li></ul><p><strong>Трудности и препятствия:</strong></p><ul><li></li></ul><p><strong>Следующие шаги:</strong></p><ul><li></li><li></li></ul>"
  },
  {
    id: "goal-achieved",
    name: "Достижение цели",
    category: "Цели",
    content: "<p><strong>Достижение цели</strong></p><p>Дата: </p><p><strong>Достигнутая цель:</strong></p><p></p><p><strong>Как это было достигнуто:</strong></p><ul><li></li><li></li></ul><p><strong>Результаты и изменения:</strong></p><p></p><p><strong>Новые цели:</strong></p><ul><li></li></ul>"
  },
  {
    id: "crisis",
    name: "Кризисная ситуация",
    category: "Особые случаи",
    content: "<p><strong>Кризисная ситуация</strong></p><p>Дата: </p><p><strong>Описание ситуации:</strong></p><p></p><p><strong>Реакция клиента:</strong></p><p></p><p><strong>Принятые меры:</strong></p><ul><li></li><li></li></ul><p><strong>Рекомендации:</strong></p><p></p>"
  },
  {
    id: "resistance",
    name: "Сопротивление клиента",
    category: "Особые случаи",
    content: "<p><strong>Сопротивление клиента</strong></p><p>Дата: </p><p><strong>Проявления сопротивления:</strong></p><ul><li></li><li></li></ul><p><strong>Возможные причины:</strong></p><p></p><p><strong>Стратегия работы:</strong></p><p></p>"
  },
  {
    id: "breakthrough",
    name: "Прорыв/Инсайт",
    category: "Особые случаи",
    content: "<p><strong>Прорыв/Инсайт</strong></p><p>Дата: </p><p><strong>Что произошло:</strong></p><p></p><p><strong>Инсайт клиента:</strong></p><p></p><p><strong>Как это изменило ситуацию:</strong></p><p></p><p><strong>Следующие шаги:</strong></p><ul><li></li></ul>"
  },
  {
    id: "test-results",
    name: "Результаты тестирования",
    category: "Тестирование",
    content: "<p><strong>Результаты тестирования</strong></p><p>Дата: </p><p><strong>Пройденные тесты:</strong></p><ul><li></li></ul><p><strong>Основные результаты:</strong></p><p></p><p><strong>Интерпретация:</strong></p><p></p><p><strong>Рекомендации:</strong></p><ul><li></li></ul>"
  },
  {
    id: "reminder",
    name: "Важное напоминание",
    category: "Общие",
    content: "<p><strong>Важное напоминание</strong></p><p>Дата: </p><p><strong>Важно помнить:</strong></p><p></p><p><strong>Контекст:</strong></p><p></p>"
  },
  {
    id: "quick-note",
    name: "Быстрая заметка",
    category: "Общие",
    content: "<p><strong>Быстрая заметка</strong></p><p>Дата: </p><p></p>"
  }
];

export function NotesTemplates({ onSelect }: { onSelect: (content: string) => void }) {
  const [templates] = useState<Template[]>(DEFAULT_TEMPLATES);
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

  const allTemplates = useMemo(() => [...templates, ...customTemplates], [templates, customTemplates]);
  const categories = useMemo(() => Array.from(new Set(allTemplates.map(t => t.category))), [allTemplates]);
  const filteredTemplates = useMemo(() =>
    selectedCategory === "Все"
      ? allTemplates
      : allTemplates.filter(t => t.category === selectedCategory),
    [selectedCategory, allTemplates]
  );

  const handleSelect = useCallback((template: Template) => {
    onSelect(template.content);
    setIsOpen(false);
  }, [onSelect]);

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
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${selectedCategory === "Все"
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
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${selectedCategory === cat
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

