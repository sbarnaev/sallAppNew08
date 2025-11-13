import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchProfileContext(profileId: number, token: string, baseUrl: string) {
  const url = `${baseUrl}/items/profiles/${profileId}?fields=id,client_id,created_at,html,raw_json,digits,notes`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" });
  if (!r.ok) return {} as any;
  const j = await r.json().catch(()=>({}));
  return j?.data || {};
}

export async function POST(req: Request) {
  const token = cookies().get("directus_access_token")?.value;
  const directusUrl = getDirectusUrl();
  const openaiKey = process.env.OPENAI_API_KEY;

  const body = await req.json().catch(()=>({}));
  const { profileId, question, history } = body || {};
  const streamParam = new URL(req.url).searchParams.get("stream");
  const wantStream = streamParam === "1" || Boolean(body?.stream);

  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!question || typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ message: "Вопрос пустой" }, { status: 400 });
  }
  
  console.log("QA request:", {
    hasOpenAIKey: !!openaiKey,
    wantStream,
    profileId,
    questionLength: question?.length
  });

  // If OpenAI key provided, answer via OpenAI. Otherwise fallback to n8n as раньше
  if (openaiKey) {
    try {
      const ctx = profileId && directusUrl ? await fetchProfileContext(Number(profileId), token, directusUrl) : {};

      const system: ChatMessage = {
        role: "system",
        content:
          "Ты профессиональный консультант. Отвечай по-русски, четко и структурированно. " +
          "Используй Markdown для форматирования: **жирный текст**, *курсив*, списки (- или 1.), заголовки (##), разделители (---). " +
          "Всегда ставь пробелы после знаков препинания. Разбивай длинные предложения на абзацы. " +
          "Используй контекст профиля, если он есть. Если данных нет — отвечай общими рекомендациями и уточняющими вопросами.",
      };

      // Сжимаем контекст
      const contextPieces: string[] = [];
      if (ctx?.digits) contextPieces.push(`Коды: ${typeof ctx.digits === "string" ? ctx.digits : JSON.stringify(ctx.digits)}`);
      if (ctx?.html) contextPieces.push(String(ctx.html).slice(0, 6000));
      if (ctx?.raw_json) contextPieces.push(
        typeof ctx.raw_json === "string" ? ctx.raw_json.slice(0, 6000) : JSON.stringify(ctx.raw_json).slice(0, 6000)
      );
      if (ctx?.notes) contextPieces.push(`Заметки: ${String(ctx.notes).slice(0, 2000)}`);

      const contextBlock = contextPieces.length ? `Контекст профиля:\n${contextPieces.join("\n---\n")}` : "";

      const messages: ChatMessage[] = [system];
      if (Array.isArray(history)) {
        for (const m of history.slice(-10)) {
          if (m?.role === "user" || m?.role === "assistant") messages.push({ role: m.role, content: String(m.content) });
        }
      }
      messages.push({ role: "user", content: `${contextBlock}\n\nВопрос: ${String(question || "").trim()}`.trim() });

      // Streaming branch
      if (wantStream) {
        console.log("[DEBUG] Starting OpenAI streaming request", {
          model: "gpt-4o-mini",
          messagesCount: messages.length,
          hasOpenAIKey: !!openaiKey,
          openAIKeyLength: openaiKey?.length || 0,
          openAIKeyPreview: openaiKey ? `${openaiKey.substring(0, 10)}...${openaiKey.substring(openaiKey.length - 4)}` : 'null'
        });
        
        let r: Response;
        try {
          r = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages,
              temperature: 0.7,
              max_tokens: 1500,
              stream: true,
              // Убеждаемся, что модель возвращает правильно отформатированный текст
              presence_penalty: 0.1,
              frequency_penalty: 0.1,
            }),
          });
        } catch (fetchError: any) {
          console.error("[DEBUG] OpenAI fetch error:", {
            message: fetchError?.message,
            code: fetchError?.code,
            cause: fetchError?.cause
          });
          return NextResponse.json({ 
            message: "Ошибка подключения к OpenAI API", 
            error: fetchError?.message || String(fetchError),
            code: fetchError?.code
          }, { status: 502 });
        }
        
        if (!r.ok) {
          const errorText = await r.text().catch(() => '');
          let errorData: any = {};
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { raw: errorText.substring(0, 200) };
          }
          
          console.error("[DEBUG] OpenAI API error:", {
            status: r.status,
            statusText: r.statusText,
            error: errorData,
            errorText: errorText.substring(0, 500)
          });
          
          // Более понятные сообщения об ошибках
          let errorMessage = "Ошибка OpenAI API";
          if (r.status === 401) {
            errorMessage = "Неверный API ключ OpenAI. Проверьте переменную окружения OPENAI_API_KEY";
          } else if (r.status === 429) {
            errorMessage = "Превышен лимит запросов к OpenAI API. Попробуйте позже";
          } else if (r.status === 500 || r.status === 502 || r.status === 503) {
            errorMessage = "Сервис OpenAI временно недоступен. Попробуйте позже";
          } else if (errorData?.error?.message) {
            errorMessage = errorData.error.message;
          }
          
          return NextResponse.json({ 
            message: errorMessage,
            error: errorData?.error?.message || errorData?.error?.type || String(r.status),
            status: r.status,
            details: errorData
          }, { status: r.status });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = r.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) {
              controller.close();
              return;
            }
            try {
              let buffer = "";
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                // Обрабатываем строки по отдельности
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // Оставляем неполную строку в буфере
                
                for (const line of lines) {
                  if (!line.trim()) continue;
                  // OpenAI SSE формат: "data: {...}" или "data: [DONE]"
                  if (!line.startsWith("data:")) continue;
                  
                  const payload = line.slice(5).trim(); // Убираем "data:"
                  if (payload === "[DONE]") {
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    continue;
                  }
                  
                  try {
                    const json = JSON.parse(payload);
                    const delta = json?.choices?.[0]?.delta?.content;
                    if (delta && typeof delta === 'string') {
                      // Отправляем delta напрямую как текст
                      // SSE формат: "data: текст\n\n"
                      // Заменяем переносы строк на \n для правильной передачи
                      const text = delta;
                      controller.enqueue(encoder.encode(`data: ${text}\n\n`));
                    }
                  } catch (e) {
                    // Игнорируем ошибки парсинга
                    console.warn("[DEBUG] Failed to parse SSE chunk:", e);
                  }
                }
              }
              // Обрабатываем остаток буфера
              if (buffer.trim()) {
                const line = buffer.trim();
                if (line.startsWith("data:")) {
                  const payload = line.slice(5).trim();
                  if (payload !== "[DONE]") {
                    try {
                      const json = JSON.parse(payload);
                      const delta = json?.choices?.[0]?.delta?.content;
                      if (delta && typeof delta === 'string') {
                        controller.enqueue(encoder.encode(`data: ${delta}\n\n`));
                      }
                    } catch (e) {
                      console.warn("[DEBUG] Failed to parse remaining buffer:", e);
                    }
                  }
                }
              }
            } catch (error) {
              console.error("Stream error:", error);
              controller.enqueue(encoder.encode(`data: Ошибка стриминга: ${String(error)}\n\n`));
            } finally {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      }

      // Non-streaming branch
      let r: Response;
      try {
        r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages,
              temperature: 0.7,
              max_tokens: 1500,
              presence_penalty: 0.1,
              frequency_penalty: 0.1,
            }),
        });
      } catch (fetchError: any) {
        console.error("[DEBUG] OpenAI fetch error (non-streaming):", fetchError);
        return NextResponse.json({ 
          message: "Ошибка подключения к OpenAI API", 
          error: fetchError?.message || String(fetchError)
        }, { status: 502 });
      }
      
      if (!r.ok) {
        const errorText = await r.text().catch(() => '');
        let errorData: any = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { raw: errorText.substring(0, 200) };
        }
        
        console.error("[DEBUG] OpenAI API error (non-streaming):", {
          status: r.status,
          error: errorData
        });
        
        let errorMessage = "Ошибка OpenAI API";
        if (r.status === 401) {
          errorMessage = "Неверный API ключ OpenAI";
        } else if (r.status === 429) {
          errorMessage = "Превышен лимит запросов к OpenAI API";
        } else if (errorData?.error?.message) {
          errorMessage = errorData.error.message;
        }
        
        return NextResponse.json({ 
          message: errorMessage,
          error: errorData?.error?.message || String(r.status)
        }, { status: r.status });
      }
      
      const data = await r.json().catch(()=>({}));
      const answer = data?.choices?.[0]?.message?.content || data?.answer || data?.content || null;
      return NextResponse.json({ answer: answer || "" });
    } catch (e: any) {
      console.error("[DEBUG] OpenAI request exception:", {
        message: e?.message,
        stack: e?.stack?.substring(0, 500)
      });
      return NextResponse.json({ 
        message: "Ошибка при запросе к OpenAI", 
        error: String(e?.message || e) 
      }, { status: 500 });
    }
  }

  // Fallback: n8n
  if (!process.env.N8N_QA_URL) {
    return NextResponse.json(
      { message: "Не настроен N8N_QA_URL и отсутствует OPENAI_API_KEY" },
      { status: 400 }
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const r = await fetch(process.env.N8N_QA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ profileId, question, history: Array.isArray(history) ? history.slice(-10) : [] }),
    signal: controller.signal,
  });
  clearTimeout(timeout);
  const data = await r.json().catch(()=>({}));
  return NextResponse.json(data);
}
