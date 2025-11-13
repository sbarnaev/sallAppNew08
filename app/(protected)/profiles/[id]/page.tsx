"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
          ) as Record<string, boolean>;
          checkedDeficit = Object.fromEntries(
            Object.entries(uiState.checked).filter(([key]) => key.includes('deficitSignals'))
          ) as Record<string, boolean>;
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
            const escaped = String(r).replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const checkmark = isChecked ? '☑' : '☐';
            return '<li style="margin: 4px 0; padding-left: 24px; position: relative;"><span style="position: absolute; left: 0;">' + checkmark + '</span>' + escaped + '</li>';
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
            const escaped = String(d).replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const checkmark = isChecked ? '☑' : '☐';
            return '<li style="margin: 4px 0; padding-left: 24px; position: relative;"><span style="position: absolute; left: 0;">' + checkmark + '</span>' + escaped + '</li>';
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
      let responseStatus: number | null = null;
      try {
        const res = await fetch(`/api/profiles/${id}?_=${Date.now()}`, {
          cache: "no-store",
          credentials: "include",
          headers: { Accept: "application/json" },
          mode: "same-origin",
        } as RequestInit);
        responseStatus = res.status;
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
      
      // Логируем данные для диагностики
      console.log("API response:", {
        status: responseStatus,
        hasData: !!data,
        hasDataData: !!data?.data,
        profileKeys: p ? Object.keys(p) : [],
        fullResponse: data
      });
      
      if (p) {
        console.log("Profile data received:", {
          id: p.id,
          hasHtml: !!(p.html || p.raw_html || p.content || p.html_content),
          htmlValue: p.html ? String(p.html).substring(0, 100) : null,
          hasRawJson: !!p.raw_json,
          rawJsonType: typeof p.raw_json,
          rawJsonLength: p.raw_json ? (typeof p.raw_json === 'string' ? p.raw_json.length : JSON.stringify(p.raw_json).length) : 0,
          rawJsonPreview: p.raw_json ? (typeof p.raw_json === 'string' ? p.raw_json.substring(0, 100) : JSON.stringify(p.raw_json).substring(0, 100)) : null,
          hasDigits: !!p.digits,
          digitsType: typeof p.digits,
          digitsValue: p.digits
        });
      } else {
        console.warn("⚠️ Profile data is null!", { data, status: responseStatus });
      }
      
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
      
      // Проверяем raw_json более тщательно
      let hasRaw = false;
      if (p?.raw_json) {
        try {
          // raw_json может быть строкой или объектом
          let rawStr: string;
          if (typeof p.raw_json === 'string') {
            rawStr = p.raw_json.trim();
            // Если это JSON-строка, попробуем распарсить для проверки
            try {
              const parsed = JSON.parse(rawStr);
              // Если распарсилось, проверяем что это не пустой объект/массив
              if (typeof parsed === 'object' && parsed !== null) {
                hasRaw = Object.keys(parsed).length > 0 || Array.isArray(parsed) && parsed.length > 0;
              } else {
                hasRaw = rawStr.length > 2 && rawStr !== 'null' && rawStr !== 'undefined';
              }
            } catch {
              // Не JSON, просто строка - проверяем длину
              hasRaw = rawStr.length > 2;
            }
          } else {
            // Это уже объект
            rawStr = JSON.stringify(p.raw_json);
            hasRaw = rawStr.length > 2 && rawStr !== '{}' && rawStr !== '[]' && rawStr !== 'null';
          }
        } catch {
          hasRaw = false;
        }
      }
      
      // Также проверяем наличие digits (могут быть данные даже без html)
      const hasDigits = Boolean(p?.digits && (
        (Array.isArray(p.digits) && p.digits.length > 0) ||
        (typeof p.digits === 'string' && p.digits.trim().length > 0)
      ));
      
          tries += 1;
          
          // Останавливаем поллинг если:
          // 1. Есть данные для отображения
          // 2. Достигнут лимит попыток
          // 3. Получили 401 и refresh не помог (нужен перелогин)
          const isUnauthorized = responseStatus === 401 && !p;
          const shouldStop = hasRenderableHtml || hasRaw || hasDigits || tries >= maxTries || isUnauthorized;
      
      if (shouldStop) {
        setPolling(false);
        pollingRef.current = false;
        console.log("✅ Polling stopped:", { 
          hasRenderableHtml, 
          hasRaw, 
          hasDigits, 
          tries,
          profileId: p?.id,
          htmlLength: htmlCandidate ? String(htmlCandidate).length : 0
        });
      } else {
        console.log("⏳ Still polling:", { 
          hasRenderableHtml, 
          hasRaw, 
          hasDigits, 
          tries, 
          profileId: p?.id,
          maxTries,
          htmlCandidate: htmlCandidate ? String(htmlCandidate).substring(0, 50) : null
        });
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
        let errorMessage = "";
        try {
          const data = await res.json();
          a = data?.answer || data?.message || a;
          errorMessage = data?.error || "";
          
          // Если это ошибка, показываем более понятное сообщение
          if (!res.ok) {
            if (res.status === 401) {
              a = "Ошибка: Неверный API ключ OpenAI. Проверьте настройки сервера.";
            } else if (res.status === 429) {
              a = "Ошибка: Превышен лимит запросов к OpenAI API. Попробуйте позже.";
            } else if (data?.message) {
              a = `Ошибка: ${data.message}`;
            } else {
              a = `Ошибка: ${res.status} ${res.statusText}`;
            }
          }
        } catch {
          a = `Ошибка: ${res.status} ${res.statusText || "Неизвестная ошибка"}`;
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
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          // SSE формат: каждая строка "data: текст\n\n"
          const lines = chunk.split("\n");
          
          for (const line of lines) {
            if (!line.trim()) continue;
            
            // Пропускаем не-SSE строки
            if (!line.startsWith("data:")) continue;
            
            const payload = line.slice(5).trim(); // Убираем "data:"
            
            if (payload === "[DONE]") {
              break;
            }
            
            // Payload может быть JSON строкой или обычным текстом
            // Пытаемся распарсить как JSON, если не получается - используем как есть
            let textChunk = payload;
            try {
              const parsed = JSON.parse(payload);
              if (typeof parsed === 'string') {
                textChunk = parsed;
              }
            } catch {
              // Если не JSON, используем как есть (для обратной совместимости)
              textChunk = payload;
            }
            acc += textChunk;
            setAnswer(acc);
            
            // Обновляем последнее сообщение ассистента
            setChat((prev)=>{
              const next = [...prev];
              for (let i = next.length - 1; i >= 0; i--) {
                if (next[i].role === "assistant") {
                  next[i] = { role: "assistant", content: acc };
                  break;
                }
              }
              return next;
            });
            
            // Автопрокрутка чата
            if (chatBoxRef.current) {
              chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
            }
          }
        }
      } catch (streamError) {
        console.error("Stream reading error:", streamError);
        if (acc) {
          // Если уже есть текст, сохраняем его
          const finalHistory: Array<{ role: "user" | "assistant"; content: string }> = [...history, { role: "assistant" as const, content: acc }];
          setChat(finalHistory);
          await saveChatHistory(finalHistory);
        }
      }
      const finalHistory: Array<{ role: "user" | "assistant"; content: string }> = [...history, { role: "assistant" as const, content: acc }];
      await saveChatHistory(finalHistory);
    } catch (err: any) {
      console.error("Chat error:", err);
      const errorMsg = err?.message || "Ошибка чата";
      const errorHistory: Array<{ role: "user" | "assistant"; content: string }> = [...history, { role: "assistant" as const, content: `Ошибка: ${errorMsg}` }];
      setAnswer(`Ошибка: ${errorMsg}`);
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
    if (!profile?.raw_json) {
      console.log("[DEBUG] renderedFromJson: no raw_json");
      return null;
    }
    let payload: any = profile.raw_json;
    try {
      if (typeof payload === "string") payload = JSON.parse(payload);
    } catch (parseError) {
      console.warn("[DEBUG] renderedFromJson: failed to parse JSON", parseError);
      return null;
    }
    // Если payload - это объект (не массив), оборачиваем в массив
    // Но если это объект с полями целевой консультации напрямую, тоже обрабатываем
    let items: any[];
    if (Array.isArray(payload)) {
      items = payload;
    } else if (payload && typeof payload === 'object') {
      // Если это объект, проверяем - это один элемент или объект с полями целевой консультации
      // Если есть поля целевой консультации напрямую, используем как один элемент
      items = [payload];
    } else {
      items = [];
    }
    
    console.log("[DEBUG] renderedFromJson: parsed items", {
      itemsCount: items.length,
      firstItemKeys: items[0] ? Object.keys(items[0]) : [],
      hasOpener: items[0]?.opener,
      hasPersonalitySummary: items[0]?.personalitySummary,
      hasStrengths: items[0]?.strengths,
      hasWeaknesses: items[0]?.weaknesses,
      hasHappinessFormula: items[0]?.happinessFormula,
      hasCodesExplanation: items[0]?.codesExplanation,
      hasResourceSignals: items[0]?.resourceSignals,
      hasDeficitSignals: items[0]?.deficitSignals,
      hasConflicts: items[0]?.conflicts,
      hasPractices: items[0]?.practices,
      // Поля целевой консультации
      hasWarnings: Array.isArray(items[0]?.warnings),
      hasGoalDecomposition: Array.isArray(items[0]?.goalDecomposition),
      hasResourcesForStages: Array.isArray(items[0]?.resourcesForStages),
      hasCurrentDiagnostics: !!items[0]?.currentDiagnostics,
      hasPlan123: Array.isArray(items[0]?.plan123),
      hasProgressMetrics: !!items[0]?.progressMetrics,
      hasWhatIf: !!items[0]?.whatIf,
      hasObjectionHandling: Array.isArray(items[0]?.objectionHandling),
      hasFinalStrategy: Array.isArray(items[0]?.finalStrategy),
    });

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

    // Проверяем, есть ли хотя бы какие-то данные для отображения
    const hasAnyData = items.some((item: any) => {
      if (!item || typeof item !== 'object') return false;
      return !!(
        item.opener || 
        item.personalitySummary || 
        item.strengths || 
        item.strengths_text || 
        item.weaknesses || 
        item.weaknesses_text || 
        item.happinessFormula || 
        item.codesExplanation || 
        item.resourceSignals || 
        item.resourceSignals_text || 
        item.deficitSignals || 
        item.deficitSignals_text || 
        item.conflicts || 
        item.practices ||
        // Для целевых консультаций могут быть другие поля
        item.request ||
        item.answer ||
        item.recommendations ||
        item.analysis ||
        (Array.isArray(item.warnings) && item.warnings.length > 0) ||
        (Array.isArray(item.goalDecomposition) && item.goalDecomposition.length > 0) ||
        (Array.isArray(item.resourcesForStages) && item.resourcesForStages.length > 0) ||
        item.currentDiagnostics ||
        (Array.isArray(item.plan123) && item.plan123.length > 0) ||
        item.progressMetrics ||
        item.whatIf ||
        (Array.isArray(item.objectionHandling) && item.objectionHandling.length > 0) ||
        (Array.isArray(item.finalStrategy) && item.finalStrategy.length > 0) ||
        // Поля партнерской консультации
        item.compatibility ||
        item.firstParticipantCodes ||
        item.secondParticipantCodes ||
        item.partnerCodes ||
        (item.currentDiagnostics && (item.currentDiagnostics.firstParticipant || item.currentDiagnostics.secondParticipant || item.currentDiagnostics.conflictZones))
      );
    });
    
    console.log("[DEBUG] renderedFromJson: hasAnyData check", {
      hasAnyData,
      itemsLength: items.length,
      firstItemType: items[0] ? typeof items[0] : 'none'
    });
    
    if (!hasAnyData) {
      console.warn("[DEBUG] renderedFromJson: no recognizable data fields in items", {
        items,
        firstItemKeys: items[0] ? Object.keys(items[0]) : []
      });
      return null;
    }
    
    return (
      <div className="space-y-6">
        {items.map((item, idx) => {
          // Проверяем, это партнерская консультация (есть compatibility или firstParticipantCodes/secondParticipantCodes)
          const isPartnerConsultation = !!(item.compatibility || item.firstParticipantCodes || item.secondParticipantCodes || 
            (item.currentDiagnostics && (item.currentDiagnostics.firstParticipant || item.currentDiagnostics.secondParticipant)));
          
          return (
          <div key={idx} className="space-y-6">
            {/* Отображение кодов для партнерской консультации (массив кодов) */}
            {(item.firstParticipantCodes || item.secondParticipantCodes) && (
              <section className="rounded-2xl border border-blue-100 p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
                <h2 className="m-0 text-base font-bold text-gray-800 mb-4">Коды участников</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {/* Первый участник */}
                  <div className="bg-white rounded-xl p-4 border-2 border-blue-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Первый участник</h3>
                    <div className="grid grid-cols-5 gap-2">
                      {['Личность', 'Коннектор', 'Реализация', 'Генератор', 'Миссия'].map((label, i) => (
                        <div key={i} className="text-center">
                          <div className="text-xs text-gray-500 mb-1">{label}</div>
                          <div className="w-full h-12 rounded-lg bg-[#1f92aa] text-white font-bold text-lg flex items-center justify-center">
                            {Array.isArray(item.firstParticipantCodes) && item.firstParticipantCodes[i] != null ? item.firstParticipantCodes[i] : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Второй участник */}
                  <div className="bg-white rounded-xl p-4 border-2 border-indigo-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Второй участник</h3>
                    <div className="grid grid-cols-5 gap-2">
                      {['Личность', 'Коннектор', 'Реализация', 'Генератор', 'Миссия'].map((label, i) => (
                        <div key={i} className="text-center">
                          <div className="text-xs text-gray-500 mb-1">{label}</div>
                          <div className="w-full h-12 rounded-lg bg-[#1f92aa] text-white font-bold text-lg flex items-center justify-center">
                            {Array.isArray(item.secondParticipantCodes) && item.secondParticipantCodes[i] != null ? item.secondParticipantCodes[i] : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
            {/* Коды партнеров в двух колонках (для партнерской консультации) */}
            {item.partnerCodes && (
              <section className="rounded-2xl border border-blue-100 p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
                <h2 className="m-0 text-base font-bold text-gray-800 mb-4">Коды САЛ партнеров</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {/* Первый партнер */}
                  <div className="bg-white rounded-xl p-4 border-2 border-blue-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Первый партнер</h3>
                    <div className="grid grid-cols-5 gap-2">
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Личность</div>
                        <div className="w-full h-12 rounded-lg bg-[#1f92aa] text-white font-bold text-lg flex items-center justify-center">
                          {item.partnerCodes.first?.personality || '—'}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Коннектор</div>
                        <div className="w-full h-12 rounded-lg bg-[#1f92aa] text-white font-bold text-lg flex items-center justify-center">
                          {item.partnerCodes.first?.connector || '—'}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Реализация</div>
                        <div className="w-full h-12 rounded-lg bg-[#1f92aa] text-white font-bold text-lg flex items-center justify-center">
                          {item.partnerCodes.first?.realization || '—'}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Генератор</div>
                        <div className="w-full h-12 rounded-lg bg-[#1f92aa] text-white font-bold text-lg flex items-center justify-center">
                          {item.partnerCodes.first?.generator || '—'}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Миссия</div>
                        <div className="w-full h-12 rounded-lg bg-[#1f92aa] text-white font-bold text-lg flex items-center justify-center">
                          {item.partnerCodes.first?.mission || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Второй партнер */}
                  <div className="bg-white rounded-xl p-4 border-2 border-indigo-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Второй партнер</h3>
                    <div className="grid grid-cols-5 gap-2">
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Личность</div>
                        <div className="w-full h-12 rounded-lg bg-[#1f92aa] text-white font-bold text-lg flex items-center justify-center">
                          {item.partnerCodes.second?.personality || '—'}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Коннектор</div>
                        <div className="w-full h-12 rounded-lg bg-[#1f92aa] text-white font-bold text-lg flex items-center justify-center">
                          {item.partnerCodes.second?.connector || '—'}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Реализация</div>
                        <div className="w-full h-12 rounded-lg bg-[#1f92aa] text-white font-bold text-lg flex items-center justify-center">
                          {item.partnerCodes.second?.realization || '—'}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Генератор</div>
                        <div className="w-full h-12 rounded-lg bg-[#1f92aa] text-white font-bold text-lg flex items-center justify-center">
                          {item.partnerCodes.second?.generator || '—'}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Миссия</div>
                        <div className="w-full h-12 rounded-lg bg-[#1f92aa] text-white font-bold text-lg flex items-center justify-center">
                          {item.partnerCodes.second?.mission || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}
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

            {/* Поля для целевой консультации */}
            {(item.request || item.answer || item.recommendations || item.analysis) && (
              <section className="space-y-6">
                {item.request && (
                  <article className="rounded-2xl border border-blue-100 p-6">
                    <h2 className="m-0 text-sm font-bold uppercase tracking-wide text-gray-600 mb-3">Запрос клиента</h2>
                    <p className="whitespace-pre-wrap leading-relaxed text-gray-800">{item.request}</p>
                  </article>
                )}
                {item.analysis && (
                  <article className="rounded-2xl border border-blue-100 p-6">
                    <h2 className="m-0 text-sm font-bold uppercase tracking-wide text-gray-600 mb-3">Анализ</h2>
                    {typeof item.analysis === 'string' ? (
                      <p className="whitespace-pre-wrap leading-relaxed text-gray-800">{item.analysis}</p>
                    ) : Array.isArray(item.analysis) ? (
                      <div className="space-y-2">
                        {item.analysis.map((t: string, i: number) => (
                          <p key={i} className="whitespace-pre-wrap leading-relaxed text-gray-800">{t}</p>
                        ))}
                      </div>
                    ) : null}
                  </article>
                )}
                {item.answer && (
                  <article className="rounded-2xl border border-blue-100 p-6">
                    <h2 className="m-0 text-sm font-bold uppercase tracking-wide text-gray-600 mb-3">Ответ</h2>
                    {typeof item.answer === 'string' ? (
                      <p className="whitespace-pre-wrap leading-relaxed text-gray-800">{item.answer}</p>
                    ) : Array.isArray(item.answer) ? (
                      <div className="space-y-2">
                        {item.answer.map((t: string, i: number) => (
                          <p key={i} className="whitespace-pre-wrap leading-relaxed text-gray-800">{t}</p>
                        ))}
                      </div>
                    ) : null}
                  </article>
                )}
                {item.recommendations && (
                  <article className="rounded-2xl border border-blue-100 p-6">
                    <h2 className="m-0 text-sm font-bold uppercase tracking-wide text-gray-600 mb-3">Рекомендации</h2>
                    {Array.isArray(item.recommendations) ? (
                      <ul className="list-disc list-inside space-y-2">
                        {item.recommendations.map((r: string, i: number) => (
                          <li key={i} className="leading-relaxed text-gray-800">{r}</li>
                        ))}
                      </ul>
                    ) : typeof item.recommendations === 'string' ? (
                      <p className="whitespace-pre-wrap leading-relaxed text-gray-800">{item.recommendations}</p>
                    ) : null}
                  </article>
                )}
              </section>
            )}

            {/* Предупреждения */}
            {Array.isArray(item.warnings) && item.warnings.length > 0 && (
              <article className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6">
                <h2 className="m-0 text-base font-bold text-amber-900 mb-3">⚠️ Предупреждения</h2>
                <ul className="space-y-2">
                  {item.warnings.map((w: string, i: number) => (
                    <li key={i} className="text-amber-800 leading-relaxed">• {w}</li>
                  ))}
                </ul>
              </article>
            )}

            {/* Декомпозиция целей */}
            {Array.isArray(item.goalDecomposition) && item.goalDecomposition.length > 0 && (
              <article className="rounded-2xl border border-blue-100 p-6">
                <h2 className="m-0 text-base font-bold text-gray-800 mb-3">🎯 Декомпозиция целей</h2>
                <ol className="space-y-3 list-decimal list-inside">
                  {item.goalDecomposition.map((goal: string, i: number) => (
                    <li key={i} className="text-gray-700 leading-relaxed">{goal}</li>
                  ))}
                </ol>
              </article>
            )}

            {/* Ресурсы по этапам */}
            {Array.isArray(item.resourcesForStages) && item.resourcesForStages.length > 0 && (
              <AccordionSection title="Ресурсы по этапам">
                <div className="space-y-6">
                  {item.resourcesForStages.map((stage: any, stageIdx: number) => (
                    <div key={stageIdx} className="rounded-xl border border-blue-100 p-5">
                      <h3 className="text-lg font-semibold mb-4">Этап {stage.stage}</h3>
                      <div className="space-y-4">
                        {Array.isArray(stage.resources) && stage.resources.map((res: any, resIdx: number) => (
                          <div key={resIdx} className="bg-gray-50 rounded-lg p-4">
                            <div className="font-semibold text-gray-800 mb-2">{res.resource}</div>
                            {res.why && <p className="text-sm text-gray-600 mb-2">{res.why}</p>}
                            {Array.isArray(res.successSignals) && res.successSignals.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Признаки успеха:</div>
                                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                                  {res.successSignals.map((signal: string, sigIdx: number) => (
                                    <li key={sigIdx}>{signal}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionSection>
            )}

            {/* Текущая диагностика */}
            {item.currentDiagnostics && (
              <AccordionSection title="Текущая диагностика">
                <div className="space-y-6">
                  {Array.isArray(item.currentDiagnostics.resourceStates) && item.currentDiagnostics.resourceStates.length > 0 && (
                    <div>
                      <h3 className="text-base font-semibold mb-3">Состояние ресурсов</h3>
                      <div className="space-y-3">
                        {item.currentDiagnostics.resourceStates.map((state: any, i: number) => (
                          <div key={i} className={`rounded-lg p-4 border-2 ${
                            state.state === 'plus' ? 'border-green-200 bg-green-50' :
                            state.state === 'minus' ? 'border-red-200 bg-red-50' :
                            'border-gray-200 bg-gray-50'
                          }`}>
                            <div className="font-semibold mb-2">
                              {state.resource}
                              {state.partner && (
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                  ({state.partner === 'first' ? 'Первый партнер' : 'Второй партнер'})
                                </span>
                              )}
                            </div>
                            {Array.isArray(state.evidence) && state.evidence.length > 0 && (
                              <div className="mb-2">
                                <div className="text-xs font-semibold text-gray-600 mb-1">Доказательства:</div>
                                <ul className="list-disc list-inside text-sm text-gray-700">
                                  {state.evidence.map((e: string, j: number) => (
                                    <li key={j}>{e}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {Array.isArray(state.correction) && state.correction.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-gray-600 mb-1">Коррекция:</div>
                                <ul className="list-disc list-inside text-sm text-gray-700">
                                  {state.correction.map((c: string, j: number) => (
                                    <li key={j}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.currentDiagnostics.readiness && (
                    <div className="rounded-lg border border-blue-100 p-4">
                      <h3 className="text-base font-semibold mb-2">Готовность</h3>
                      <div className="mb-2">
                        <span className="text-sm text-gray-600">Желание: </span>
                        <span className="font-semibold">{item.currentDiagnostics.readiness.willingness}/10</span>
                      </div>
                      {Array.isArray(item.currentDiagnostics.readiness.blockers) && item.currentDiagnostics.readiness.blockers.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs font-semibold text-gray-600 mb-1">Блокеры:</div>
                          <ul className="list-disc list-inside text-sm text-gray-700">
                            {item.currentDiagnostics.readiness.blockers.map((b: string, i: number) => (
                              <li key={i}>{b}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {item.currentDiagnostics.readiness.comment && (
                        <p className="text-sm text-gray-700 mt-2">{item.currentDiagnostics.readiness.comment}</p>
                      )}
                    </div>
                  )}
                  {Array.isArray(item.currentDiagnostics.questions) && item.currentDiagnostics.questions.length > 0 && (
                    <div>
                      <h3 className="text-base font-semibold mb-3">Вопросы для уточнения</h3>
                      <div className="space-y-3">
                        {item.currentDiagnostics.questions.map((q: any, i: number) => (
                          <div key={i} className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                            <p className="text-gray-800 mb-1">{q.question}</p>
                            {q.salResource && (
                              <span className="text-xs text-gray-500">Ресурс: {q.salResource}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionSection>
            )}

            {/* План по этапам */}
            {Array.isArray(item.plan123) && item.plan123.length > 0 && (
              <AccordionSection title="План действий">
                <div className="space-y-6">
                  {item.plan123.map((plan: any, i: number) => (
                    <div key={i} className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-5">
                      <h3 className="text-lg font-semibold mb-4">{plan.stageTitle}</h3>
                      {Array.isArray(plan.actions) && plan.actions.length > 0 && (
                        <div className="mb-4">
                          <div className="text-sm font-semibold text-gray-700 mb-2">Действия:</div>
                          <ul className="list-disc list-inside space-y-1 text-gray-700">
                            {plan.actions.map((action: string, j: number) => (
                              <li key={j}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(plan.resources) && plan.resources.length > 0 && (
                        <div className="mb-4">
                          <div className="text-sm font-semibold text-gray-700 mb-2">Ресурсы:</div>
                          <div className="flex flex-wrap gap-2">
                            {plan.resources.map((res: any, j: number) => {
                              const partnerLabel = res.partner === 'first' ? ' (1-й)' : res.partner === 'second' ? ' (2-й)' : '';
                              return (
                                <span key={j} className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                                  {res.resource} {res.code}{partnerLabel}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {plan.successCriteria && (
                        <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="text-sm font-semibold text-green-800 mb-1">Критерий успеха:</div>
                          <p className="text-sm text-green-700">{plan.successCriteria}</p>
                        </div>
                      )}
                      {plan.riskNotes && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="text-sm font-semibold text-amber-800 mb-1">⚠️ Риски:</div>
                          <p className="text-sm text-amber-700">{plan.riskNotes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionSection>
            )}

            {/* Метрики прогресса */}
            {item.progressMetrics && (
              <AccordionSection title="Метрики прогресса">
                <div className="space-y-4">
                  {Array.isArray(item.progressMetrics.earlySignals) && item.progressMetrics.earlySignals.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Ранние сигналы</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                        {item.progressMetrics.earlySignals.map((s: string, i: number) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(item.progressMetrics.midSignals) && item.progressMetrics.midSignals.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Средние сигналы</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                        {item.progressMetrics.midSignals.map((s: string, i: number) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(item.progressMetrics.resultSignals) && item.progressMetrics.resultSignals.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Итоговые сигналы</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                        {item.progressMetrics.resultSignals.map((s: string, i: number) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AccordionSection>
            )}

            {/* Что делать в разных ситуациях */}
            {item.whatIf && (
              <AccordionSection title="Что делать в разных ситуациях">
                <div className="space-y-4">
                  {Array.isArray(item.whatIf.fatigue) && item.whatIf.fatigue.length > 0 && (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                      <h3 className="text-sm font-semibold text-orange-900 mb-2">Усталость</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-orange-800">
                        {item.whatIf.fatigue.map((f: string, i: number) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(item.whatIf.overwhelm) && item.whatIf.overwhelm.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <h3 className="text-sm font-semibold text-red-900 mb-2">Перегрузка</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                        {item.whatIf.overwhelm.map((o: string, i: number) => (
                          <li key={i}>{o}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {/* Конфликты (для партнерской консультации) */}
                  {Array.isArray(item.whatIf.conflicts) && item.whatIf.conflicts.length > 0 && (
                    <div className="rounded-lg border border-pink-200 bg-pink-50 p-4">
                      <h3 className="text-sm font-semibold text-pink-900 mb-2">Конфликты</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-pink-800">
                        {item.whatIf.conflicts.map((c: string, i: number) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(item.whatIf.relapse) && item.whatIf.relapse.length > 0 && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                      <h3 className="text-sm font-semibold text-purple-900 mb-2">Рецидив</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-purple-800">
                        {item.whatIf.relapse.map((r: string, i: number) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(item.whatIf.pitfalls) && item.whatIf.pitfalls.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <h3 className="text-sm font-semibold text-amber-900 mb-2">Ловушки</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
                        {item.whatIf.pitfalls.map((p: string, i: number) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AccordionSection>
            )}

            {/* Обработка возражений */}
            {Array.isArray(item.objectionHandling) && item.objectionHandling.length > 0 && (
              <AccordionSection title="Обработка возражений">
                <div className="space-y-4">
                  {item.objectionHandling.map((obj: any, i: number) => (
                    <div key={i} className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                      <div className="font-semibold text-gray-800 mb-2">&ldquo;{obj.objection}&rdquo;</div>
                      <p className="text-sm text-gray-700">{obj.reply}</p>
                    </div>
                  ))}
                </div>
              </AccordionSection>
            )}

            {/* Финальная стратегия */}
            {Array.isArray(item.finalStrategy) && item.finalStrategy.length > 0 && (
              <article className="rounded-2xl border-2 border-green-200 bg-green-50 p-6">
                <h2 className="m-0 text-base font-bold text-green-900 mb-3">✅ Финальная стратегия</h2>
                <div className="space-y-3">
                  {item.finalStrategy.map((strategy: string, i: number) => (
                    <p key={i} className="text-green-800 leading-relaxed">{strategy}</p>
                  ))}
                </div>
              </article>
            )}

            {/* Совместимость ресурсов (для партнерской консультации) */}
            {item.compatibility && (
              <AccordionSection title="Совместимость ресурсов">
                <div className="space-y-6">
                  {Array.isArray(item.compatibility.complementary) && item.compatibility.complementary.length > 0 && (
                    <div>
                      <h3 className="text-base font-semibold text-green-800 mb-3">✅ Дополняющие ресурсы</h3>
                      <div className="space-y-3">
                        {item.compatibility.complementary.map((comp: any, i: number) => (
                          <div key={i} className="rounded-lg border border-green-200 bg-green-50 p-4">
                            <div className="font-semibold text-gray-800 mb-2">
                              {comp.firstResource} ↔ {comp.secondResource}
                            </div>
                            <p className="text-sm text-gray-700">{comp.why}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {Array.isArray(item.compatibility.conflicts) && item.compatibility.conflicts.length > 0 && (
                    <div>
                      <h3 className="text-base font-semibold text-red-800 mb-3">⚠️ Конфликтующие ресурсы</h3>
                      <div className="space-y-3">
                        {item.compatibility.conflicts.map((conf: any, i: number) => (
                          <div key={i} className="rounded-lg border border-red-200 bg-red-50 p-4">
                            <div className="font-semibold text-gray-800 mb-2">
                              {conf.firstResource} ↔ {conf.secondResource}
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{conf.why}</p>
                            {conf.solution && (
                              <div className="mt-2 pt-2 border-t border-red-300">
                                <div className="text-xs font-semibold text-red-800 mb-1">Решение:</div>
                                <p className="text-sm text-red-700">{conf.solution}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionSection>
            )}

            {/* Зоны конфликтов (для партнерской консультации) */}
            {Array.isArray(item.currentDiagnostics?.conflictZones) && item.currentDiagnostics.conflictZones.length > 0 && (
              <AccordionSection title="Зоны конфликтов">
                <div className="space-y-4">
                  {item.currentDiagnostics.conflictZones.map((zone: any, i: number) => (
                    <div key={i} className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
                      <h3 className="text-base font-semibold text-amber-900 mb-3">{zone.zone}</h3>
                      <p className="text-sm text-gray-700 mb-3">{zone.description}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div className="bg-white rounded p-3 border border-amber-200">
                          <div className="text-xs font-semibold text-gray-600 mb-1">Первый участник:</div>
                          <p className="text-sm text-gray-800">{zone.firstParticipantRole}</p>
                        </div>
                        <div className="bg-white rounded p-3 border border-amber-200">
                          <div className="text-xs font-semibold text-gray-600 mb-1">Второй участник:</div>
                          <p className="text-sm text-gray-800">{zone.secondParticipantRole}</p>
                        </div>
                      </div>
                      {zone.solution && (
                        <div className="mt-3 pt-3 border-t border-amber-300">
                          <div className="text-xs font-semibold text-amber-800 mb-1">Решение:</div>
                          <p className="text-sm text-amber-700">{zone.solution}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionSection>
            )}

            {/* Диагностика для партнерской консультации (с разделением по участникам) */}
            {isPartnerConsultation && item.currentDiagnostics && (
              <AccordionSection title="Диагностика участников">
                <div className="space-y-6">
                  {/* Первый участник */}
                  {item.currentDiagnostics.firstParticipant && Array.isArray(item.currentDiagnostics.firstParticipant.resourceStates) && (
                    <div>
                      <h3 className="text-base font-semibold text-gray-800 mb-3">Первый участник</h3>
                      <div className="space-y-3">
                        {item.currentDiagnostics.firstParticipant.resourceStates.map((state: any, i: number) => (
                          <div key={i} className={`rounded-lg p-4 border-2 ${
                            state.state === 'plus' ? 'border-green-200 bg-green-50' :
                            state.state === 'minus' ? 'border-red-200 bg-red-50' :
                            'border-gray-200 bg-gray-50'
                          }`}>
                            <div className="font-semibold mb-2">{state.resource}</div>
                            {Array.isArray(state.evidence) && state.evidence.length > 0 && (
                              <div className="mb-2">
                                <div className="text-xs font-semibold text-gray-600 mb-1">Доказательства:</div>
                                <ul className="list-disc list-inside text-sm text-gray-700">
                                  {state.evidence.map((e: string, j: number) => (
                                    <li key={j}>{e}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {Array.isArray(state.correction) && state.correction.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-gray-600 mb-1">Коррекция:</div>
                                <ul className="list-disc list-inside text-sm text-gray-700">
                                  {state.correction.map((c: string, j: number) => (
                                    <li key={j}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Второй участник */}
                  {item.currentDiagnostics.secondParticipant && Array.isArray(item.currentDiagnostics.secondParticipant.resourceStates) && (
                    <div>
                      <h3 className="text-base font-semibold text-gray-800 mb-3">Второй участник</h3>
                      <div className="space-y-3">
                        {item.currentDiagnostics.secondParticipant.resourceStates.map((state: any, i: number) => (
                          <div key={i} className={`rounded-lg p-4 border-2 ${
                            state.state === 'plus' ? 'border-green-200 bg-green-50' :
                            state.state === 'minus' ? 'border-red-200 bg-red-50' :
                            'border-gray-200 bg-gray-50'
                          }`}>
                            <div className="font-semibold mb-2">{state.resource}</div>
                            {Array.isArray(state.evidence) && state.evidence.length > 0 && (
                              <div className="mb-2">
                                <div className="text-xs font-semibold text-gray-600 mb-1">Доказательства:</div>
                                <ul className="list-disc list-inside text-sm text-gray-700">
                                  {state.evidence.map((e: string, j: number) => (
                                    <li key={j}>{e}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {Array.isArray(state.correction) && state.correction.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-gray-600 mb-1">Коррекция:</div>
                                <ul className="list-disc list-inside text-sm text-gray-700">
                                  {state.correction.map((c: string, j: number) => (
                                    <li key={j}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionSection>
            )}

            {/* Обновленная диагностика для партнерской консультации (если есть вопросы с указанием участника) */}
            {isPartnerConsultation && Array.isArray(item.currentDiagnostics?.questions) && item.currentDiagnostics.questions.length > 0 && (
              <div>
                <h3 className="text-base font-semibold mb-3">Вопросы для уточнения</h3>
                <div className="space-y-3">
                  {item.currentDiagnostics.questions.map((q: any, i: number) => (
                    <div key={i} className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <p className="text-gray-800 mb-1">{q.question}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {q.salResource && (
                          <span className="text-xs text-gray-500">Ресурс: {q.salResource}</span>
                        )}
                        {q.participant && (
                          <span className="text-xs text-gray-500">
                            {q.participant === 'first' ? 'Первый участник' : 
                             q.participant === 'second' ? 'Второй участник' : 
                             'Оба участника'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Обновленные ресурсы по этапам для партнерской консультации (с указанием участника) */}
            {isPartnerConsultation && Array.isArray(item.resourcesForStages) && item.resourcesForStages.length > 0 && (
              <AccordionSection title="Ресурсы по этапам">
                <div className="space-y-6">
                  {item.resourcesForStages.map((stage: any, stageIdx: number) => (
                    <div key={stageIdx} className="rounded-xl border border-blue-100 p-5">
                      <h3 className="text-lg font-semibold mb-4">Этап {stage.stage}</h3>
                      <div className="space-y-4">
                        {Array.isArray(stage.resources) && stage.resources.map((res: any, resIdx: number) => (
                          <div key={resIdx} className="bg-gray-50 rounded-lg p-4">
                            <div className="font-semibold text-gray-800 mb-2">
                              {res.resource} 
                              {res.participant && (
                                <span className="text-sm font-normal text-gray-600 ml-2">
                                  ({res.participant === 'first' ? 'Первый участник' : 'Второй участник'})
                                </span>
                              )}
                            </div>
                            {res.why && <p className="text-sm text-gray-600 mb-2">{res.why}</p>}
                            {Array.isArray(res.successSignals) && res.successSignals.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Признаки успеха:</div>
                                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                                  {res.successSignals.map((signal: string, sigIdx: number) => (
                                    <li key={sigIdx}>{signal}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionSection>
            )}

            {/* Обновленный план для партнерской консультации (с указанием участника) */}
            {isPartnerConsultation && Array.isArray(item.plan123) && item.plan123.length > 0 && (
              <AccordionSection title="План действий">
                <div className="space-y-6">
                  {item.plan123.map((plan: any, i: number) => (
                    <div key={i} className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-5">
                      <h3 className="text-lg font-semibold mb-4">{plan.stageTitle}</h3>
                      {Array.isArray(plan.actions) && plan.actions.length > 0 && (
                        <div className="mb-4">
                          <div className="text-sm font-semibold text-gray-700 mb-2">Действия:</div>
                          <ul className="list-disc list-inside space-y-1 text-gray-700">
                            {plan.actions.map((action: string, j: number) => (
                              <li key={j}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(plan.resources) && plan.resources.length > 0 && (
                        <div className="mb-4">
                          <div className="text-sm font-semibold text-gray-700 mb-2">Ресурсы:</div>
                          <div className="flex flex-wrap gap-2">
                            {plan.resources.map((res: any, j: number) => (
                              <span key={j} className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                                {res.resource}
                                {res.participant && (
                                  <span className="ml-1 text-xs">
                                    ({res.participant === 'first' ? '1' : '2'})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {plan.successCriteria && (
                        <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="text-sm font-semibold text-green-800 mb-1">Критерий успеха:</div>
                          <p className="text-sm text-green-700">{plan.successCriteria}</p>
                        </div>
                      )}
                      {plan.riskNotes && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="text-sm font-semibold text-amber-800 mb-1">⚠️ Риски:</div>
                          <p className="text-sm text-amber-700">{plan.riskNotes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionSection>
            )}

            {/* Обновленный whatIf для партнерской консультации (с полем conflicts) */}
            {isPartnerConsultation && item.whatIf && (
              <AccordionSection title="Что делать в разных ситуациях">
                <div className="space-y-4">
                  {Array.isArray(item.whatIf.fatigue) && item.whatIf.fatigue.length > 0 && (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                      <h3 className="text-sm font-semibold text-orange-900 mb-2">Усталость</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-orange-800">
                        {item.whatIf.fatigue.map((f: string, i: number) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(item.whatIf.overwhelm) && item.whatIf.overwhelm.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <h3 className="text-sm font-semibold text-red-900 mb-2">Перегрузка</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                        {item.whatIf.overwhelm.map((o: string, i: number) => (
                          <li key={i}>{o}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(item.whatIf.conflicts) && item.whatIf.conflicts.length > 0 && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                      <h3 className="text-sm font-semibold text-purple-900 mb-2">Конфликты</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-purple-800">
                        {item.whatIf.conflicts.map((c: string, i: number) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(item.whatIf.relapse) && item.whatIf.relapse.length > 0 && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                      <h3 className="text-sm font-semibold text-purple-900 mb-2">Рецидив</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-purple-800">
                        {item.whatIf.relapse.map((r: string, i: number) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(item.whatIf.pitfalls) && item.whatIf.pitfalls.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <h3 className="text-sm font-semibold text-amber-900 mb-2">Ловушки</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
                        {item.whatIf.pitfalls.map((p: string, i: number) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
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
          );
        })}
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
          
          // Если это обработанное изображение из коллекции images (с полями id и code)
          if (typeof img === 'object' && img.code) {
            // Используем code для получения изображения
            // Если code - это ID файла, используем /api/files/{code}
            if (/^\d+$/.test(String(img.code))) {
              return `/api/files/${img.code}`;
            }
            // Иначе code может быть URL или другим идентификатором
            return img.code;
          }
          
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
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

      {/* Сообщение о необходимости перелогиниться */}
      {!polling && !profile && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center gap-3 text-red-800">
            <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <div className="font-semibold">Сессия истекла</div>
              <div className="text-sm mt-1">Пожалуйста, перелогиньтесь для продолжения работы.</div>
              <a href="/login" className="text-sm underline mt-2 inline-block">Перейти на страницу входа</a>
            </div>
          </div>
        </div>
      )}

      {(() => {
        // Сначала проверяем HTML
        const html = (profile as any)?.html || (profile as any)?.raw_html || (profile as any)?.content || (profile as any)?.html_content;
        if (html && String(html).trim().length > 0) {
          return (
            <AccordionSection title="Готовый расчёт (HTML)">
              <div className="card" dangerouslySetInnerHTML={{ __html: String(html) }} />
            </AccordionSection>
          );
        }
        
        // Затем проверяем raw_json
        if (renderedFromJson) {
          return renderedFromJson;
        }
        
        // Если есть raw_json, но renderedFromJson вернул null, показываем отладочную информацию
        if (profile?.raw_json && !polling) {
          console.warn("[DEBUG] raw_json exists but renderedFromJson is null:", {
            rawJsonType: typeof profile.raw_json,
            rawJsonKeys: typeof profile.raw_json === 'object' && profile.raw_json !== null ? Object.keys(profile.raw_json) : [],
            rawJsonPreview: typeof profile.raw_json === 'string' 
              ? profile.raw_json.substring(0, 200) 
              : JSON.stringify(profile.raw_json).substring(0, 200)
          });
          
          // Пытаемся отобразить raw_json в сыром виде для отладки
          return (
            <div className="card">
              <div className="text-sm font-semibold mb-2">Данные из raw_json (отладка):</div>
              <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-96">
                {typeof profile.raw_json === 'string' 
                  ? profile.raw_json 
                  : JSON.stringify(profile.raw_json, null, 2)}
              </pre>
            </div>
          );
        }
        
        return !polling ? (
          <div className="card text-sm text-gray-600">Нет данных для отображения.</div>
        ) : null;
      })()}

      <div className="card space-y-4">
        <div className="font-medium">Задать вопрос по профилю</div>
        <div className="space-y-3">
          <div ref={chatBoxRef} className="rounded-xl border p-3 bg-white max-h-96 overflow-y-auto break-words">
            {chat.length === 0 && <div className="text-sm text-gray-500">Начните диалог — задайте вопрос ниже</div>}
            {chat.map((m, i) => (
              <div key={i} className={`mb-3 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block rounded-2xl px-4 py-3 max-w-[85%] ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Заголовки
                          h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0" {...props} />,
                          // Параграфы
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                          // Списки
                          ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1 ml-2" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1 ml-2" {...props} />,
                          li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                          // Ссылки
                          a: ({node, ...props}) => <a className="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer" {...props} />,
                          // Код
                          code: ({node, inline, ...props}: any) => 
                            inline ? (
                              <code className="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
                            ) : (
                              <code className="block bg-gray-200 text-gray-800 p-2 rounded text-xs font-mono overflow-x-auto mb-2" {...props} />
                            ),
                          pre: ({node, ...props}) => <pre className="bg-gray-200 p-2 rounded overflow-x-auto mb-2" {...props} />,
                          // Таблицы
                          table: ({node, ...props}) => (
                            <div className="overflow-x-auto my-2">
                              <table className="min-w-full border-collapse border border-gray-300" {...props} />
                            </div>
                          ),
                          thead: ({node, ...props}) => <thead className="bg-gray-200" {...props} />,
                          tbody: ({node, ...props}) => <tbody {...props} />,
                          tr: ({node, ...props}) => <tr className="border-b border-gray-300" {...props} />,
                          th: ({node, ...props}) => <th className="border border-gray-300 px-2 py-1 text-left font-semibold" {...props} />,
                          td: ({node, ...props}) => <td className="border border-gray-300 px-2 py-1" {...props} />,
                          // Выделение
                          strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                          em: ({node, ...props}) => <em className="italic" {...props} />,
                          // Горизонтальная линия
                          hr: ({node, ...props}) => <hr className="my-3 border-gray-300" {...props} />,
                          // Блоки цитат
                          blockquote: ({node, ...props}) => (
                            <blockquote className="border-l-4 border-gray-400 pl-3 italic my-2 text-gray-700" {...props} />
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  )}
                  {loading && i === chat.length - 1 && m.role === 'assistant' && (
                    <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse">▋</span>
                  )}
                </div>
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
