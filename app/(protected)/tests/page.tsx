import Link from "next/link";
import { TESTS } from "@/lib/test-types";
import { TestClientSelector } from "@/components/TestClientSelector";

export default function TestsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const tests = Object.values(TESTS);
  const clientId = typeof searchParams?.clientId === "string" ? searchParams.clientId : undefined;

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-tight">
            Психологическое тестирование
          </h1>
          <p className="text-gray-600 text-base md:text-lg font-medium">
            Классические психологические тесты для оценки состояния клиентов
          </p>
        </div>
      </div>

      {/* Выбор клиента */}
      <TestClientSelector currentClientId={clientId} />

      {/* Список тестов */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tests.map((test) => {
          const colorClasses: Record<string, string> = {
            orange: "from-orange-500 to-orange-600 border-orange-200",
            blue: "from-blue-500 to-blue-600 border-blue-200",
            red: "from-red-500 to-red-600 border-red-200",
            yellow: "from-yellow-500 to-yellow-600 border-yellow-200",
            green: "from-green-500 to-green-600 border-green-200"
          };

          return (
            <Link
              key={test.id}
              href={`/tests/${test.id}${clientId ? `?clientId=${clientId}` : ""}`}
              className="card hover:shadow-soft-lg hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300 group bg-gradient-to-br from-white via-gray-50/30 to-white"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 bg-gradient-to-br ${colorClasses[test.color]} rounded-3xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    {test.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-brand-600 transition-colors leading-tight">
                      {test.name}
                    </h3>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {test.description}
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-500">
                    {test.questions.length} вопросов
                  </span>
                  <span className="text-sm font-semibold text-brand-600 group-hover:text-brand-700">
                    Пройти тест →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Информация */}
      <div className="space-y-4">
        <div className="card p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl shrink-0">
              ℹ️
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-2">О тестировании</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                Тесты можно проходить с привязкой к клиенту или без неё. Результаты сохраняются в истории клиента, 
                что позволяет отслеживать динамику изменений. Все тесты основаны на проверенных психологических методиках.
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-2xl shrink-0">
              ⚠️
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-2">Важное предупреждение</h3>
              <p className="text-sm text-gray-700 leading-relaxed mb-3">
                <strong>Все представленные опросники являются скрининговыми инструментами</strong> и не заменяют профессиональную диагностику. 
                Результаты предназначены для предварительной оценки и отслеживания динамики.
              </p>
              <p className="text-sm text-gray-700 leading-relaxed mb-3">
                <strong>Клинические тесты (PHQ-9, GAD-7):</strong> При высоких баллах рекомендуется консультация специалиста (психолог, психотерапевт, психиатр).
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong>При наличии суицидальных мыслей:</strong> Немедленно обратитесь за помощью к специалисту (психиатр, психотерапевт) или в службу экстренной помощи.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

