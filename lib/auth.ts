import { getDirectusUrl } from "@/lib/env";

/**
 * Обновляет access token через refresh token
 * Возвращает новый access token или null в случае ошибки
 */
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
    const baseUrl = getDirectusUrl();
    if (!baseUrl) return null;

    try {
        const refreshUrl = `${baseUrl}/auth/refresh`;
        const res = await fetch(refreshUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
            signal: AbortSignal.timeout(10000),
            cache: "no-store"
        });

        if (!res.ok) {
            console.error("[AUTH] Token refresh failed:", res.status, res.statusText);
            return null;
        }

        const data = await res.json().catch(() => ({}));
        return data?.data?.access_token || null;
    } catch (error) {
        console.error("[AUTH] Error refreshing token:", error);
        return null;
    }
}
