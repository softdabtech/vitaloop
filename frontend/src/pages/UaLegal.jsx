import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import { CTA_CLASS, UaFooter, UaHeader, getUaAuthPath, getUaPath } from './UaLanding.jsx'

const UPDATED_AT = '14 липня 2026 року'

function LegalLayout({ title, description, canonicalPath, children }) {
  return (
    <div className="min-h-screen bg-[#f8f5f0] text-[#0f172a]">
      <Seo
        title={`${title} | Vitaloop Ukraine`}
        description={description}
        canonicalUrl={`https://ua.vitaloop.today${canonicalPath}`}
        locale="uk_UA"
      />
      <UaHeader />
      <main>
        <header className="border-b border-[#e5dfd6] bg-white">
          <div className="mx-auto max-w-[900px] px-4 py-12 sm:px-6 sm:py-16">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0f766e]">Vitaloop Ukraine</p>
            <h1 className="mt-3 text-[34px] font-black leading-tight tracking-tight sm:text-[48px]">{title}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#475569]">{description}</p>
            <p className="mt-4 text-sm font-semibold text-[#64748b]">Оновлено: {UPDATED_AT}</p>
          </div>
        </header>
        <article className="mx-auto max-w-[900px] px-4 py-10 sm:px-6 sm:py-14">
          <div className="space-y-8 rounded-[28px] border border-[#e5dfd6] bg-white p-6 shadow-sm sm:p-9">
            {children}
          </div>
        </article>
      </main>
      <UaFooter />
    </div>
  )
}

function Section({ title, children, id }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-black text-[#0f172a] sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-[#475569]">{children}</div>
    </section>
  )
}

export function UaPrivacy() {
  return (
    <LegalLayout
      title="Політика конфіденційності"
      description="Як Vitaloop збирає, використовує, захищає та видаляє персональні й медичні дані користувачів."
      canonicalPath="/privacy-policy/"
    >
      <Section title="Які дані ми обробляємо">
        <p>Дані облікового запису, відповіді про самопочуття, завантажені лабораторні результати, нормалізовані біомаркери, сформовані освітні підсумки та технічні журнали безпеки.</p>
        <p>Не додавайте до вільних полів інформацію, яка не потрібна для аналізу стану.</p>
      </Section>
      <Section title="Навіщо потрібні дані">
        <p>Щоб надати функції сервісу, зберегти історію результатів, сформувати пояснення, забезпечити безпеку, підтримку та виконати законні запити користувача.</p>
        <p>Vitaloop не продає персональні або медичні дані.</p>
      </Section>
      <Section title="Технічні постачальники">
        <p>Для хостингу, автентифікації, зберігання, аналітики помилок і обробки запитів можуть залучатися перевірені постачальники. Їм передається лише обсяг даних, потрібний для відповідної функції та захищений договірними й технічними заходами.</p>
      </Section>
      <Section title="Зберігання та захист">
        <p>Доступ до даних обмежений авторизацією та ролями. Строк зберігання залежить від типу даних, активності акаунта, законних вимог і необхідності захистити сервіс від зловживань.</p>
        <p>Жодна система не гарантує абсолютної безпеки, тому ми регулярно переглядаємо доступи, журнали та технічні засоби захисту.</p>
      </Section>
      <Section title="Ваші права">
        <p>Ви можете запросити доступ, експорт, виправлення або видалення даних. Напишіть на <a className="font-bold text-[#0f766e] underline" href="mailto:privacy@vitaloop.today">privacy@vitaloop.today</a>. Для захисту акаунта ми можемо попросити підтвердити особу.</p>
      </Section>
      <Section id="cookies" title="Cookie та локальне сховище">
        <p>Необхідні cookie підтримують вхід і базову роботу сервісу. Необов’язкові cookie використовуються лише після вашої згоди. Налаштування можна змінити кнопкою «Керування cookie» у футері.</p>
      </Section>
      <Section title="Контакти">
        <p>Питання щодо приватності: <a className="font-bold text-[#0f766e] underline" href="mailto:privacy@vitaloop.today">privacy@vitaloop.today</a>. Загальна підтримка: <a className="font-bold text-[#0f766e] underline" href="mailto:support@vitaloop.today">support@vitaloop.today</a>.</p>
      </Section>
    </LegalLayout>
  )
}

