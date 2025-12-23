import { getDirectusUrl } from "@/lib/env";
import { logger } from "@/lib/logger";

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
            // Это нормальная ситуация, когда refresh token истек - пользователь должен перелогиниться
            // Логируем на уровне debug, а не error, чтобы не засорять логи
            logger.debug("[AUTH] Token refresh failed (expected if refresh token expired):", res.status, res.statusText);
            return null;
        }

        const data = await res.json().catch(() => ({}));
        return data?.data?.access_token || null;
    } catch (error) {
        // Сетевые ошибки логируем на уровне debug
        logger.debug("[AUTH] Error refreshing token (network/timeout):", error instanceof Error ? error.message : String(error));
        return null;
    }
}
