import { getDirectusUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { cookies } from "next/headers";

/**
 * Обновляет access token через refresh token
 * Сохраняет оба токена (access и refresh) в cookies
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
        const newAccessToken = data?.data?.access_token;
        const newRefreshToken = data?.data?.refresh_token;

        if (!newAccessToken) {
            logger.debug("[AUTH] No access token in refresh response");
            return null;
        }

        // Сохраняем новые токены в cookies
        const cookieStore = cookies();
        const secure = process.env.NODE_ENV === "production";
        const maxAge = 60 * 60 * 24 * 3; // 3 дня

        cookieStore.set("directus_access_token", newAccessToken, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
            maxAge,
        });

        // Важно: сохраняем новый refresh token, если он пришел в ответе
        if (newRefreshToken) {
            cookieStore.set("directus_refresh_token", newRefreshToken, {
                httpOnly: true,
                secure,
                sameSite: "lax",
                path: "/",
                maxAge,
            });
            logger.debug("[AUTH] Refresh token updated successfully");
        } else {
            logger.debug("[AUTH] No new refresh token in response, keeping old one");
        }

        return newAccessToken;
    } catch (error) {
        // Сетевые ошибки логируем на уровне debug
        logger.debug("[AUTH] Error refreshing token (network/timeout):", error instanceof Error ? error.message : String(error));
        return null;
    }
}
