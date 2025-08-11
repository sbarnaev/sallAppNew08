"use client";

import { useEffect, useRef } from "react";

export default function RichEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  function exec(command: string, arg?: string) {
    document.execCommand(command, false, arg);
    onChange(ref.current?.innerHTML || "");
  }
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 border-b pb-2 mb-2">
        <button type="button" className="px-2 py-1 border rounded" onClick={() => exec("bold")}>B</button>
        <button type="button" className="px-2 py-1 border rounded" onClick={() => exec("italic")}>I</button>
        <button type="button" className="px-2 py-1 border rounded" onClick={() => exec("underline")}>U</button>
        <select className="px-2 py-1 border rounded" onChange={e => exec("formatBlock", e.target.value)}>
          <option value="p">Текст</option>
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
        </select>
        <input type="color" className="w-10 h-8 border rounded" onChange={e => exec("foreColor", e.target.value)} />
        <button type="button" className="px-2 py-1 border rounded" onClick={() => exec("insertOrderedList")}>1.</button>
        <button type="button" className="px-2 py-1 border rounded" onClick={() => exec("insertUnorderedList")}>•</button>
        <button type="button" className="px-2 py-1 border rounded" onClick={() => exec("formatBlock", "blockquote")}>❝</button>
        <button type="button" className="px-2 py-1 border rounded" onClick={() => exec("insertHTML", '<input type="checkbox" /> ')}>☑</button>
      </div>
      <div
        ref={ref}
        className="w-full h-64 overflow-auto border rounded-xl p-3"
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML || "")}
      />
    </div>
  );
}
