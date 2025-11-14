import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDirectusUrl } from "@/lib/env";

// Функции для расчета кодов из даты рождения
function digitSum1to9(n: number): number {
  while (n > 9) {
    n = n.toString().split('').reduce((a, b) => a + parseInt(b), 0);
  }
  return n;
}

function digitSumMission(n: number): number {
  if (n === 11 || n === 22) return n;
  while (n > 9) {
    n = n.toString().split('').reduce((a, b) => a + parseInt(b), 0);
  }
  return n;
}

function calculateCodes(birthDate: string) {
  // Формат: YYYY-MM-DD или DD.MM.YYYY
  let day: number, month: number, year: number;
  
  if (birthDate.includes('.')) {
    // DD.MM.YYYY
    const parts = birthDate.split('.');
    day = parseInt(parts[0]);
    month = parseInt(parts[1]);
    year = parseInt(parts[2]);
  } else {
    // YYYY-MM-DD
    const parts = birthDate.split('-');
    year = parseInt(parts[0]);
    month = parseInt(parts[1]);
    day = parseInt(parts[2]);
  }

  // Код Личности = сумма дня (до 9)
  const personality = digitSum1to9(day);

  // Код Коннектора = сумма всех цифр даты (до 9)
  const dateDigits = birthDate.replace(/\D/g, '').split('').map(Number);
  const connector = digitSum1to9(dateDigits.reduce((a, b) => a + b, 0));

  // Код Реализации = сумма последних 2 цифр года (до 9)
  const lastTwoDigits = year % 100;
  const realization = digitSum1to9(
    lastTwoDigits.toString().split('').reduce((a, b) => a + parseInt(b), 0)
  );

  // Код Генератора = (сумма дня) × (сумма месяца), затем до 9
  const sumDay = day.toString().split('').reduce((a, b) => a + parseInt(b), 0);
  const sumMonth = month.toString().split('').reduce((a, b) => a + parseInt(b), 0);
  const generator = digitSum1to9(sumDay * sumMonth);

  // Код Миссии = personality + connector → допускает 11 и 22
  const mission = digitSumMission(personality + connector);

  return { personality, connector, realization, generator, mission };
}

// Функции для расчета прогноза на дату
function parseDateOnly(isoDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || '').trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  return new Date(Date.UTC(y, mo - 1, d));
}

function weekdayMon1(dateUTC: Date): number {
  const d = dateUTC.getUTCDay(); // 0=Вс..6=Сб
  return ((d + 6) % 7) + 1;
}

function monthCode(dateUTC: Date): number {
  const day = dateUTC.getUTCDate();
  if (day <= 9) return 1;
  if (day <= 18) return 4;
  if (day <= 27) return 8;
  return 9;
}

function mod9(x: number): number {
  const r = x % 9;
  return r < 0 ? r + 9 : r;
}

function tByStep(step: number): number {
  const map = [2, 1.5, 1, 0.5, 0, -0.5, -1, -1.5, -2];
  return map[Math.max(0, Math.min(8, step | 0))];
}

function score(tWeek: number, tMonth: number): number {
  return 0.55 * tWeek + 0.45 * tMonth;
}

function calculateForecastForDate(dateStr: string, L: number, K: number, R: number) {
  const d = parseDateOnly(dateStr);
  if (!d) return null;

  const Week_Code = weekdayMon1(d);
  const Month_Code = monthCode(d);

  const Steps_L_W = mod9(Week_Code - L + 9);
  const Steps_L_M = mod9(Month_Code - L + 9);
  const Steps_K_W = mod9(Week_Code - K + 9);
  const Steps_K_M = mod9(Month_Code - K + 9);
  const Steps_R_W = mod9(Week_Code - R + 9);
  const Steps_R_M = mod9(Month_Code - R + 9);

  const t_L_week = tByStep(Steps_L_W);
  const t_L_month = tByStep(Steps_L_M);
  const t_K_week = tByStep(Steps_K_W);
  const t_K_month = tByStep(Steps_K_M);
  const t_R_week = tByStep(Steps_R_W);
  const t_R_month = tByStep(Steps_R_M);

  const S_L = score(t_L_week, t_L_month);
  const S_K = score(t_K_week, t_K_month);
  const S_R = score(t_R_week, t_R_month);
  const Index = (S_L + S_K + S_R) / 3;

  return {
    date: dateStr,
    week_code: Week_Code,
    month_code: Month_Code,
    personality: {
      code: L,
      steps_week: Steps_L_W,
      steps_month: Steps_L_M,
      t_week: t_L_week,
      t_month: t_L_month,
      score: Number(S_L.toFixed(3)),
    },
    connector: {
      code: K,
      steps_week: Steps_K_W,
      steps_month: Steps_K_M,
      t_week: t_K_week,
      t_month: t_K_month,
      score: Number(S_K.toFixed(3)),
    },
    realization: {
      code: R,
      steps_week: Steps_R_W,
      steps_month: Steps_R_M,
      t_week: t_R_week,
      t_month: t_R_month,
      score: Number(S_R.toFixed(3)),
    },
    index: Number(Index.toFixed(3)),
  };
}

export async function GET(_req: Request, ctx: { params: { clientId: string } }) {
  const token = cookies().get("directus_access_token")?.value;
  const baseUrl = getDirectusUrl();
  if (!token || !baseUrl) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = ctx.params;

  try {
    // Получаем данные клиента
    const clientUrl = `${baseUrl}/items/clients/${clientId}?fields=id,name,birth_date`;
    const clientRes = await fetch(clientUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!clientRes.ok) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const clientData = await clientRes.json();
    const client = clientData?.data;

    if (!client || !client.birth_date) {
      return NextResponse.json({ error: "Client birth date is required" }, { status: 400 });
    }

    // Рассчитываем коды клиента
    const codes = calculateCodes(client.birth_date);
    const { personality: L, connector: K, realization: R } = codes;

    // Генерируем даты: 7 дней назад + 83 дня вперед (включая сегодня) = 90 дней
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setUTCDate(startDate.getUTCDate() - 7);
    const endDate = new Date(today);
    endDate.setUTCDate(endDate.getUTCDate() + 83);

    const forecasts: any[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDate.getUTCDate()).padStart(2, '0')}`;
      const forecast = calculateForecastForDate(dateStr, L, K, R);
      if (forecast) {
        forecasts.push(forecast);
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.name,
        birth_date: client.birth_date,
      },
      codes,
      forecasts,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error calculating forecast:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

