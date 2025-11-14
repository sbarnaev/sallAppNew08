// Скрипт для генерации 200 интересных фактов с помощью OpenAI API
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY не найден в переменных окружения");
  process.exit(1);
}

async function generateFacts() {
  const prompt = `Сгенерируй 200 интересных и познавательных фактов на русском языке о психологии, личностном развитии, самопознании, мотивации, отношениях, успехе, эмоциях, мышлении, поведении человека, науке о мозге, философии жизни, и других связанных темах. 

Каждый факт должен быть:
- Коротким (1-2 предложения)
- Интересным и познавательным
- С эмодзи в начале (разные эмодзи для разнообразия)
- В формате: "Эмодзи Текст факта"
- Без нумерации

Верни только факты, каждый с новой строки, без дополнительных пояснений.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.9,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";
    
    // Парсим факты из ответа
    const facts = content
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^\d+[\.\)]/)) // Убираем нумерацию
      .filter(line => line.length > 10); // Минимальная длина

    if (facts.length < 180) {
      console.warn(`Сгенерировано только ${facts.length} фактов, нужно больше`);
    }

    // Форматируем для использования в коде
    const formatted = facts.map(fact => {
      // Убираем возможные префиксы типа "- " или "* "
      const cleaned = fact.replace(/^[-*•]\s*/, "").trim();
      // Оборачиваем в кавычки и добавляем запятую
      return `  "${cleaned}"`;
    }).join(",\n");

    console.log("// Интересные факты для отображения во время генерации");
    console.log("const INTERESTING_FACTS = [");
    console.log(formatted);
    console.log("];");
    
    console.error(`\n✅ Сгенерировано ${facts.length} фактов`);
    
  } catch (error) {
    console.error("Ошибка при генерации фактов:", error.message);
    process.exit(1);
  }
}

generateFacts();

