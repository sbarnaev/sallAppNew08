/**
 * Логирование только в development режиме
 * В production все логи игнорируются для безопасности
 */
const isDevelopment = process.env.NODE_ENV === "development";

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    // Ошибки логируем всегда, но без чувствительных данных
    if (isDevelopment) {
      console.error(...args);
    } else {
      // В production логируем только критичные ошибки без деталей
      const sanitized = args.map(arg => {
        if (typeof arg === 'string') {
          // Убираем токены и чувствительные данные
          return arg
            .replace(/token["\s:=]+[^\s"']+/gi, 'token=[REDACTED]')
            .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
            .replace(/Authorization["\s:=]+[^\s"']+/gi, 'Authorization=[REDACTED]');
        }
        return arg;
      });
      console.error(...sanitized);
    }
  },
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  },
};