export function UaTerms() {
  return (
    <LegalLayout
      title="Умови використання"
      description="Основні правила користування Vitaloop Ukraine та важливі обмеження освітнього сервісу."
      canonicalPath="/terms/"
    >
      <Section title="Освітній характер сервісу">
        <p>Vitaloop структурує симптоми, лабораторні показники й загальний контекст, але не є медичним закладом, не встановлює діагнози та не призначає лікування.</p>
        <p>За невідкладних симптомів звертайтеся до екстреної медичної допомоги. Не відкладайте консультацію через інформацію в сервісі.</p>
      </Section>
      <Section title="Акаунт і точність даних">
        <p>Ви відповідаєте за безпеку доступу до акаунта та перевірку завантажених або автоматично розпізнаних показників. Не використовуйте чужі дані без законних підстав і дозволу.</p>
      </Section>
      <Section title="Допустиме використання">
        <p>Заборонено обходити захист, перевантажувати сервіс, автоматично збирати дані без дозволу, завантажувати шкідливі файли або використовувати Vitaloop для незаконної дискримінації чи медичних рішень без участі кваліфікованого спеціаліста.</p>
      </Section>
      <Section title="Підписка та доступ">
        <p>Безкоштовні й платні можливості відображаються на сторінці тарифів. Умови оплати, поновлення та скасування показуються перед підтвердженням покупки.</p>
      </Section>
      <Section title="Доступність і відповідальність">
        <p>Ми працюємо над стабільністю та точністю, але не гарантуємо безперервну роботу або відсутність помилок у вхідних даних, розпізнаванні чи освітніх поясненнях. Критичні рішення щодо здоров’я потрібно перевіряти з лікарем.</p>
      </Section>
      <Section title="Зміни та контакти">
        <p>Умови можуть оновлюватися разом із продуктом і законодавчими вимогами. Актуальна дата зазначена на початку сторінки. Питання: <a className="font-bold text-[#0f766e] underline" href="mailto:support@vitaloop.today">support@vitaloop.today</a>.</p>
      </Section>
    </LegalLayout>
  )
}

export function UaAbout() {
  return (
    <LegalLayout
      title="Про Vitaloop Ukraine"
      description="Український сервіс, що допомагає зібрати самопочуття, лабораторні показники й динаміку в одну зрозумілу картину."
      canonicalPath="/about/"
    >
      <Section title="Навіщо ми створюємо Vitaloop">
        <p>Лабораторний бланк показує цифри, але часто не пояснює, як вони пов’язані із самопочуттям і що варто обговорити далі. Vitaloop створений як спокійний освітній маршрут між симптомами, результатами та консультацією.</p>
      </Section>
      <Section title="Як працює платформа">
        <p>Єдине ядро аналізу нормалізує біомаркери, враховує симптоми, профіль і контекст безпеки, застосовує версіоновану базу знань та формує структурований підсумок із поясненнями, повторними перевірками й питаннями до лікаря.</p>
      </Section>
      <Section title="Український контекст">
        <p>Інтерфейс, пояснення та освітні матеріали створюються українською. Сервіс орієнтується на лабораторні формати, одиниці та звичний шлях користувачів в Україні, не називаючи лабораторії партнерами без офіційної домовленості.</p>
      </Section>
      <Section title="Наші принципи">
        <p>Не ставити діагнозів. Показувати, які дані використано і чому зроблено висновок. Позначати обмеження та якість даних. Відділяти редакційний матеріал від медичної перевірки. Зберігати контроль користувача над його даними.</p>
      </Section>
      <div className="flex flex-wrap gap-3 border-t border-[#e5dfd6] pt-7">
        <Link to={getUaPath('/health-hub')} className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#d8d1c8] bg-white px-5 py-3 text-sm font-black text-[#0f172a] hover:border-[#14b8a6]/50 hover:text-[#0f766e]">
          Відкрити Центр знань
        </Link>
        <Link to={getUaAuthPath({ signup: true })} className={CTA_CLASS}>Почати безкоштовно</Link>
      </div>
    </LegalLayout>
  )
}
