/**
 * Перехватчик для обработки ошибок 403 (истёкший доступ) в API запросах
 */

let isRedirecting = false;

export function setupApiInterceptor() {
  if (typeof window === "undefined") return;

  // Перехватываем fetch запросы
  const originalFetch = window.fetch;
  
  window.fetch = async function(...args: Parameters<typeof fetch>) {
    const response = await originalFetch(...args);
    
    // Если получили 403 и это не запрос к /api/me (там своя обработка)
    if (response.status === 403 && !isRedirecting) {
      let url = "";
      const firstArg = args[0];
      if (typeof firstArg === "string") {
        url = firstArg;
      } else if (firstArg instanceof URL) {
        url = firstArg.toString();
      } else if (firstArg && typeof firstArg === "object" && "url" in firstArg) {
        url = String(firstArg.url);
      }
      
      // Проверяем, что это не запрос к /api/me (там своя обработка в SubscriptionStatus)
      if (url && !url.includes("/api/me")) {
        try {
          const data = await response.clone().json().catch(() => ({}));
          
          // Если это ошибка подписки
          if (data.code === "SUBSCRIPTION_EXPIRED" || data.message?.includes("Доступ к системе истёк")) {
            isRedirecting = true;
            // Небольшая задержка чтобы избежать множественных редиректов
            setTimeout(() => {
              window.location.href = "/subscription-expired";
            }, 100);
            return response;
          }
        } catch {
          // Игнорируем ошибки парсинга
        }
      }
    }
    
    return response;
  };
}

