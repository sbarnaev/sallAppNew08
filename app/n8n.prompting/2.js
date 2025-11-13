// Достаём JSON из Responses API и возвращаем в пайплайн

const outputs = $json.output || $json.outputs || [];
const msg = Array.isArray(outputs) ? outputs.find(o => o.type === 'message') : null;
const text = msg?.content?.find(c => c.type === 'output_text')?.text ?? null;

let data;
try {
  data = text ? JSON.parse(text) : null;
} catch (e) {
  throw new Error('Ошибка парсинга JSON: ' + e.message);
}

if (!data || typeof data !== 'object') {
  throw new Error('Нет корректных данных в ответе модели.');
}

return [{ json: data }];
