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
    let dob: string; // дата в формате DD.MM.YYYY
    
    // Формат DD.MM.YYYY
    if (birthday.includes('.')) {
      const parts = birthday.split('.');
      if (parts.length !== 3) return null;
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      dob = birthday;
    } 
    // Формат YYYY-MM-DD
    else if (birthday.includes('-')) {
      const parts = birthday.split('-');
      if (parts.length !== 3) return null;
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
      // Преобразуем в DD.MM.YYYY для расчета коннектора
      dob = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
    } else {
      return null;
    }

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) return null;

    // Сумма до 1–9 (для всех кодов, кроме миссии)
    const digitSum1to9 = (n: number): number => {
      while (n > 9) {
        n = n.toString().split('').reduce((a, b) => a + parseInt(b, 10), 0);
      }
      return n;
    };

    // Сумма с мастер-числами 11, 22 (для миссии)
    const digitSumMission = (n: number): number => {
      if (n === 11 || n === 22) return n;
      while (n > 9) {
        n = n.toString().split('').reduce((a, b) => a + parseInt(b, 10), 0);
      }
      return n;
    };

    // Код Личности = сумма цифр дня (до 9)
    const personality = digitSum1to9(day);

    // Код Коннектора = сумма всех цифр даты (до 9)
    const connector = digitSum1to9(
      dob.replace(/\D/g, '').split('').reduce((a, b) => a + parseInt(b, 10), 0)
    );

    // Код Реализации = сумма последних 2 цифр года (до 9)
    // Если год заканчивается на 00 (например, 2000), то сумма = 0, но должно быть 9
    const lastTwoDigits = year % 100;
    const sumLastTwo = lastTwoDigits.toString().split('').reduce((a, b) => a + parseInt(b, 10), 0);
    const realization = sumLastTwo === 0 ? 9 : digitSum1to9(sumLastTwo);

    // Код Генератора = (сумма цифр дня) × (сумма цифр месяца), затем до 9
    const sumDay = day.toString().split('').reduce((a, b) => a + parseInt(b, 10), 0);
    const sumMonth = month.toString().split('').reduce((a, b) => a + parseInt(b, 10), 0);
    const generator = digitSum1to9(sumDay * sumMonth);

    // Код Миссии = personality + connector → допускает 11 и 22
    const mission = digitSumMission(personality + connector);

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

