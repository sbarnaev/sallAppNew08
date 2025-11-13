// Берём message→output_text→text и парсим JSON
const out = $json.output || [];
const msg = out.find(o => o.type === 'message');
const text = msg?.content?.find(c => c.type === 'output_text')?.text ?? '';

if (!text) {
  throw new Error('Не найден output_text в ответе модели.');
}

let data;
try {
  data = typeof text === 'string' ? JSON.parse(text) : text;
} catch (e) {
  throw new Error('JSON.parse() не удался: ' + e.message + '\nФрагмент: ' + String(text).slice(0, 300));
}

// Проверка структуры данных
if (!data || typeof data !== 'object') {
  throw new Error('Данные не являются объектом.');
}

// КРИТИЧЕСКАЯ ПРОВЕРКА: убеждаемся, что weaknesses и resourceSignals не смешаны
if (data.weaknesses && Array.isArray(data.weaknesses)) {
  // Проверяем, не попали ли resourceSignals в weaknesses
  const hasResourceSignalsPattern = data.weaknesses.some(w => 
    typeof w === 'string' && (
      w.includes('признак активной') || 
      w.includes('признак дефицита') ||
      w.includes('Вы легко начинаете') ||
      w.includes('Вы держите слово')
    )
  );
  if (hasResourceSignalsPattern) {
    console.warn('[WARNING] В weaknesses обнаружены паттерны resourceSignals. Проверь промпт!');
  }
}

if (data.resourceSignals && Array.isArray(data.resourceSignals)) {
  // Проверяем, не попали ли weaknesses в resourceSignals
  const hasWeaknessesPattern = data.resourceSignals.some(r => 
    typeof r === 'string' && (
      r.includes('риск') && !r.includes('признак') ||
      r.includes('может мешать') ||
      r.includes('сложности')
    )
  );
  if (hasWeaknessesPattern) {
    console.warn('[WARNING] В resourceSignals обнаружены паттерны weaknesses. Проверь промпт!');
  }
}

// Быстрые проверки длин массивов под твою схему
const mustLen = (arr, min, max, name) => {
  if (!Array.isArray(arr) || arr.length < min || arr.length > max) {
    throw new Error(`Поле ${name} нарушает ограничения: ${arr?.length} (ожидалось ${min}–${max}).`);
  }
};

mustLen(data.personalitySummary, 3, 3, 'personalitySummary');
mustLen(data.strengths, 7, 7, 'strengths');
mustLen(data.weaknesses, 7, 7, 'weaknesses');
mustLen(data.happinessFormula, 2, 3, 'happinessFormula');
mustLen(data.resourceSignals, 10, 10, 'resourceSignals');
mustLen(data.deficitSignals, 10, 10, 'deficitSignals');
mustLen(data.codesExplanation, 3, 5, 'codesExplanation');
mustLen(data.conflicts, 5, 5, 'conflicts');

['personality','connector','realization','generator','mission'].forEach(k => {
  mustLen(data.practices?.[k], 3, 3, `practices.${k}`);
});

// Вернём объект дальше по пайплайну
return [{ json: data }];
