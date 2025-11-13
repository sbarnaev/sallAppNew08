
const gender = $('Webhook').first().json.body.gender;
const codes = $('Code44').first().json;

// =================================

const scale = String(gender).toLowerCase() === 'male' ? 100 : 10;
const n = v => Number(v) || 0;

// Правило нормализации после умножения
const normalize = v => (v === 1100 ? 200 : v === 110 ? 20 : v);

const out = {
  "1": normalize(n(codes.personality) * scale),
  "2": normalize(n(codes.connector)   * scale),
  "3": normalize(n(codes.realization) * scale),
  "4": normalize(n(codes.generator)   * scale),
  "5": normalize(n(codes.mission)     * scale),
};

// Для ноды Code (Function):
return [{ json: out }];

// Для Function Item:
// return out;
