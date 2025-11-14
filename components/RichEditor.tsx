"use client";

import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function RichEditor({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  
  // Инициализируем HTML начальным значением и синхронизируем при внешних изменениях
  useEffect(() => {
    if (!ref.current) return;
    const html = value || "";
    // Обновляем только если значение действительно изменилось
    if (ref.current.innerHTML !== html) {
      ref.current.innerHTML = html;
    }
  }, [value]);

  // Обработка placeholder для contentEditable
  useEffect(() => {
    if (!ref.current) return;
    const isEmpty = !ref.current.textContent?.trim();
    if (isEmpty) {
      ref.current.setAttribute('data-placeholder', 'Начните вводить текст...');
    } else {
      ref.current.removeAttribute('data-placeholder');
    }
  }, [value]);

  function exec(cmd: string, arg?: string) {
    if (!ref.current) return;
    ref.current.focus();
    document.execCommand(cmd, false, arg);
    onChange(ref.current.innerHTML);
  }


  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 border-b pb-2 mb-2">
        <button 
          type="button" 
          className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 font-semibold transition-colors" 
          onClick={(e) => { e.preventDefault(); exec("bold"); }}
          title="Жирный (Ctrl+B)"
        >
          B
        </button>
        <button 
          type="button" 
          className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 italic transition-colors" 
          onClick={(e) => { e.preventDefault(); exec("italic"); }}
          title="Курсив (Ctrl+I)"
        >
          I
        </button>
        <button 
          type="button" 
          className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 underline transition-colors" 
          onClick={(e) => { e.preventDefault(); exec("underline"); }}
          title="Подчеркнутый (Ctrl+U)"
        >
          U
        </button>
        <select 
          className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 text-sm transition-colors" 
          onChange={e => exec("formatBlock", e.target.value)}
          title="Стиль текста"
        >
          <option value="p">Текст</option>
          <option value="h1">Заголовок 1</option>
          <option value="h2">Заголовок 2</option>
          <option value="h3">Заголовок 3</option>
        </select>
        <input 
          type="color" 
          className="w-10 h-8 border rounded-lg cursor-pointer" 
          onChange={e => exec("foreColor", e.target.value)}
          title="Цвет текста"
        />
        <button 
          type="button" 
          className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 transition-colors" 
          onClick={(e) => { e.preventDefault(); exec("insertOrderedList"); }}
          title="Нумерованный список"
        >
          1.
        </button>
        <button 
          type="button" 
          className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 transition-colors" 
          onClick={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}
          title="Маркированный список"
        >
          •
        </button>
      </div>
      <div
        ref={ref}
        className="w-full min-h-64 max-h-96 overflow-auto border rounded-xl p-4 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all outline-none"
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          const html = ref.current?.innerHTML || "";
          onChange(html);
          // Обновляем placeholder
          const isEmpty = !ref.current?.textContent?.trim();
          if (isEmpty) {
            ref.current?.setAttribute('data-placeholder', 'Начните вводить текст...');
          } else {
            ref.current?.removeAttribute('data-placeholder');
          }
        }}
        style={{ minHeight: '256px' }}
      />
    </div>
  );
}
