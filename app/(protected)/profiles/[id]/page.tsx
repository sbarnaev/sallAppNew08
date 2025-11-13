"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

type Profile = {
  id: number;
  html?: string | null;
  raw_json?: any;
  created_at?: string;
  client_id?: number | null;
  ui_state?: any;
  notes?: string | null;
  chat_history?: Array<{ role: "user" | "assistant"; content: string }>;
  images?: any; // Может быть массивом файлов или строкой
  digits?: any;
};

export default function ProfileDetail() {
  const params = useParams();
  const id = params?.id as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clientName, setClientName] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(true);
  const pollingRef = useRef(true);
  const [expandAll, setExpandAll] = useState(false);
  const localUiStateRef = useRef<Record<string, boolean>>({});
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const savingCheckboxRef = useRef(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [savingNotes, setSavingNotes] = useState(false);
  const notesTouchedRef = useRef(false);
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const notesOpenRef = useRef(false);
  useEffect(() => { notesOpenRef.current = notesOpen; }, [notesOpen]);
  const [chat, setChat] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const chatRef = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  useEffect(() => { chatRef.current = chat; }, [chat]);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // авто-прокрутка вниз при появлении новых сообщений
    try {
      chatBoxRef.current?.scrollTo({ top: chatBoxRef.current.scrollHeight, behavior: "smooth" });
    } catch {}
  }, [chat]);

  function ActionBar() {
    async function copyLink() {
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('Ссылка скопирована!');
      } catch {}
    }
    
    async function duplicateProfile() {
      if (!profile) return;
      if (!confirm('Создать копию этого профиля?')) return;
      
      try {
        const res = await fetch(`/api/profiles/${id}`, { cache: 'no-store' });
        const data = await res.json().catch(()=>({}));
        const originalProfile = data?.data;
        
        if (!originalProfile) {
          alert('Не удалось загрузить профиль');
          return;
        }
        
        // Создаём новый профиль с теми же данными
        const newProfileData: any = {
          client_id: originalProfile.client_id,
          digits: originalProfile.digits,
        };
        
        if (originalProfile.raw_json) newProfileData.raw_json = originalProfile.raw_json;
        if (originalProfile.html) newProfileData.html = originalProfile.html;
        if (originalProfile.images) newProfileData.images = originalProfile.images;
        
        const createRes = await fetch('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProfileData),
        });
        
        const newData = await createRes.json().catch(()=>({}));
        if (createRes.ok && newData?.data?.id) {
          window.location.href = `/profiles/${newData.data.id}`;
        } else {
          alert('Не удалось создать копию профиля');
        }
      } catch (err) {
        alert('Ошибка при копировании профиля');
      }
    }
    async function exportPdf() {
      let strengths: string[] = [];
      let weaknesses: string[] = [];
      let personalitySummary: string = '';
      let happinessFormula: string = '';
      let digits: any[] = [];
      let resourceSignals: string[] = [];
      let deficitSignals: string[] = [];
      let checkedResource: Record<string, boolean> = {};
      let checkedDeficit: Record<string, boolean> = {};
      
      try {
        let payload: any = profile?.raw_json;
        if (typeof payload === 'string') payload = JSON.parse(payload);
        const item = Array.isArray(payload) ? payload[0] : payload;
        
        strengths = item?.strengths || (item?.strengths_text ? String(item.strengths_text).split(/\n+/).filter(Boolean) : []);
        weaknesses = item?.weaknesses || (item?.weaknesses_text ? String(item.weaknesses_text).split(/\n+/).filter(Boolean) : []);
        
        // Чеклисты ресурсов
        resourceSignals = Array.isArray(item?.resourceSignals) ? item.resourceSignals : (item?.resourceSignals_text ? String(item.resourceSignals_text).split(/\n+/).filter(Boolean) : []);
        deficitSignals = Array.isArray(item?.deficitSignals) ? item.deficitSignals : (item?.deficitSignals_text ? String(item.deficitSignals_text).split(/\n+/).filter(Boolean) : []);
        
        // Получаем состояние чекбоксов из ui_state
        const uiState = (profile as any)?.ui_state;
        if (uiState?.checked) {
          checkedResource = Object.fromEntries(
            Object.entries(uiState.checked).filter(([key]) => key.includes('resourceSignals'))
          );
          checkedDeficit = Object.fromEntries(
            Object.entries(uiState.checked).filter(([key]) => key.includes('deficitSignals'))
          );
        }
        
        if (item?.personalitySummary) {
          personalitySummary = Array.isArray(item.personalitySummary) 
            ? item.personalitySummary.join('\n\n') 
            : String(item.personalitySummary);
        }
        
        if (item?.happinessFormula) {
          happinessFormula = Array.isArray(item.happinessFormula)
            ? item.happinessFormula.join('\n\n')
            : String(item.happinessFormula);
        }
        
        // Получаем digits
        const d = (profile as any)?.digits;
        if (Array.isArray(d)) digits = d;
        else if (typeof d === 'string') {
          try {
            const parsed = JSON.parse(d);
            digits = Array.isArray(parsed) ? parsed : String(d).split(/[,\s]+/).filter(Boolean);
          } catch {
            digits = String(d).split(/[,\s]+/).filter(Boolean);
          }
        }
      } catch {}
      
      let contact = "";
      let initials = "";
      try {
        const meRes = await fetch('/api/me', { cache: 'no-store' });
        const me = await meRes.json().catch(()=>({}));
        const user = me?.data || {};
        initials = [user.first_name, user.last_name].filter(Boolean).map((n:string)=>n?.[0]?.toUpperCase() || '').filter(Boolean).join('.');
        if (initials) initials += '.';
        contact = user.contact || '';
      } catch {}
      
      const dateStr = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ru-RU') : '';
      
      const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Расчёт профиля${clientName ? ' — ' + clientName : ''}</title>
  <style>
    @media print {
      @page { 
        margin: 15mm;
        size: A4;
      }
      body { margin: 0; }
      .no-print { display: none !important; }
    }
    @media screen {
      body { background: #f5f5f5; padding: 20px; }
      .container { background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    }
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
    }
    h1 { 
      font-size: 24px; 
      margin: 0 0 8px 0;
      font-weight: 600;
      color: #1a1a1a;
    }
    .subtitle {
      font-size: 12px;
      color: #666;
      margin-bottom: 24px;
    }
    h2 { 
      font-size: 18px; 
      margin: 24px 0 12px 0;
      font-weight: 600;
      color: #1a1a1a;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 4px;
    }
    .digits {
      display: flex;
      gap: 12px;
      margin: 20px 0;
      justify-content: center;
    }
    .digit-box {
      width: 50px;
      height: 50px;
      background: #1f92aa;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      border-radius: 8px;
    }
    ul { 
      margin: 0 0 16px 0; 
      padding-left: 24px; 
    }
    li { 
      margin: 6px 0;
      line-height: 1.6;
    }
    .section {
      margin-bottom: 24px;
    }
    .personality, .happiness {
      background: #f9f9f9;
      padding: 16px;
      border-radius: 8px;
      margin: 16px 0;
      white-space: pre-wrap;
      line-height: 1.7;
    }
    .footer { 
      margin-top: 40px; 
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      color: #666;
      font-size: 12px;
      text-align: right;
    }
    .footer-line {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Расчёт профиля${clientName ? ' — ' + clientName : ''}</h1>
    ${dateStr ? `<div class="subtitle">Дата создания: ${dateStr}</div>` : ''}
    
    ${digits.length > 0 ? `
    <div class="digits">
      ${digits.slice(0, 5).map((d: any) => `<div class="digit-box">${d || ''}</div>`).join('')}
    </div>
    ` : ''}
    
    ${personalitySummary ? `
    <div class="section">
      <h2>Описание личности</h2>
      <div class="personality">${personalitySummary.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>
    ` : ''}
    
    ${strengths.length > 0 ? `
    <div class="section">
      <h2>Сильные стороны</h2>
      <ul>${strengths.map((s: string) => `<li>${String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`).join('')}</ul>
    </div>
    ` : ''}
    
    ${weaknesses.length > 0 ? `
    <div class="section">
      <h2>Слабые стороны</h2>
      <ul>${weaknesses.map((w: string) => `<li>${String(w).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`).join('')}</ul>
    </div>
    ` : ''}
    
    ${(resourceSignals.length > 0 || deficitSignals.length > 0) ? `
    <div class="section">
      <h2>Диагностика ресурсов</h2>
      ${resourceSignals.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; margin-bottom: 8px; color: #059669;">Признаки плюса (ресурс)</h3>
        <ul style="list-style: none; padding-left: 0;">
          ${resourceSignals.map((r: string, idx: number) => {
            // Простая проверка по ключам
            const isChecked = Object.keys(checkedResource).some(k => 
              k.includes('resourceSignals') && (k.includes(String(idx)) || k.includes(r.slice(0, 20)))
            );
            return \`<li style="margin: 4px 0; padding-left: 24px; position: relative;">
              <span style="position: absolute; left: 0;">${isChecked ? '☑' : '☐'}</span>
              \${String(r).replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </li>\`;
          }).join('')}
        </ul>
      </div>
      ` : ''}
      ${deficitSignals.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; margin-bottom: 8px; color: #dc2626;">Признаки минуса (дефицит)</h3>
        <ul style="list-style: none; padding-left: 0;">
          ${deficitSignals.map((d: string, idx: number) => {
            // Простая проверка по ключам
            const isChecked = Object.keys(checkedDeficit).some(k => 
              k.includes('deficitSignals') && (k.includes(String(idx)) || k.includes(d.slice(0, 20)))
            );
            return \`<li style="margin: 4px 0; padding-left: 24px; position: relative;">
              <span style="position: absolute; left: 0;">${isChecked ? '☑' : '☐'}</span>
              \${String(d).replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </li>\`;
          }).join('')}
        </ul>
      </div>
      ` : ''}
    </div>
    ` : ''}
    
    ${happinessFormula ? `
    <div class="section">
      <h2>Формула счастья</h2>
      <div class="happiness">${happinessFormula.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>
    ` : ''}
    
    <div class="footer">
      ${initials ? `<div class="footer-line">${initials}</div>` : ''}
      ${contact ? `<div class="footer-line">${contact}</div>` : ''}
    </div>
  </div>
</body>
</html>`;
      
      const frame = document.createElement('iframe');
      frame.style.position = 'fixed';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '0';
      frame.style.height = '0';
      frame.style.border = '0';
      document.body.appendChild(frame);
      frame.srcdoc = html;
      frame.onload = () => {
        setTimeout(() => {
          frame.contentWindow?.print();
          setTimeout(() => document.body.removeChild(frame), 2000);
        }, 100);
      };
    }
    return (
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => setExpandAll(true)} className="px-3 py-1.5 rounded-lg border hover:bg-gray-50">Развернуть всё</button>
        <button onClick={() => setExpandAll(false)} className="px-3 py-1.5 rounded-lg border hover:bg-gray-50">Свернуть всё</button>
        <button onClick={() => window.print()} className="px-3 py-1.5 rounded-lg border hover:bg-gray-50">Печать</button>
        <button onClick={copyLink} className="px-3 py-1.5 rounded-lg border hover:bg-gray-50">🔗 Ссылка</button>
        <button onClick={duplicateProfile} className="px-3 py-1.5 rounded-lg border hover:bg-gray-50">📋 Копировать</button>
        <button onClick={exportPdf} className="px-3 py-1.5 rounded-lg border hover:bg-gray-50">📄 PDF</button>
      </div>
    );
  }

  function AccordionSection({ title, children }: { title: string; children: React.ReactNode }) {
    // Всегда открыто, без кнопки, чтобы ничего не закрывалось само
    return (
      <div className="rounded-2xl border border-blue-100 overflow-hidden">
        <div className="w-full flex items-center justify-between px-4 py-4 text-left bg-white">
          <span className="font-semibold text-gray-900">{title}</span>
        </div>
        <div className="p-6">{children}</div>
      </div>
    );
  }

  // Первичная загрузка и поллинг до появления html/данных
  useEffect(() => {
    let mounted = true;
    let tries = 0;
    const maxTries = 90; // до ~3 минут

    async function fetchOnce() {
      let data: any = null;
      try {
        const res = await fetch(`/api/profiles/${id}?_=${Date.now()}`, {
          cache: "no-store",
          credentials: "include",
          headers: { Accept: "application/json" },
          mode: "same-origin",
        } as RequestInit);
        if (!res.ok) {
          // 401/403/5xx — мягко завершаем попытку
          try { data = await res.json(); } catch { data = null; }
        } else {
          data = await res.json();
        }
      } catch {
        // network/CORS — не роняем, попробуем позже
        data = null;
      }
      if (!mounted) return;
      const p = data?.data || null;
      // если идёт локальное сохранение чекбоксов — не перетирать ui_state
      setProfile(prev => {
        if (!prev) return p;
        if (savingCheckboxRef.current && prev?.ui_state?.checked) {
          return { ...p, ui_state: prev.ui_state };
        }
        return p;
      });
      // Инициализация чекбоксов из ui_state + слияние с локальными изменениями
      const serverChecked: Record<string, boolean> = (p?.ui_state?.checked as any) || {};
      const merged = { ...serverChecked, ...localUiStateRef.current };
      setCheckedMap(merged);
      // Инициализация заметок: не перетираем, если пользователь редактирует сейчас
      if (!notesTouchedRef.current && !notesOpenRef.current) {
        setNotesDraft(p?.notes || "");
      }
      if (Array.isArray(p?.chat_history) && chatRef.current.length === 0) {
        setChat(p.chat_history);
      }
      // Подтянем имя клиента
      if (p?.client_id) {
        try {
          const rc = await fetch(`/api/clients/${p.client_id}`, { cache: "no-store" });
          const cj = await rc.json().catch(()=>({}));
          const name = cj?.data?.name || "";
          if (name) setClientName(name);
        } catch {}
      }
      const htmlCandidate = p?.html || p?.raw_html || p?.content || p?.html_content;
      const hasRenderableHtml = Boolean(htmlCandidate && String(htmlCandidate).trim().length > 0);
      const hasRaw = Boolean(p?.raw_json && String(JSON.stringify(p.raw_json)).length > 2);
      tries += 1;
      if (hasRenderableHtml || hasRaw || tries >= maxTries) {
        setPolling(false);
        pollingRef.current = false;
      }
    }

    // моментальный первый запрос
    fetchOnce();
    // далее поллинг
    const interval = setInterval(fetchOnce, 1800);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [id]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setAnswer("");
    // добавим пользователя в историю
    const history: Array<{ role: "user" | "assistant"; content: string }> = [...chatRef.current, { role: "user" as const, content: q }];
    setChat(history);
    setQuestion("");
    try {
      const res = await fetch(`/api/qa?stream=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream", "Cache-Control": "no-cache" },
        body: JSON.stringify({
          profileId: Number(id),
          question: q,
          history: chatRef.current.slice(-8),
          stream: true,
        }),
      } as RequestInit);

      // Если сервер не отдал поток — fallback на обычный json
      if (!res.body || (res.headers.get("content-type") || "").indexOf("text/event-stream") === -1) {
        let a = "Нет ответа";
        try {
          const data = await res.json();
          a = data?.answer || data?.message || a;
        } catch {
          a = `Ошибка: ${res.status}`;
        }
        const newHistory: Array<{ role: "user" | "assistant"; content: string }> = [...history, { role: "assistant" as const, content: a }];
        setAnswer(a);
        setChat(newHistory);
        await saveChatHistory(newHistory);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      // добавим пустое сообщение ассистента, будем дописывать
      setChat((prev)=>[...prev, { role: "assistant", content: "" }]);
      let assistantIndex = -1;
      setChat((prev)=>{ assistantIndex = prev.length; return prev; });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // SSE: строки вида "data: ...\n\n"
        const lines = chunk.split("\n\n");
        for (const raw of lines) {
          if (!raw.startsWith("data:")) continue;
          const payload = raw.slice(5);
          if (payload.trim() === "[DONE]") continue;
          acc += payload;
          setAnswer(acc);
          setChat((prev)=>{
            const next = prev.slice();
            // найдём последний ассистентский блок и обновим
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i].role === "assistant") { next[i] = { role: "assistant", content: acc }; break; }
            }
            return next;
          });
        }
      }
      const finalHistory: Array<{ role: "user" | "assistant"; content: string }> = [...history, { role: "assistant" as const, content: acc }];
      await saveChatHistory(finalHistory);
    } catch (err) {
      const errorHistory: Array<{ role: "user" | "assistant"; content: string }> = [...history, { role: "assistant" as const, content: "Ошибка чата" }];
      setAnswer("Ошибка чата");
      setChat(errorHistory);
      await saveChatHistory(errorHistory);
    } finally {
      setLoading(false);
    }
  }

  function wrapSelection(prefix: string, suffix = prefix) {
    const ta = notesTextareaRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd } = ta;
    const before = notesDraft.slice(0, selectionStart);
    const selected = notesDraft.slice(selectionStart, selectionEnd);
    const after = notesDraft.slice(selectionEnd);
    const next = before + prefix + selected + suffix + after;
    setNotesDraft(next);
    notesTouchedRef.current = true;
    const cursorStart = selectionStart + prefix.length;
    const cursorEnd = cursorStart + selected.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function prefixLines(prefix: string) {
    const ta = notesTextareaRef.current;
    if (!ta) return;
    let { selectionStart, selectionEnd } = ta;
    if (selectionStart === selectionEnd) {
      selectionStart = notesDraft.lastIndexOf("\n", selectionStart - 1) + 1;
      const lineEnd = notesDraft.indexOf("\n", selectionEnd);
      selectionEnd = lineEnd === -1 ? notesDraft.length : lineEnd;
    }
    const before = notesDraft.slice(0, selectionStart);
    const selected = notesDraft.slice(selectionStart, selectionEnd);
    const after = notesDraft.slice(selectionEnd);
    const newSelected = selected.split("\n").map(line => prefix + line).join("\n");
    const next = before + newSelected + after;
    setNotesDraft(next);
    notesTouchedRef.current = true;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(selectionStart, selectionStart + newSelected.length);
    });
  }

  // Сохранение состояния чекбоксов в Directus (profiles.ui_state JSON)
  const saveChecked = useCallback(async (nextMap: Record<string, boolean>) => {
    // Очередь сохранений, чтобы клик не терялся при поллинге
    (saveChecked as any)._queue = (saveChecked as any)._queue || [];
    (saveChecked as any)._queue.push(nextMap);
    if ((saveChecked as any)._running) return;
    (saveChecked as any)._running = true;
    try {
      savingCheckboxRef.current = true;
      while ((saveChecked as any)._queue.length) {
        const payload = (saveChecked as any)._queue.pop();
        localUiStateRef.current = payload;
        const res = await fetch(`/api/profiles/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({ ui_state: { checked: payload } }),
        });
        if (res.ok) setProfile((p) => (p ? { ...p, ui_state: { checked: payload } } : p));
      }
    } finally {
      savingCheckboxRef.current = false;
      (saveChecked as any)._running = false;
    }
  }, [id]);
  // Persist chat history in Directus
  const saveChatHistory = useCallback(async (history: Array<{ role: "user" | "assistant"; content: string }>) => {
    try {
      await fetch(`/api/profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_history: history }),
      });
    } catch {}
  }, [id]);

  // Ключи чекбоксов: новый (по хэшу текста) + легаси (по индексу и усечённому тексту)
  function normalizeTextForHash(text: string): string {
    return (text || "").toString().replace(/\s+/g, " ").trim();
  }
  function hashString(input: string): string {
    // простая FNV-1a 32-bit
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(16);
  }

  const renderedFromJson = useMemo(() => {
    if (!profile?.raw_json) return null;
    let payload: any = profile.raw_json;
    try {
      if (typeof payload === "string") payload = JSON.parse(payload);
    } catch {
      return null;
    }
    const items = Array.isArray(payload) ? payload : [payload];

    const makeHashKey = (section: string, text: string): string => `${section}:h:${hashString(normalizeTextForHash(text))}`;
    const makeLegacyKey = (section: string, text: string, index: number): string => {
      const norm = (text || "").toString().slice(0, 80);
      return `${section}:${index}:${norm}`;
    };

    const CheckList = ({ list, section }: { list: string[]; section: string }) => (
      <ul className="space-y-2">
        {list.map((text, i) => {
          const legacyKey = makeLegacyKey(section, text, i);
          const hashKey = makeHashKey(section, text);
          const checked = Boolean(checkedMap[hashKey] ?? checkedMap[legacyKey]);
          const inputId = `${hashKey}-${i}`;
          return (
            <li key={hashKey} className="grid grid-cols-[22px_1fr] gap-3 items-start">
              <input
                id={inputId}
                type="checkbox"
                checked={checked}
                onChange={(e)=>{
                  const next = { ...checkedMap, [hashKey]: e.target.checked, [legacyKey]: e.target.checked };
                  setCheckedMap(next);
                  localUiStateRef.current = next;
                  saveChecked(next);
                }}
                className="mt-0.5 h-[18px] w-[18px] rounded border-2 border-indigo-300 bg-indigo-100 text-indigo-600 focus:ring-0"
              />
              <label htmlFor={inputId} className="leading-relaxed text-gray-800 cursor-pointer">
                {text}
              </label>
            </li>
          );
        })}
      </ul>
    );

    const Entry = ({ title, children, color = "teal" as "teal" | "amber" }: { title?: string; children?: React.ReactNode; color?: "teal" | "amber" }) => (
      <div className="relative rounded-xl border-2 border-blue-100 p-4 pl-8">
        <span className={`absolute left-3 top-3 bottom-3 w-[6px] rounded-[3px] ${color === "teal" ? "bg-teal-500" : "bg-amber-500"}`} />
        {title && <h3 className="m-0 text-[18px] font-semibold">{title}</h3>}
        <div className="mt-2 space-y-2 text-gray-700">{children}</div>
      </div>
    );

    return (
      <div className="space-y-6">
        {items.map((item, idx) => (
          <div key={idx} className="space-y-6">
            {(item.opener || item.personalitySummary) && (
              <section className="space-y-6">
                {item.opener && (
                  <article className="rounded-2xl border border-blue-100 p-6">
                    <h2 className="m-0 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-600">
                      <span className="inline-block w-[22px] text-center">❗</span>
                      Скажите клиенту
                    </h2>
                    <p className="mt-3 whitespace-pre-wrap leading-relaxed text-gray-800">{item.opener}</p>
                  </article>
                )}

                {item.personalitySummary && (
                  <article className="rounded-2xl border border-blue-100 p-6">
                    <h2 className="title-up m-0 text-sm font-bold uppercase tracking-wide text-gray-600">Описание личности</h2>
                    {Array.isArray(item.personalitySummary) ? (
                      <div className="mt-3 space-y-2">
                        {item.personalitySummary.map((t: string, idx: number) => (
                          <p key={idx} className="whitespace-pre-wrap leading-relaxed text-gray-800">{t}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 whitespace-pre-wrap leading-relaxed text-gray-800">{item.personalitySummary}</p>
                    )}
                  </article>
                )}
              </section>
            )}

            {(item.strengths || item.strengths_text || item.weaknesses || item.weaknesses_text) && (
              <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <article className="rounded-2xl bg-orange-400/90 p-6 text-gray-900">
                  <h3 className="title-up m-0 text-base font-bold">Сильные стороны</h3>
                  <div className="mt-3">
                    {Array.isArray(item.strengths) ? (
                      <CheckList list={item.strengths} section="strengths" />
                    ) : (
                      item.strengths_text && (
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">{item.strengths_text}</pre>
                      )
                    )}
                  </div>
                </article>
                <article className="rounded-2xl bg-orange-400/90 p-6 text-gray-900">
                  <h3 className="title-up m-0 text-base font-bold">Слабые стороны</h3>
                  <div className="mt-3">
                    {Array.isArray(item.weaknesses) ? (
                      <CheckList list={item.weaknesses} section="weaknesses" />
                    ) : (
                      item.weaknesses_text && (
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">{item.weaknesses_text}</pre>
                      )
                    )}
                  </div>
                </article>
              </section>
            )}

            {item.happinessFormula && (
              <section className="rounded-2xl bg-sky-500 text-white p-6">
                <h2 className="m-0 text-lg font-bold">☺️ Формула счастья</h2>
                {Array.isArray(item.happinessFormula) ? (
                  <div className="mt-3 space-y-2">
                    {item.happinessFormula.map((t: string, i: number) => (
                      <p key={i} className="whitespace-pre-wrap leading-relaxed">{t}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 whitespace-pre-wrap leading-relaxed">{item.happinessFormula}</p>
                )}
              </section>
            )}

            {Array.isArray(item.codesExplanation) && item.codesExplanation.length > 0 && (
              <section className="rounded-2xl border border-blue-100 p-6">
                <h2 className="title-up m-0 text-sm font-bold uppercase tracking-wide text-gray-600">Пояснение кодов</h2>
                <div className="mt-3 space-y-2">
                  {item.codesExplanation.map((t: string, i: number) => (
                    <p key={i} className="whitespace-pre-wrap text-gray-800">{t}</p>
                  ))}
                </div>
              </section>
            )}

            {(item.resourceSignals || item.resourceSignals_text || item.deficitSignals || item.deficitSignals_text) && (
              <>
                <article className="rounded-2xl border border-blue-100 p-6">
                  <h2 className="title-up m-0 text-sm font-bold uppercase tracking-wide text-gray-600">Диагностика ресурсов</h2>
                  <p className="mt-3 text-sm text-gray-700">Оцените совпадение пунктов «плюса» и «минуса», подведите итог и сделайте вывод о текущем ресурсе.</p>
                </article>
                <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <article className="rounded-2xl bg-orange-400/90 p-6 text-gray-900">
                    <h3 className="title-up m-0 text-base font-bold">Признаки плюса</h3>
                    <div className="mt-3">
                      {Array.isArray(item.resourceSignals) ? (
                        <CheckList list={item.resourceSignals} section="resourceSignals" />
                      ) : (
                        item.resourceSignals_text && (
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">{item.resourceSignals_text}</pre>
                        )
                      )}
                    </div>
                  </article>
                  <article className="rounded-2xl bg-orange-400/90 p-6 text-gray-900">
                    <h3 className="title-up m-0 text-base font-bold">Признаки минуса</h3>
                    <div className="mt-3">
                      {Array.isArray(item.deficitSignals) ? (
                        <CheckList list={item.deficitSignals} section="deficitSignals" />
                      ) : (
                        item.deficitSignals_text && (
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">{item.deficitSignals_text}</pre>
                        )
                      )}
                    </div>
                  </article>
                </section>
              </>
            )}

            {Array.isArray(item.conflicts) && item.conflicts.length > 0 && (
              <AccordionSection title="Конфликты и проблемы">
                <div className="space-y-6">
                  {item.conflicts.map((c: any, i: number) => (
                    <Entry key={i} title={c.title}>
                      {c.description && <p className="whitespace-pre-wrap">{c.description}</p>}
                      {Array.isArray(c.manifestations) && c.manifestations.length > 0 && (
                        <div>
                          <div className="mb-1 text-sm text-gray-500">Как проявляется</div>
                          <ul className="list-disc pl-6 space-y-1 text-gray-800">
                            {c.manifestations.map((m: string, j: number) => (
                              <li key={j}>{m}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {c.advice && (
                        <div>
                          <div className="mb-1 text-sm text-gray-500">Что делать</div>
                          <p className="whitespace-pre-wrap">{c.advice}</p>
                        </div>
                      )}
                    </Entry>
                  ))}
                </div>
              </AccordionSection>
            )}

            {item.practices && (
              <AccordionSection title="Практики">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  {Object.entries(item.practices).map(([blockKey, list]: any, i: number) => (
                    <article key={i} className="rounded-2xl border border-blue-100 p-4">
                      <div className="mb-2 font-semibold">{mapPracticeKey(blockKey)}</div>
                      {Array.isArray(list) ? (
                        <div className="space-y-3">
                          {list.map((pr: any, j: number) => (
                            <Entry key={j} title={pr.title}>
                              {pr.p1 && <p className="text-sm whitespace-pre-wrap">{pr.p1}</p>}
                              {pr.p2 && <p className="text-sm whitespace-pre-wrap">{pr.p2}</p>}
                              {pr.description && <p className="text-sm whitespace-pre-wrap">{pr.description}</p>}
                            </Entry>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Нет данных</div>
                      )}
                    </article>
                  ))}
                </div>
              </AccordionSection>
            )}
          </div>
        ))}
      </div>
    );
  }, [profile?.raw_json, checkedMap, saveChecked]);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold">{clientName || "Профиль"}</div>
          {profile?.created_at && (
            <div className="text-sm text-gray-500 mt-1">Создан: {new Date(profile.created_at).toLocaleString("ru-RU")}</div>
          )}
        </div>
        <ActionBar />
      </div>

      {/* Пять кубиков (как в шаблоне) */}
      {(() => {
        // digits: или массив, или строка JSON/CSV; возьмём как есть порядок
        let arr: any[] = [];
        const d = (profile as any)?.digits;
        if (Array.isArray(d)) arr = d;
        else if (typeof d === 'string') {
          try {
            const parsed = JSON.parse(d);
            if (Array.isArray(parsed)) arr = parsed;
            else arr = String(d).split(/[,\s]+/).filter(Boolean);
          } catch {
            arr = String(d).split(/[,\s]+/).filter(Boolean);
          }
        }
        return (
          <div className="flex flex-wrap gap-6 justify-center items-center py-4">
            {arr.slice(0,5).map((val: any, i: number) => (
              <div key={i} className="w-[74px] h-[74px] rounded-xl shadow-sm bg-[#1f92aa] text-white font-bold text-[28px] grid place-items-center">
                {val ?? ""}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Пять изображений */}
      {(() => {
        const images = (profile as any)?.images;
        let imageArray: any[] = [];
        
        // Обработка разных форматов: массив файлов, один файл, строка JSON, или массив строк
        if (Array.isArray(images)) {
          imageArray = images;
        } else if (images) {
          if (typeof images === 'string') {
            try {
              const parsed = JSON.parse(images);
              imageArray = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              imageArray = [images];
            }
          } else {
            imageArray = [images];
          }
        }
        
        // Если нет изображений, показываем плейсхолдеры
        const displayImages = imageArray.length > 0 ? imageArray : Array.from({ length: 5 }).map(() => null);
        
        // Функция для получения URL изображения
        const getImageUrl = (img: any): string | null => {
          if (!img) return null;
          
          // Если это объект файла Directus с полным URL
          if (typeof img === 'object') {
            if (img.id) {
              // Используем API прокси для изображений
              return `/api/files/${img.id}`;
            }
            // Если есть прямой URL
            if (img.url) return img.url;
            if (img.filename_download) {
              return img.id ? `/api/files/${img.id}` : null;
            }
          }
          
          // Если это строка
          if (typeof img === 'string') {
            // Если уже полный URL
            if (img.startsWith('http')) return img;
            // Если это ID файла
            if (/^\d+$/.test(img)) return `/api/files/${img}`;
            // Иначе считаем это URL
            return img;
          }
          
          return null;
        };
        
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {displayImages.slice(0, 5).map((img: any, i: number) => {
              const imageUrl = getImageUrl(img);
              
              return (
                <div key={i} className="rounded-2xl overflow-hidden border bg-gray-50 h-36 grid place-items-center relative">
                  {imageUrl ? (
                    <>
                      <img 
                        src={imageUrl} 
                        alt={`Изображение ${i + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const placeholder = target.nextElementSibling as HTMLElement;
                          if (placeholder) placeholder.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-50">
                        Изображение {i + 1}
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-400">Изображение {i + 1}</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {polling && (
        <div className="card flex items-center gap-3 text-gray-700">
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          Данные рассчитываются... ещё немного
        </div>
      )}

      {(() => {
        const html = (profile as any)?.html || (profile as any)?.raw_html || (profile as any)?.content || (profile as any)?.html_content;
        if (html && String(html).trim().length > 0) {
          return (
            <AccordionSection title="Готовый расчёт (HTML)">
              <div className="card" dangerouslySetInnerHTML={{ __html: String(html) }} />
            </AccordionSection>
          );
        }
        if (renderedFromJson) return renderedFromJson;
        return !polling ? (
          <div className="card text-sm text-gray-600">Нет данных для отображения.</div>
        ) : null;
      })()}

      <div className="card space-y-4">
        <div className="font-medium">Задать вопрос по профилю</div>
        <div className="space-y-3">
          <div className="rounded-xl border p-3 bg-white max-h-80 overflow-y-auto break-words">
            {chat.length === 0 && <div className="text-sm text-gray-500">Начните диалог — задайте вопрос ниже</div>}
            {chat.map((m, i) => (
              <div key={i} className={`mb-3 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block rounded-2xl px-3 py-2 whitespace-pre-wrap break-words ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>{m.content}</div>
              </div>
            ))}
          </div>
          <form onSubmit={ask} className="flex items-start gap-3">
            <textarea
              className="flex-1 rounded-xl border p-3 h-24 resize-none overflow-y-auto"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Например: как лучше работать с конфликтом 2↔7?"
              required
            />
            <button
              disabled={loading}
              className="rounded-2xl bg-brand-600 text-white px-4 py-2 h-11 mt-1 hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "Думаю..." : "Спросить"}
            </button>
          </form>
        </div>
      </div>

      {/* Плавающая кнопка «Заметки» */}
      <button
        onClick={() => setNotesOpen(true)}
        className="fixed right-6 bottom-6 rounded-full shadow-lg bg-brand-600 text-white px-5 py-3 hover:bg-brand-700 z-40"
      >
        📝 Заметки
      </button>

      {notesOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4" onClick={() => setNotesOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-4 space-y-3" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">Заметки по расчёту</div>
              <button className="text-gray-500 hover:text-gray-800" onClick={() => setNotesOpen(false)}>✕</button>
            </div>
            
            {/* Шаблоны заметок */}
            <div className="flex flex-wrap gap-2 pb-2 border-b">
              <span className="text-xs text-gray-500 mr-2">Шаблоны:</span>
              <button
                className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                onClick={(e) => {
                  e.preventDefault();
                  const template = `## Встреча ${new Date().toLocaleDateString('ru-RU')}\n\n### Обсудили:\n- \n- \n\n### Действия:\n- \n- \n\n### Следующая встреча:\n`;
                  setNotesDraft(notesDraft + (notesDraft ? '\n\n' : '') + template);
                  notesTouchedRef.current = true;
                }}
              >
                📅 Встреча
              </button>
              <button
                className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                onClick={(e) => {
                  e.preventDefault();
                  const template = `## Заметки\n\n### Сильные стороны:\n- \n- \n\n### Области роста:\n- \n- \n\n### Рекомендации:\n- \n- \n`;
                  setNotesDraft(notesDraft + (notesDraft ? '\n\n' : '') + template);
                  notesTouchedRef.current = true;
                }}
              >
                💡 Анализ
              </button>
              <button
                className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                onClick={(e) => {
                  e.preventDefault();
                  const template = `## Задачи\n\n- [ ] \n- [ ] \n- [ ] \n`;
                  setNotesDraft(notesDraft + (notesDraft ? '\n\n' : '') + template);
                  notesTouchedRef.current = true;
                }}
              >
                ✅ Задачи
              </button>
            </div>
            
            {/* Мини-редактор markdown */}
            <div className="flex flex-wrap gap-2">
              <button className="rounded border px-2 py-1 text-sm hover:bg-gray-50" onClick={(e)=>{e.preventDefault(); wrapSelection('**');}}>B</button>
              <button className="rounded border px-2 py-1 text-sm hover:bg-gray-50" onClick={(e)=>{e.preventDefault(); wrapSelection('*');}}>I</button>
              <button className="rounded border px-2 py-1 text-sm hover:bg-gray-50" onClick={(e)=>{e.preventDefault(); prefixLines('## ');}}>H2</button>
              <button className="rounded border px-2 py-1 text-sm hover:bg-gray-50" onClick={(e)=>{e.preventDefault(); prefixLines('- ');}}>• Список</button>
            </div>
            <textarea
              ref={notesTextareaRef}
              className="w-full h-64 rounded-xl border p-3 font-mono text-sm"
              value={notesDraft}
              onChange={(e)=>{ setNotesDraft(e.target.value); notesTouchedRef.current = true; }}
              placeholder="Markdown поддерживается. Используйте **жирный**, *курсив*, ## заголовки, - списки"
            />
            <div className="flex gap-2 justify-end">
              <button className="rounded-xl border px-4 py-2" onClick={()=>setNotesOpen(false)}>Отмена</button>
              <button
                className="rounded-xl bg-brand-600 text-white px-4 py-2 hover:bg-brand-700 disabled:opacity-60"
                disabled={savingNotes}
                onClick={async()=>{
                  setSavingNotes(true);
                  try {
                    const res = await fetch(`/api/profiles/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: notesDraft }) });
                    if (!res.ok) throw new Error('Failed to save notes');
                    setProfile(p => (p ? { ...p, notes: notesDraft } : p));
                    setNotesOpen(false);
                  } finally { setSavingNotes(false); }
                }}
              >
                {savingNotes ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function mapPracticeKey(key: string): string {
  const dict: Record<string, string> = {
    personality: "Личность",
    connector: "Связи/Коммуникация",
    realization: "Реализация",
    generator: "Источник/Подпитка",
    mission: "Миссия",
  };
  return dict[key] || key;
}
