import { headers, cookies } from "next/headers";

export function getBaseUrl(): string {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  const hdrs = headers();
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export async function internalApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const jar = cookies().getAll();
  const cookieHeader = jar.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join("; ");
  const mergedHeaders: HeadersInit = {
    Accept: "application/json",
    ...(init.headers || {}),
    cookie: cookieHeader,
  } as HeadersInit;
  const url = `${getBaseUrl()}${normalizedPath}`;
  return fetch(url, { ...init, headers: mergedHeaders, cache: init.cache ?? "no-store" });
}

export async function fetchJson<T = any>(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T | null; rawText?: string; }> {
  const res = await internalApiFetch(path, init);
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }
  const rawText = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, data: null, rawText };
}

// Функция для обновления токена
export async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}
