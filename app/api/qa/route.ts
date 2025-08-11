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

  // If OpenAI key provided, answer via OpenAI. Otherwise fallback to n8n as раньше
  if (openaiKey) {
    try {
      const ctx = profileId && directusUrl ? await fetchProfileContext(Number(profileId), token, directusUrl) : {};

      const system: ChatMessage = {
        role: "system",
        content:
          "Ты консультант. Отвечай кратко и по делу, по-русски. Используй контекст профиля, если он есть. Если данных нет — отвечай общими рекомендациями и уточняющими вопросами.",
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
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            temperature: 0.4,
            max_tokens: 600,
            stream: true,
          }),
        });

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
                const parts = buffer.split("\n\n");
                buffer = parts.pop() || "";
                for (const part of parts) {
                  const line = part.trim();
                  if (!line) continue;
                  const payload = line.replace(/^data:\s*/, "");
                  if (payload === "[DONE]") continue;
                  try {
                    const json = JSON.parse(payload);
                    const delta = json?.choices?.[0]?.delta?.content || "";
                    if (delta) controller.enqueue(encoder.encode(`data: ${delta}\n\n`));
                  } catch {}
                }
              }
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
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.4,
          max_tokens: 600,
        }),
      });
      const data = await r.json().catch(()=>({}));
      const answer = data?.choices?.[0]?.message?.content || data?.answer || data?.content || null;
      return NextResponse.json({ answer: answer || "" });
    } catch (e: any) {
      return NextResponse.json({ message: "OpenAI request failed", error: String(e) }, { status: 500 });
    }
  }

  // Fallback: n8n
  if (!process.env.N8N_QA_URL) return NextResponse.json({ message: "No N8N_QA_URL" }, { status: 400 });
  const r = await fetch(process.env.N8N_QA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(()=>({}));
  return NextResponse.json(data);
}
