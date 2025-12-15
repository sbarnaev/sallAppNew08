import Link from "next/link";

export default function SubscriptionExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50 p-4">
      <div className="max-w-2xl w-full">
        <div className="card p-8 sm:p-12 text-center space-y-6 bg-gradient-to-br from-white via-red-50/30 to-white border-2 border-red-200">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center text-5xl shadow-lg">
            ⏰
          </div>
          
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Доступ к системе истёк
            </h1>
            <p className="text-lg text-gray-700 leading-relaxed">
              Срок вашей подписки истёк. Для продолжения работы необходимо продлить доступ.
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Как продлить доступ?</h2>
            <p className="text-gray-700 leading-relaxed">
              Напишите в Telegram для продления подписки:
            </p>
            <div className="flex items-center justify-center gap-3">
              <a
                href="https://t.me/roman_acc"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-lg hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                @roman_acc
              </a>
            </div>
            <p className="text-sm text-gray-600 mt-4">
              После продления доступа вы сможете продолжить работу с системой
            </p>
          </div>

          <div className="pt-4">
            <Link
              href="/login"
              className="text-brand-600 hover:text-brand-700 font-semibold"
            >
              ← Вернуться на страницу входа
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

