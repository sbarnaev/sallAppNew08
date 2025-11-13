# Промпт для партнерской консультации

## Запрос к OpenAI API

```json
{
  "model": "gpt-5-mini",
  "reasoning": { "effort": "medium" },
  "input": [
    {
      "role": "system",
      "content": "Ты — эксперт по системному анализу личности (САЛ). САЛ — это метод, который определяет ключевые аспекты личности через пять кодов по дате рождения: 1) Код Личности — ядро человека, его врожденная природа, способ мышления, характер, внутренний стиль взаимодействия с собой и миром. 2) Код Коннектора — социальная маска: как человек взаимодействует с миром, как воспринимается окружающими, как выстраивает коммуникацию. 3) Код Реализации — путь к успеху: через что человек реализует себя, получает чувство пользы и результата. 4) Код Генератора — источник энергии: что заряжает и истощает человека, что даёт смысл. 5) Код Миссии — высшая цель: какую энергию человек призван нести в мир, испытания и искажения, которые он не может полностью преодолеть. Каждому коду соответствует архетип, и консультация строится именно через архетипы. Твоя задача — синтезировать трактовки кодов (ресурсы, искажения, задачи развития) в единую психологическую картину личности, без пересказа кодов по отдельности. Консультант проводит консультацию для пары (двух человек), а ты ему помогаешь (консультанту), то есть ты помощник консультанта. Сейчас проводится партнерская консультация по конкретному запросу. ЖЁСТКОЕ ПРАВИЛО ПО ЦИФРАМ: Всегда указывай цифру кода ресурса из профиля каждого участника. Что нужно вернуть: - Предупреждения по ресурсам САЛ для пары, например какие сложности и проблемы могут быть по профилям САЛ в разрезе достижения цели. В общем любые предупреждения, о которых стоит предупредить консультанта/пару.— Декомпозицию цели пары (из чего состоит большая цель и что нужно для её достижения).- Определение необходимых ресурсов САЛ для этапов (какой ресурс какого участника нужен на каком этапе и зачем).— Диагностику пары сейчас (что в плюсе/минусе у каждого участника, реальная готовность пары; совместимость ресурсов; зоны конфликтов; добавить диагностические вопросы).— План достижения 1 → 2 → 3 (что делать сначала, потом, затем, с указанием кто из участников что делает).— Метрики прогресса (как понять, что пара идёт к цели и что получается).— Что делать, если негатив, например: усталость, перегруз, конфликты, откаты.— Работа с возражениями (что может возразить пара и как помочь/ответить).— Как идём к цели — итоговое резюме ровно в 3 абзацах. Стиль: коротко, ясно, по делу."
    },
    {
      "role": "user",
      "content": "Запрос пары: {{ $('Webhook').item.json.body.goal }}\n\nПрофиль первого участника:\n{{ $json.codes[0].description }}\n{{ $json.codes[1].description }}\n{{ $json.codes[2].description }}\n{{ $json.codes[3].description }}\n{{ $json.codes[4].description }}\n\nПрофиль второго участника:\n{{ $json.partnerCodes[0].description }}\n{{ $json.partnerCodes[1].description }}\n{{ $json.partnerCodes[2].description }}\n{{ $json.partnerCodes[3].description }}\n{{ $json.partnerCodes[4].description }}"
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
            "description": "Какие ресурсы САЛ (с цифрами каждого участника) нужны на каждом этапе и зачем.",
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
                      "code": { "type": ["integer","string"], "description": "Цифра кода из профиля участника (num)." },
                      "participant": { "type": "string", "enum": ["first", "second"], "description": "Первый или второй участник." },
                      "why": { "type": "string", "description": "Зачем этот ресурс на этапе." },
                      "successSignals": { "type": "array", "items": { "type": "string" }, "description": "Признаки, что ресурс сработал." }
                    },
                    "required": ["resource","code","participant","why","successSignals"]
                  }
                }
              },
              "required": ["stage","resources"]
            }
          },
          "compatibility": {
            "type": "object",
            "description": "Совместимость ресурсов между участниками.",
            "additionalProperties": false,
            "properties": {
              "complementary": {
                "type": "array",
                "description": "Ресурсы, которые дополняют друг друга.",
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "firstResource": { "type": "string", "description": "Ресурс первого участника с кодом, например 'Личность (1)'." },
                    "secondResource": { "type": "string", "description": "Ресурс второго участника с кодом, например 'Миссия (4)'." },
                    "why": { "type": "string", "description": "Почему они дополняют друг друга." }
                  },
                  "required": ["firstResource","secondResource","why"]
                }
              },
              "conflicts": {
                "type": "array",
                "description": "Ресурсы, которые могут конфликтовать.",
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "firstResource": { "type": "string", "description": "Ресурс первого участника с кодом." },
                    "secondResource": { "type": "string", "description": "Ресурс второго участника с кодом." },
                    "why": { "type": "string", "description": "Почему они конфликтуют." },
                    "solution": { "type": "string", "description": "Как решить конфликт." }
                  },
                  "required": ["firstResource","secondResource","why","solution"]
                }
              }
            },
            "required": ["complementary","conflicts"]
          },
          "currentDiagnostics": {
            "type": "object",
            "description": "Диагностика пары на сейчас: состояние ресурсов каждого участника, совместимость, готовность, зоны конфликтов, вопросы для уточнения.",
            "additionalProperties": false,
            "properties": {
              "firstParticipant": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "resourceStates": {
                    "type": "array",
                    "description": "Плюс/минус/нейтраль по каждому ресурсу первого участника с цифрой и коррекцией.",
                    "items": {
                      "type": "object",
                      "additionalProperties": false,
                      "properties": {
                        "resource": { "type": "string" },
                        "code": { "type": ["integer","string"] },
                        "state": { "type": "string", "enum": ["plus","neutral","minus","unknown"] },
                        "evidence": { "type": "array", "items": { "type": "string" } },
                        "correction": { "type": "array", "items": { "type": "string" } }
                      },
                      "required": ["resource","code","state","evidence","correction"]
                    }
                  }
                },
                "required": ["resourceStates"]
              },
              "secondParticipant": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "resourceStates": {
                    "type": "array",
                    "description": "Плюс/минус/нейтраль по каждому ресурсу второго участника с цифрой и коррекцией.",
                    "items": {
                      "type": "object",
                      "additionalProperties": false,
                      "properties": {
                        "resource": { "type": "string" },
                        "code": { "type": ["integer","string"] },
                        "state": { "type": "string", "enum": ["plus","neutral","minus","unknown"] },
                        "evidence": { "type": "array", "items": { "type": "string" } },
                        "correction": { "type": "array", "items": { "type": "string" } }
                      },
                      "required": ["resource","code","state","evidence","correction"]
                    }
                  }
                },
                "required": ["resourceStates"]
              },
              "conflictZones": {
                "type": "array",
                "description": "Зоны конфликтов во взаимодействии пары.",
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "properties": {
                    "zone": { "type": "string", "description": "Название зоны конфликта, например 'Принятие решений', 'Коммуникация', 'Распределение ответственности'." },
                    "description": { "type": "string", "description": "Описание проблемы в этой зоне." },
                    "firstParticipantRole": { "type": "string", "description": "Роль первого участника в конфликте." },
                    "secondParticipantRole": { "type": "string", "description": "Роль второго участника в конфликте." },
                    "solution": { "type": "string", "description": "Как решить конфликт в этой зоне." }
                  },
                  "required": ["zone","description","firstParticipantRole","secondParticipantRole","solution"]
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
                    "salResource": { "type": "string" },
                    "participant": { "type": "string", "enum": ["first", "second", "both"], "description": "Кому задавать вопрос." }
                  },
                  "required": ["question","salResource","participant"]
                }
              }
            },
            "required": ["firstParticipant","secondParticipant","conflictZones","readiness","questions"]
          },
          "plan123": {
            "type": "array",
            "description": "План достижения: сначала → потом → затем. С указанием кто из участников что делает.",
            "minItems": 3,
            "maxItems": 3,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "stageTitle": { "type": "string" },
                "actions": {
                  "type": "array",
                  "items": { "type": "string" },
                  "description": "Действия с указанием кто их выполняет (например: 'Первый участник: ...', 'Второй участник: ...', 'Вместе: ...')."
                },
                "resources": {
                  "type": "array",
                  "description": "Какие ресурсы с цифрами задействуем на этом шаге (указывать участника).",
                  "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "resource": { "type": "string" },
                      "code": { "type": ["integer","string"] },
                      "participant": { "type": "string", "enum": ["first", "second"] }
                    },
                    "required": ["resource","code","participant"]
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
          }
        },
        "required": [
          "warnings",
          "goalDecomposition",
          "resourcesForStages",
          "compatibility",
          "currentDiagnostics",
          "plan123",
          "progressMetrics",
          "whatIf",
          "objectionHandling",
          "finalStrategy"
        ]
      }
    }
  }
}
```

## Структура данных для n8n

В n8n workflow нужно передать:
- `goal` - цель расчета (из body)
- `codes` - коды первого участника (массив из 5 элементов)
- `partnerCodes` - коды второго участника (массив из 5 элементов)
- `name` - имя первого участника
- `partnerName` - имя второго участника
- `birthday` - дата рождения первого участника
- `partnerBirthday` - дата рождения второго участника
