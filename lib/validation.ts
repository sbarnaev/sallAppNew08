/**
 * Валидация и санитизация входных данных
 */

/**
 * Валидация ID (должен быть положительным числом)
 */
export function validateId(id: string | number | undefined | null): number | null {
  if (id === undefined || id === null || id === '') return null;
  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
  if (isNaN(numId) || numId <= 0 || !Number.isInteger(numId)) {
    return null;
  }
  return numId;
}

/**
 * Валидация строки (длина, обрезка пробелов)
 */
export function validateString(
  value: any,
  options: {
    maxLength?: number;
    minLength?: number;
    required?: boolean;
    trim?: boolean;
  } = {}
): string | null {
  const { maxLength = 10000, minLength = 0, required = false, trim = true } = options;
  
  if (value === undefined || value === null) {
    return required ? null : '';
  }
  
  let str = String(value);
  if (trim) {
    str = str.trim();
  }
  
  if (required && str.length === 0) {
    return null;
  }
  
  if (str.length < minLength || str.length > maxLength) {
    return null;
  }
  
  return str;
}

/**
 * Валидация email
 */
export function validateEmail(email: string | undefined | null): string | null {
  if (!email) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const trimmed = email.trim();
  if (trimmed.length > 255 || !emailRegex.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Валидация даты (формат YYYY-MM-DD)
 */
export function validateDate(date: string | undefined | null): string | null {
  if (!date) return null;
  const trimmed = date.trim();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(trimmed)) {
    return null;
  }
  // Проверяем, что дата валидна
  const dateObj = new Date(trimmed);
  if (isNaN(dateObj.getTime())) {
    return null;
  }
  return trimmed;
}

/**
 * Валидация номера страницы
 */
export function validatePage(page: string | number | undefined | null): number {
  if (page === undefined || page === null || page === '') return 1;
  const numPage = typeof page === 'string' ? parseInt(page, 10) : page;
  if (isNaN(numPage) || numPage < 1 || !Number.isInteger(numPage)) {
    return 1;
  }
  return numPage;
}

/**
 * Валидация лимита (ограничение диапазона)
 */
export function validateLimit(
  limit: string | number | undefined | null,
  options: { min?: number; max?: number; default?: number } = {}
): number {
  const { min = 1, max = 100, default: defaultValue = 20 } = options;
  if (limit === undefined || limit === null || limit === '') return defaultValue;
  const numLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
  if (isNaN(numLimit) || !Number.isInteger(numLimit)) {
    return defaultValue;
  }
  return Math.min(Math.max(numLimit, min), max);
}

/**
 * Санитизация поискового запроса (удаление опасных символов)
 */
export function sanitizeSearchQuery(query: string | undefined | null): string {
  if (!query) return '';
  // Удаляем потенциально опасные символы, но оставляем буквы, цифры, пробелы и основные знаки препинания
  return query
    .trim()
    .replace(/[<>'"&]/g, '') // Удаляем HTML-опасные символы
    .substring(0, 200); // Ограничиваем длину
}

