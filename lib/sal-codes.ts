/**
 * Расчет кодов САЛ по дате рождения
 * Коды: Личность, Коннектор, Реализация, Генератор, Миссия
 */

export interface SALCodes {
  personality: number;    // Код Личности
  connector: number;      // Код Коннектора
  realization: number;    // Код Реализации
  generator: number;      // Код Генератора
  mission: number;        // Код Миссии
}

/**
 * Рассчитывает коды САЛ по дате рождения
 * @param birthday - дата рождения в формате YYYY-MM-DD или DD.MM.YYYY
 * @returns объект с кодами САЛ
 */
export function calculateSALCodes(birthday: string): SALCodes | null {
  try {
    // Нормализуем дату
    let day: number, month: number, year: number;
    
    // Формат DD.MM.YYYY
    if (birthday.includes('.')) {
      const parts = birthday.split('.');
      if (parts.length !== 3) return null;
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    } 
    // Формат YYYY-MM-DD
    else if (birthday.includes('-')) {
      const parts = birthday.split('-');
      if (parts.length !== 3) return null;
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      return null;
    }

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) return null;

    // Функция для приведения числа к однозначному (сумма цифр до одной)
    function reduceToSingleDigit(num: number): number {
      while (num > 9 && num !== 11 && num !== 22 && num !== 33) {
        num = Math.floor(num / 10) + (num % 10);
      }
      return num;
    }

    // Расчет кодов САЛ
    // Код Личности = день рождения
    const personality = reduceToSingleDigit(day);

    // Код Коннектора = месяц рождения
    const connector = reduceToSingleDigit(month);

    // Код Реализации = сумма цифр года
    const yearSum = year.toString().split('').reduce((sum, digit) => sum + parseInt(digit, 10), 0);
    const realization = reduceToSingleDigit(yearSum);

    // Код Генератора = сумма дня и месяца
    const generator = reduceToSingleDigit(day + month);

    // Код Миссии = сумма всех кодов
    const mission = reduceToSingleDigit(personality + connector + realization + generator);

    return {
      personality,
      connector,
      realization,
      generator,
      mission,
    };
  } catch (error) {
    console.error("Error calculating SAL codes:", error);
    return null;
  }
}

/**
 * Получает название кода по его типу
 */
export function getCodeLabel(type: keyof SALCodes): string {
  const labels: Record<keyof SALCodes, string> = {
    personality: "Код Личности",
    connector: "Код Коннектора",
    realization: "Код Реализации",
    generator: "Код Генератора",
    mission: "Код Миссии",
  };
  return labels[type] || type;
}

/**
 * Получает короткое название кода
 */
export function getCodeShortLabel(type: keyof SALCodes): string {
  const labels: Record<keyof SALCodes, string> = {
    personality: "Личность",
    connector: "Коннектор",
    realization: "Реализация",
    generator: "Генератор",
    mission: "Миссия",
  };
  return labels[type] || type;
}

