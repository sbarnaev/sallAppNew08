# Промпт и схема для партнерской консультации

## Промпт для OpenAI

```json
{
  "model": "gpt-5-mini",
  "reasoning": { "effort": "medium" },
  "input": [
    {
      "role": "system",
      "content": "Ты — эксперт по системному анализу личности (САЛ). САЛ — это метод, который определяет ключевые аспекты личности через пять кодов по дате рождения: 1) Код Личности — ядро человека, его врожденная природа, способ мышления, характер, внутренний стиль взаимодействия с собой и миром. 2) Код Коннектора — социальная маска: как человек взаимодействует с миром, как воспринимается окружающими, как выстраивает коммуникацию. 3) Код Реализации — путь к успеху: через что человек реализует себя, получает чувство пользы и результата. 4) Код Генератора — источник энергии: что заряжает и истощает человека, что даёт смысл. 5) Код Миссии — высшая цель: какую энергию человек призван нести в мир, испытания и искажения, которые он не может полностью преодолеть. Каждому коду соответствует архетип, и консультация строится именно через архетипы. Твоя задача — синтезировать трактовки кодов (ресурсы, искажения, задачи развития) в единую психологическую картину личности, без пересказа кодов по отдельности. Консультант проводит консультацию для пары клиентов, а ты ему помогаешь (консультанту), то есть ты помощник консультанта. Сейчас проводится партнерская консультация по конкретному запросу. ЖЁСТКОЕ ПРАВИЛО ПО ЦИФРАМ: Всегда указывай цифру кода ресурса из профиля каждого клиента. Что нужно вернуть: - Предупреждения по ресурсам САЛ для пары, например какие сложности и проблемы могут быть по профилям САЛ в разрезе достижения цели. В общем любые предупреждения, о которых стоит предупредить консультанта/пару.— Декомпозицию цели пары (из чего состоит большая цель и что нужно для её достижения).- Определение необходимых ресурсов САЛ для этапов (какой ресурс какого партнера нужен на каком этапе и зачем).— Диагностику пары сейчас (что в плюсе/минусе у каждого, реальная готовность пары; добавить диагностические вопросы).— Совместимость кодов (какие коды дополняют друг друга, какие конфликтуют, почему).— Зоны конфликтов (где могут быть проблемы во взаимодействии пары).— План достижения 1 → 2 → 3 (что делать сначала, потом, затем, с указанием кто из партнеров что делает).— Метрики прогресса (как понять, что пара идёт к цели и что получается).— Что делать, если негатив, например: усталость, перегруз, конфликты, откаты.— Работа с возражениями (что может возразить пара и как помочь/ответить).— Как идём к цели — итоговое резюме ровно в 3 абзацах. Стиль: коротко, ясно, по делу."
    },
    {
      "role": "user",
      "content": "Запрос пары: {{ $('Webhook').item.json.body.goal }} {{ $json.codes[0].description }} {{ $json.codes[1].description }}{{ $json.codes[2].description }} {{ $json.codes[3].description }}{{ $json.codes[4].description }} Коды второго человека: {{ $json.partnerCodes[0].description }} {{ $json.partnerCodes[1].description }}{{ $json.partnerCodes[2].description }} {{ $json.partnerCodes[3].description }}{{ $json.partnerCodes[4].description }}"
    }
  ],
  "text": {
    "format": {
      "type": "json_schema",
      "name": "sal_partner_consult_structure",
      "strict": true,
      "schema": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "warnings": {
            "type": "array",
            "description": "Предупреждения для пары",
            "items": { "type": "string" }
          },
          "goalDecomposition": {
            "type": "array",
            "description": "Из чего состоит цель пары: путь от текущей точки к результату, разложенный на части.",
            "items": { "type": "string" }
          },
          "resourcesForStages": {
            "type": "array",
            "description": "Какие ресурсы САЛ (с цифрами каждого партнера) нужны на каждом этапе и зачем.",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "stage": { "type": "string", "description": "Этап: '1', '2' или '3'." },
                "resources": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "resource": { "type": "string", "description": "Личность/Коннектор/Реализация/Генератор/Миссия." },
                      "code": { "type": ["integer","string"], "description": "Цифра кода из профиля (может быть для первого или второго партнера)." },
                      "partner": { "type": "string", "enum": ["first", "second"], "description": "Для какого партнера этот ресурс." },
                      "why": { "type": "string", "description": "Зачем этот ресурс на этапе." },
                      "successSignals": { "type": "array", "items": { "type": "string" }, "description": "Признаки, что ресурс сработал." }
                    },
                    "required": ["resource","code","partner","why","successSignals"]
                  }
                }
              },
              "required": ["stage","resources"]
            }
          },
          "currentDiagnostics": {
            "type": "object",
            "description": "Диагностика пары на сейчас: состояние ресурсов каждого, готовность пары, вопросы для уточнения.",
            "additionalProperties": false,
            "properties": {
              "resourceStates": {
                "type": "array",
                "description": "Плюс/минус/нейтраль по каждому ресурсу каждого партнера с цифрой и коррекцией.",
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "resource": { "type": "string" },
                    "code": { "type": ["integer","string"] },
                    "partner": { "type": "string", "enum": ["first", "second"] },
                    "state": { "type": "string", "enum": ["plus","neutral","minus","unknown"] },
                    "evidence": { "type": "array", "items": { "type": "string" } },
                    "correction": { "type": "array", "items": { "type": "string" } }
                  },
                  "required": ["resource","code","partner","state","evidence","correction"]
                }
              },
              "readiness": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "willingness": { "type": ["integer","null"], "minimum": 0, "maximum": 10, "description": "0–10, готовность пары идти к цели." },
                  "blockers": { "type": "array", "items": { "type": "string" } },
                  "comment": { "type": ["string","null"] }
                },
                "required": ["willingness","blockers","comment"]
              },
              "questions": {
                "type": "array",
                "description": "Диагностические вопросы для пары (каждый привязан к ресурсу с цифрой).",
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "question": { "type": "string" },
                    "salResource": { "type": "string" }
                  },
                  "required": ["question","salResource"]
                }
              }
            },
            "required": ["resourceStates","readiness","questions"]
          },
          "codeCompatibility": {
            "type": "object",
            "description": "Совместимость кодов пары: какие дополняют друг друга, какие конфликтуют.",
            "additionalProperties": false,
            "properties": {
              "complementary": {
                "type": "array",
                "description": "Пары кодов, которые дополняют друг друга.",
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "firstCode": { "type": "string", "description": "Код первого партнера (например, 'Личность 1')" },
                    "secondCode": { "type": "string", "description": "Код второго партнера (например, 'Реализация 9')" },
                    "why": { "type": "string", "description": "Почему они дополняют друг друга." }
                  },
                  "required": ["firstCode","secondCode","why"]
                }
              },
              "conflicting": {
                "type": "array",
                "description": "Пары кодов, которые могут конфликтовать.",
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "firstCode": { "type": "string", "description": "Код первого партнера" },
                    "secondCode": { "type": "string", "description": "Код второго партнера" },
                    "why": { "type": "string", "description": "Почему они могут конфликтовать." },
                    "solution": { "type": "string", "description": "Как смягчить конфликт." }
                  },
                  "required": ["firstCode","secondCode","why","solution"]
                }
              }
            },
            "required": ["complementary","conflicting"]
          },
          "conflictZones": {
            "type": "array",
            "description": "Зоны конфликтов: где могут быть проблемы во взаимодействии пары.",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "zone": { "type": "string", "description": "Название зоны конфликта (например, 'Принятие решений', 'Коммуникация')" },
                "description": { "type": "string", "description": "Описание проблемы в этой зоне." },
                "firstPartnerRole": { "type": "string", "description": "Роль первого партнера в конфликте." },
                "secondPartnerRole": { "type": "string", "description": "Роль второго партнера в конфликте." },
                "recommendation": { "type": "string", "description": "Рекомендация по решению конфликта." }
              },
              "required": ["zone","description","firstPartnerRole","secondPartnerRole","recommendation"]
            }
          },
          "plan123": {
            "type": "array",
            "description": "План достижения: сначала → потом → затем. С указанием кто из партнеров что делает.",
            "minItems": 3,
            "maxItems": 3,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "stageTitle": { "type": "string" },
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "action": { "type": "string", "description": "Что делать" },
                      "who": { "type": "string", "enum": ["first", "second", "both"], "description": "Кто выполняет: первый партнер, второй, или оба." }
                    },
                    "required": ["action","who"]
                  }
                },
                "resources": {
                  "type": "array",
                  "description": "Какие ресурсы с цифрами задействуем на этом шаге.",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "resource": { "type": "string" },
                      "code": { "type": ["integer","string"] },
                      "partner": { "type": "string", "enum": ["first", "second"] }
                    },
                    "required": ["resource","code","partner"]
                  }
                },
                "successCriteria": { "type": "string" },
                "riskNotes": { "type": ["string","null"] }
              },
              "required": ["stageTitle","actions","resources","successCriteria","riskNotes"]
            }
          },
          "progressMetrics": {
            "type": "object",
            "description": "Как отслеживать прогресс пары.",
            "additionalProperties": false,
            "properties": {
              "earlySignals": { "type": "array", "items": { "type": "string" }, "description": "Ранние признаки, что пара идёт верно." },
              "midSignals": { "type": "array", "items": { "type": "string" }, "description": "Сигналы на середине пути." },
              "resultSignals": { "type": "array", "items": { "type": "string" }, "description": "Итоговые индикаторы результата." }
            },
            "required": ["earlySignals","midSignals","resultSignals"]
          },
          "whatIf": {
            "type": "object",
            "description": "Что делать при сложностях в паре.",
            "additionalProperties": false,
            "properties": {
              "fatigue": { "type": "array", "items": { "type": "string" } },
              "overwhelm": { "type": "array", "items": { "type": "string" } },
              "conflicts": { "type": "array", "items": { "type": "string" }, "description": "Что делать при конфликтах в паре." },
              "relapse": { "type": "array", "items": { "type": "string" } },
              "pitfalls": { "type": "array", "items": { "type": "string" } }
            },
            "required": ["fatigue","overwhelm","conflicts","relapse","pitfalls"]
          },
          "objectionHandling": {
            "type": "array",
            "description": "Что может возразить пара и как ответить/помочь.",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "objection": { "type": "string" },
                "reply": { "type": "string" }
              },
              "required": ["objection","reply"]
            }
          },
          "finalStrategy": {
            "type": "array",
            "description": "Итоговое резюме ровно в 3 абзацах.",
            "minItems": 3,
            "maxItems": 3,
            "items": { "type": "string" }
          },
          "partnerCodes": {
            "type": "object",
            "description": "Коды САЛ для каждого партнера (для отображения на странице).",
            "additionalProperties": false,
            "properties": {
              "first": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "personality": { "type": ["integer","string"] },
                  "connector": { "type": ["integer","string"] },
                  "realization": { "type": ["integer","string"] },
                  "generator": { "type": ["integer","string"] },
                  "mission": { "type": ["integer","string"] }
                },
                "required": ["personality","connector","realization","generator","mission"]
              },
              "second": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "personality": { "type": ["integer","string"] },
                  "connector": { "type": ["integer","string"] },
                  "realization": { "type": ["integer","string"] },
                  "generator": { "type": ["integer","string"] },
                  "mission": { "type": ["integer","string"] }
                },
                "required": ["personality","connector","realization","generator","mission"]
              }
            },
            "required": ["first","second"]
          }
        },
        "required": [
          "warnings",
          "goalDecomposition",
          "resourcesForStages",
          "currentDiagnostics",
          "codeCompatibility",
          "conflictZones",
          "plan123",
          "progressMetrics",
          "whatIf",
          "objectionHandling",
          "finalStrategy",
          "partnerCodes"
        ]
      }
    }
  }
}
```

## Примечания для n8n

1. В webhook должен приходить:
   - `body.goal` - цель расчета (family, parent-child, business, etc.)
   - `body.name` и `body.birthday` - данные первого клиента
   - `body.partnerName` и `body.partnerBirthday` - данные второго клиента
   - `body.codes` - массив кодов первого клиента (5 элементов)
   - `body.partnerCodes` - массив кодов второго клиента (5 элементов)

2. В промпте используются переменные:
   - `{{ $('Webhook').item.json.body.goal }}` - цель расчета
   - `{{ $json.codes[0-4].description }}` - описания кодов первого клиента
   - `{{ $json.partnerCodes[0-4].description }}` - описания кодов второго клиента

