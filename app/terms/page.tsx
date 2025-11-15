export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 space-y-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Пользовательское соглашение</h1>
          <p className="text-sm text-gray-500">Последнее обновление: {new Date().toLocaleDateString("ru-RU")}</p>

          <div className="prose prose-lg max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Общие положения</h2>
              <p className="text-gray-700 leading-relaxed">
                1.1. Настоящее Пользовательское соглашение (далее — «Соглашение») определяет условия использования 
                веб-приложения САЛ ПРОФИ (далее — «Сервис») и регулирует отношения между администрацией Сервиса 
                (далее — «Администрация») и пользователем (далее — «Пользователь»).
              </p>
              <p className="text-gray-700 leading-relaxed">
                1.2. Используя Сервис, Пользователь соглашается с условиями настоящего Соглашения. 
                Если Пользователь не согласен с условиями Соглашения, он должен прекратить использование Сервиса.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Регистрация и аккаунт</h2>
              <p className="text-gray-700 leading-relaxed">
                2.1. Для использования Сервиса Пользователь должен пройти регистрацию, используя предоставленный 
                код регистрации.
              </p>
              <p className="text-gray-700 leading-relaxed">
                2.2. Пользователь обязуется предоставлять достоверную и актуальную информацию при регистрации 
                и использовании Сервиса.
              </p>
              <p className="text-gray-700 leading-relaxed">
                2.3. Пользователь несет ответственность за сохранность своих учетных данных и за все действия, 
                совершенные с использованием его аккаунта.
              </p>
              <p className="text-gray-700 leading-relaxed">
                2.4. Пользователь обязуется немедленно уведомлять Администрацию о любом несанкционированном 
                использовании его аккаунта.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Использование Сервиса</h2>
              <p className="text-gray-700 leading-relaxed">
                3.1. Пользователь имеет право использовать Сервис в соответствии с его функциональными 
                возможностями и назначением.
              </p>
              <p className="text-gray-700 leading-relaxed">
                3.2. Пользователь обязуется не использовать Сервис для незаконных целей или в нарушение 
                законодательства Российской Федерации.
              </p>
              <p className="text-gray-700 leading-relaxed">
                3.3. Запрещается передача своего аккаунта третьим лицам, а также использование аккаунта 
                другого пользователя.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Интеллектуальная собственность</h2>
              <p className="text-gray-700 leading-relaxed">
                4.1. Все материалы Сервиса, включая дизайн, тексты, графику, программное обеспечение, 
                являются объектами интеллектуальной собственности Администрации.
              </p>
              <p className="text-gray-700 leading-relaxed">
                4.2. Пользователь не имеет права копировать, распространять, изменять или использовать 
                материалы Сервиса без письменного разрешения Администрации.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Ответственность</h2>
              <p className="text-gray-700 leading-relaxed">
                5.1. Администрация не несет ответственности за ущерб, причиненный Пользователю в результате 
                использования или невозможности использования Сервиса.
              </p>
              <p className="text-gray-700 leading-relaxed">
                5.2. Администрация не гарантирует бесперебойную работу Сервиса и не несет ответственности 
                за временные сбои в его работе.
              </p>
              <p className="text-gray-700 leading-relaxed">
                5.3. Пользователь несет полную ответственность за содержание данных, которые он размещает 
                в Сервисе.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Изменение условий</h2>
              <p className="text-gray-700 leading-relaxed">
                6.1. Администрация оставляет за собой право в любое время изменять условия настоящего 
                Соглашения.
              </p>
              <p className="text-gray-700 leading-relaxed">
                6.2. Изменения вступают в силу с момента их публикации на странице Соглашения. 
                Продолжение использования Сервиса после внесения изменений означает согласие Пользователя 
                с новыми условиями.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Контакты</h2>
              <p className="text-gray-700 leading-relaxed">
                По всем вопросам, связанным с использованием Сервиса, Пользователь может обращаться 
                к Администрации через контактные данные, указанные в Сервисе.
              </p>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <a
              href="/register"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Вернуться к регистрации
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

