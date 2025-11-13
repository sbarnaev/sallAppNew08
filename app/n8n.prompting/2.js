// Достаём JSON из Responses API и возвращаем в пайплайн

const outputs = $json.output || $json.outputs || [];
const msg = Array.isArray(outputs) ? outputs.find(o => o.type === 'message') : null;
const text = msg?.content?.find(c => c.type === 'output_text')?.text ?? null;

if (!text) {
  throw new Error('Не найден output_text в ответе модели.');
}

let data;
try {
  data = typeof text === 'string' ? JSON.parse(text) : text;
} catch (e) {
  throw new Error('Ошибка парсинга JSON: ' + e.message + '\nФрагмент: ' + String(text).slice(0, 300));
}

// Проверка структуры данных
if (!data || typeof data !== 'object') {
  throw new Error('Нет корректных данных в ответе модели.');
}

// Базовая валидация обязательных полей для целевой консультации
const requiredFields = [
  'warnings',
  'goalDecomposition',
  'resourcesForStages',
  'currentDiagnostics',
  'plan123',
  'progressMetrics',
  'whatIf',
  'objectionHandling',
  'finalStrategy'
];

for (const field of requiredFields) {
  if (!(field in data)) {
    throw new Error(`Отсутствует обязательное поле: ${field}`);
  }
}

// Проверка plan123 - должно быть ровно 3 этапа
if (!Array.isArray(data.plan123) || data.plan123.length !== 3) {
  throw new Error(`Поле plan123 должно содержать ровно 3 этапа, получено: ${data.plan123?.length || 0}`);
}

// Проверка finalStrategy - должно быть ровно 3 абзаца
if (!Array.isArray(data.finalStrategy) || data.finalStrategy.length !== 3) {
  throw new Error(`Поле finalStrategy должно содержать ровно 3 абзаца, получено: ${data.finalStrategy?.length || 0}`);
}

// Проверка currentDiagnostics структуры
if (data.currentDiagnostics) {
  if (!Array.isArray(data.currentDiagnostics.resourceStates)) {
    throw new Error('currentDiagnostics.resourceStates должен быть массивом');
  }
  if (!data.currentDiagnostics.readiness || typeof data.currentDiagnostics.readiness !== 'object') {
    throw new Error('currentDiagnostics.readiness должен быть объектом');
  }
  if (!Array.isArray(data.currentDiagnostics.questions)) {
    throw new Error('currentDiagnostics.questions должен быть массивом');
  }
}

// Проверка progressMetrics структуры
if (data.progressMetrics) {
  const requiredMetrics = ['earlySignals', 'midSignals', 'resultSignals'];
  for (const metric of requiredMetrics) {
    if (!Array.isArray(data.progressMetrics[metric])) {
      throw new Error(`progressMetrics.${metric} должен быть массивом`);
    }
  }
}

// Проверка whatIf структуры
if (data.whatIf) {
  const requiredWhatIf = ['fatigue', 'overwhelm', 'relapse', 'pitfalls'];
  for (const key of requiredWhatIf) {
    if (!Array.isArray(data.whatIf[key])) {
      throw new Error(`whatIf.${key} должен быть массивом`);
    }
  }
}

return [{ json: data }];
