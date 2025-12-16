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

type InternalApiFetchOptions = Omit<RequestInit, 'cache'> & {
  cache?: RequestCache;
  next?: { revalidate?: number };
};

export async function internalApiFetch(
  path: string, 
  init: InternalApiFetchOptions = {}
): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const jar = cookies().getAll();
  const cookieHeader = jar.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join("; ");
  const mergedHeaders: HeadersInit = {
    Accept: "application/json",
    ...(init.headers || {}),
    cookie: cookieHeader,
  } as HeadersInit;
  const url = `${getBaseUrl()}${normalizedPath}`;
  
  // Извлекаем next из init если есть
  const { next, ...restInit } = init;
  
  // Формируем опции для fetch
  // Если cache явно указан как "no-store", используем его
  // Если указан next с revalidate, используем его
  // Иначе используем revalidate по умолчанию (30 сек)
  const fetchOptions: any = {
    ...restInit,
    headers: mergedHeaders,
  };
  
  if (restInit.cache !== undefined) {
    // Если cache явно указан, используем его
    fetchOptions.cache = restInit.cache;
  } else if (next !== undefined) {
    // Если next указан, используем его
    fetchOptions.next = next;
  } else {
    // По умолчанию используем revalidate 30 секунд для улучшения производительности
    fetchOptions.next = { revalidate: 30 };
  }
  
  return fetch(url, fetchOptions);
}

export async function fetchJson<T = any>(path: string, init: InternalApiFetchOptions = {}): Promise<{ ok: boolean; status: number; data: T | null; rawText?: string; }> {
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
