import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const indexPath = path.join(distDir, 'index.html')
const uaIndexPath = path.join(distDir, 'ua-index.html')

const UA = {
  title: 'Vitaloop Ukraine — персональна оцінка симптомів і аналізів',
  description:
    'Постійна втома, поганий сон чи низька енергія? Vitaloop допоможе знайти можливі причини, пріоритети аналізів і персональний план дій.',
  url: 'https://ua.vitaloop.today/',
  image: 'https://ua.vitaloop.today/images/ua-og-preview-20260604.png',
  imageAlt: 'Vitaloop Ukraine — персональна оцінка симптомів, аналізів і плану дій',
}

const UA_STATIC_PAGES = [
  {
    path: 'samopochuttia',
    title: 'Самопочуття — оцінка симптомів і пріоритетів | VITALOOP Україна',
    description: 'Опишіть втому, сон, енергію та інші симптоми, щоб отримати освітній підсумок і питання для консультації.',
    canonical: 'https://ua.vitaloop.today/samopochuttia/',
    en: 'https://vitaloop.today/symptom-intake/',
    h1: 'Оцініть самопочуття без самодіагностики',
    eyebrow: 'Самопочуття · симптоми · контекст',
    intro: 'Короткий опитувальник допомагає структурувати втому, сон, енергію, травлення та інші сигнали, щоб далі звʼязати їх з аналізами і безпечними наступними кроками.',
  },
  {
    path: 'symptomy',
    title: 'Симптоми — зрозуміла підготовка до перевірки | VITALOOP Україна',
    description: 'Структуруйте симптоми, тривалість і контекст без самодіагностики та підготуйте наступний медичний крок.',
    canonical: 'https://ua.vitaloop.today/symptomy/',
    en: 'https://vitaloop.today/symptom-intake/',
    h1: 'Симптоми, які варто розібрати разом з аналізами',
    eyebrow: 'Симптоми · тривалість · пріоритети',
    intro: 'VITALOOP не ставить діагноз. Сервіс допомагає зібрати скарги, тривалість, контекст і питання, які варто обговорити з лікарем або фахівцем.',
  },
  {
    path: 'analizy',
    title: 'Аналізи українською — PDF, фото і біомаркери | VITALOOP Україна',
    description: 'Завантажуйте PDF, фото або скан лабораторного бланка, щоб побачити показники, референси і пріоритети.',
    canonical: 'https://ua.vitaloop.today/analizy/',
    en: 'https://vitaloop.today/features/',
    h1: 'Завантажуйте аналізи і бачте зрозумілий підсумок',
    eyebrow: 'Аналізи · біомаркери · динаміка',
    intro: 'Сервіс витягує показники з PDF, фото або скану, нормалізує одиниці та показує, які маркери потребують уваги, що стабільне і що варто перевірити далі.',
  },
  {
    path: 'laboratorii',
    title: 'Бланки лабораторій — PDF, фото, скани | VITALOOP Україна',
    description: 'Vitaloop працює з бланками з українських лабораторій, якщо видно назви показників, значення, одиниці й референси.',
    canonical: 'https://ua.vitaloop.today/laboratorii/',
    en: 'https://vitaloop.today/features/',
    h1: 'PDF, фото або скан з українських лабораторій',
    eyebrow: 'Сінево · Діла · Ескулаб · інші',
    intro: 'Найкраще працюють повні сторінки, де видно назви показників, значення, одиниці виміру, референси та дату аналізу. Якщо лабораторії ще немає в базі, файл усе одно можна завантажити.',
  },
  {
    path: 'tarify',
    title: 'Тарифи VITALOOP Україна — безкоштовний старт і Premium',
    description: 'Порівняйте Free і Premium: стартова оцінка, завантаження аналізів, пояснення показників, динаміка і план дій.',
    canonical: 'https://ua.vitaloop.today/tarify/',
    en: 'https://vitaloop.today/pricing/',
    h1: 'Free для старту, Premium для повного розбору аналізів',
    eyebrow: 'Тарифи · доступ · Premium',
    intro: 'Почніть з безкоштовної оцінки самопочуття. Premium відкриває розбір аналізів, пояснення маркерів, динаміку, план дій і повторні перевірки.',
  },
  {
    path: 'pricing',
    title: 'Тарифи VITALOOP Україна — безкоштовний старт і Premium',
    description: 'Порівняйте Free і Premium: стартова оцінка, завантаження аналізів, пояснення показників, динаміка і план дій.',
    canonical: 'https://ua.vitaloop.today/tarify/',
    en: 'https://vitaloop.today/pricing/',
    h1: 'Free для старту, Premium для повного розбору аналізів',
    eyebrow: 'Тарифи · доступ · Premium',
    intro: 'Почніть з безкоштовної оцінки самопочуття. Premium відкриває розбір аналізів, пояснення маркерів, динаміку, план дій і повторні перевірки.',
  },
  {
    path: 'faq',
    title: 'Питання та відповіді — аналізи, симптоми, безпека | VITALOOP Україна',
    description: 'Відповіді про аналізи, симптоми, безпеку даних, Premium-доступ і межі сервісу: це не діагноз і не заміна лікаря.',
    canonical: 'https://ua.vitaloop.today/faq/',
    en: 'https://vitaloop.today/faq/',
    h1: 'Коротко про аналізи, симптоми і безпеку',
    eyebrow: 'FAQ · межі сервісу · підтримка',
    intro: 'Відповіді на часті питання про завантаження аналізів, роботу з симптомами, приватність, Premium-доступ і те, чому VITALOOP не замінює лікаря.',
  },
  {
    path: 'privacy-policy',
    title: 'Політика приватності | VITALOOP Україна',
    description: 'Як Vitaloop обробляє облікові дані, завантажені аналізи, симптоми, cookie, доступ, видалення і запити підтримки.',
    canonical: 'https://ua.vitaloop.today/privacy-policy/',
    en: 'https://vitaloop.today/privacy-policy/',
    h1: 'Політика приватності',
    eyebrow: 'Приватність · дані · видалення',
    intro: 'Ми описуємо, які дані обробляються, як використовуються завантажені аналізи і симптоми, як працюють cookie та як звернутися щодо доступу або видалення даних.',
  },
  {
    path: 'terms',
    title: 'Умови користування | VITALOOP Україна',
    description: 'Правила використання Vitaloop, освітній характер сервісу, обмеження відповідальності та контакт підтримки.',
    canonical: 'https://ua.vitaloop.today/terms/',
    en: 'https://vitaloop.today/terms/',
    h1: 'Умови користування',
    eyebrow: 'Умови · дисклеймер · підтримка',
    intro: 'VITALOOP є освітнім сервісом для роботи з симптомами та аналізами. Він не ставить діагноз, не призначає лікування і не замінює медичну консультацію.',
  },
  {
    path: 'refund-policy',
    title: 'Політика повернення | VITALOOP Україна',
    description: 'Умови скасування, повернення коштів і звернення до підтримки щодо Premium-доступу Vitaloop.',
    canonical: 'https://ua.vitaloop.today/refund-policy/',
    en: 'https://vitaloop.today/refund-policy/',
    h1: 'Повернення, скасування і підтримка платежів',
    eyebrow: 'Повернення · скасування · Premium',
    intro: 'Запити щодо скасування, повернення або доступу Premium розглядаються підтримкою. Дані аналізів, симптоми і звіти не передаються платіжним інструментам.',
  },
  {
    path: 'contact',
    title: 'Контакти підтримки | VITALOOP Україна',
    description: 'Звертайтеся до Vitaloop щодо акаунта, приватності, видалення даних, Premium-доступу або партнерства.',
    canonical: 'https://ua.vitaloop.today/contact/',
    en: 'https://vitaloop.today/contact/',
    h1: 'Як звʼязатися з VITALOOP',
    eyebrow: 'Контакти · підтримка · приватність',
    intro: 'Пишіть щодо акаунта, завантаження аналізів, Premium-доступу, приватності, видалення даних або партнерства на info@softdab.tech.',
  },
]

function uaStaticFallback(page) {
  return `<div id="root"><main data-crawler-content="true" style="min-height: 100vh; font-family: Inter, Arial, sans-serif; color: #0f172a; background: #f8f5f0;">
      <header style="height: 68px; border-bottom: 1px solid #e5dfd6; background: rgba(255,255,255,0.96);">
        <div style="width: min(1120px, 100%); height: 100%; margin: 0 auto; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box;">
          <a href="/" style="display: inline-flex; align-items: center; gap: 8px; color: #0f172a; text-decoration: none; font-weight: 900;"><img src="/images/ua-vitaloop-mark-160-20260606.png" alt="" style="width: 32px; height: 32px; border-radius: 10px;" /><span><span style="color: #1f6ed4;">VITA</span><span style="color: #f4c542;">LOOP</span> 🇺🇦</span></a>
          <a href="/login?signup=true&amp;lang=uk&amp;from=ua" style="border-radius: 999px; background: #0f766e; color: #fff; padding: 10px 14px; text-decoration: none; font-size: 14px; font-weight: 900;">Почати</a>
        </div>
      </header>
      <section style="border-bottom: 1px solid #e5dfd6; background: linear-gradient(135deg, #f8f5f0 0%, #ffffff 100%);">
        <div style="width: min(1120px, 100%); margin: 0 auto; padding: 56px 20px 48px; box-sizing: border-box;">
          <p style="display: inline-flex; margin: 0; border: 1px solid #d7efe8; border-radius: 999px; background: #ecfdf5; padding: 8px 12px; font-size: 12px; line-height: 1; font-weight: 900; letter-spacing: 0.10em; text-transform: uppercase; color: #0f766e;">${page.eyebrow}</p>
          <h1 style="margin: 22px 0 0; max-width: 820px; font-size: clamp(34px, 7vw, 62px); line-height: 1.06; letter-spacing: -0.02em; font-weight: 900;">${page.h1}</h1>
          <p style="margin: 20px 0 0; max-width: 720px; font-size: 18px; line-height: 1.75; color: #334155;">${page.intro}</p>
          <p style="margin: 18px 0 0; max-width: 720px; font-size: 14px; line-height: 1.65; color: #64748b;">Це освітній сервіс і не замінює консультацію лікаря.</p>
          <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px;">
            <a href="/login?signup=true&amp;lang=uk&amp;from=ua" style="display: inline-flex; min-height: 48px; align-items: center; justify-content: center; border-radius: 999px; background: linear-gradient(135deg,#0f766e 0%,#14b8a6 58%,#d4b483 135%); padding: 12px 20px; color: #fff; text-decoration: none; font-size: 15px; font-weight: 900;">Отримати персональну оцінку →</a>
            <a href="/" style="display: inline-flex; min-height: 48px; align-items: center; justify-content: center; border: 1px solid #e5dfd6; border-radius: 999px; background: #fff; padding: 12px 20px; color: #0f172a; text-decoration: none; font-size: 15px; font-weight: 900;">На головну</a>
          </div>
        </div>
      </section>
      <section style="width: min(1120px, 100%); margin: 0 auto; padding: 36px 20px 56px; box-sizing: border-box;">
        <div style="display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
          <article style="border: 1px solid #e5dfd6; border-radius: 22px; background: #fff; padding: 20px;"><h2 style="margin: 0; font-size: 20px;">Що робить VITALOOP</h2><p style="color: #475569; line-height: 1.65;">Поєднує симптоми, лабораторні показники, референси, дати аналізів і безпечні пояснення.</p></article>
          <article style="border: 1px solid #e5dfd6; border-radius: 22px; background: #fff; padding: 20px;"><h2 style="margin: 0; font-size: 20px;">Що отримує користувач</h2><p style="color: #475569; line-height: 1.65;">Пріоритети, зрозумілий підсумок, питання для лікаря, динаміку та наступний крок.</p></article>
          <article style="border: 1px solid #e5dfd6; border-radius: 22px; background: #fff; padding: 20px;"><h2 style="margin: 0; font-size: 20px;">Межі сервісу</h2><p style="color: #475569; line-height: 1.65;">VITALOOP не ставить діагноз, не призначає лікування і не замінює медичного фахівця.</p></article>
        </div>
      </section>
    </main></div>`
}

const uaRootFallback = `<div id="root"><main data-crawler-content="true" style="min-height: 100vh; font-family: Inter, Arial, sans-serif; color: #0f172a; background: #f8f5f0;">
      <header style="position: sticky; top: 0; z-index: 2; height: 68px; border-bottom: 1px solid #e5dfd6; background: rgba(255,255,255,0.96); box-shadow: 0 10px 30px rgba(15,23,42,0.06);">
        <div style="width: min(1200px, 100%); height: 100%; margin: 0 auto; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box;">
          <div style="display: inline-flex; align-items: center; gap: 8px;">
            <span style="display: inline-flex; width: 36px; height: 36px; align-items: center; justify-content: center; border-radius: 12px; background: #fff;"><img src="/images/ua-vitaloop-mark-160-20260606.png" alt="" style="width: 32px; height: 32px; object-fit: contain;" /></span>
            <span style="font-size: 21px; font-weight: 900; letter-spacing: 0.02em;"><span style="color: #1f6ed4;">VITA</span><span style="color: #f4c542;">LOOP</span></span>
            <span style="display: inline-flex; width: 32px; height: 32px; align-items: center; justify-content: center; border: 1px solid #e5dfd6; border-radius: 999px; background: #fff; box-shadow: 0 2px 8px rgba(15,23,42,0.08);">🇺🇦</span>
          </div>
          <span style="display: inline-flex; width: 44px; height: 44px; align-items: center; justify-content: center; border: 1px solid #e5dfd6; border-radius: 999px; background: #fff; color: #0f172a; font-size: 28px; line-height: 1;">≡</span>
        </div>
      </header>
      <section style="position: relative; min-height: 690px; overflow: hidden; border-bottom: 1px solid #e5dfd6; background: #f8f5f0;">
        <img src="/images/ua-health-hero-dashboard-ua-20260606.jpg" alt="" fetchpriority="high" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 57% center; opacity: 0.9;" />
        <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(248,245,240,0.20) 0%, rgba(248,245,240,0.48) 58%, rgba(248,245,240,0.96) 100%);"></div>
        <div style="position: relative; width: min(1200px, 100%); margin: 0 auto; padding: 44px 20px 32px; box-sizing: border-box;">
          <section style="max-width: 680px; border: 1px solid rgba(255,255,255,0.8); border-radius: 32px; background: rgba(255,255,255,0.74); padding: 20px; box-shadow: 0 24px 70px rgba(15,23,42,0.12); backdrop-filter: blur(16px);">
            <p style="display: inline-flex; margin: 0; border: 1px solid #e5dfd6; border-radius: 999px; background: rgba(255,255,255,0.88); padding: 8px 12px; font-size: 11px; line-height: 1; font-weight: 900; letter-spacing: 0.10em; text-transform: uppercase; color: #0f766e;">Симптоми · причини · план дій</p>
            <h1 style="margin: 22px 0 0; max-width: 680px; font-size: clamp(34px, 9vw, 66px); line-height: 1.05; letter-spacing: -0.02em; font-weight: 900;">Постійна втома? Поганий сон? Низька енергія?</h1>
            <p style="margin: 20px 0 0; max-width: 600px; font-size: 17px; line-height: 1.7; color: #334155;">Знайдіть можливу причину та отримайте персональний план дій. Почніть із симптомів або завантажте аналізи, якщо вони вже є.</p>
            <div style="display: grid; gap: 12px; margin-top: 28px;">
              <a href="/login?signup=true&amp;lang=uk&amp;from=ua" style="display: inline-flex; min-height: 48px; align-items: center; justify-content: center; border-radius: 999px; background: linear-gradient(135deg,#0f766e 0%,#14b8a6 58%,#d4b483 135%); padding: 12px 20px; color: #fff; text-decoration: none; font-size: 15px; font-weight: 900; box-shadow: 0 14px 34px rgba(15,118,110,0.24);">Отримати персональну оцінку →</a>
              <a href="#result-example" style="display: inline-flex; min-height: 44px; align-items: center; justify-content: center; border: 1px solid #e5dfd6; border-radius: 999px; background: #fff; padding: 12px 20px; color: #0f172a; text-decoration: none; font-size: 15px; font-weight: 900;">Переглянути приклад</a>
            </div>
          </section>
        </div>
      </section>
    </main></div>`

const uaCriticalCss = `<style id="ua-critical-shell">
      html, body, #root { margin: 0; min-width: 100%; min-height: 100%; background: #f8f5f0; }
      body { overflow-x: hidden; }
      #root > main[data-crawler-content="true"] { width: 100vw; min-width: 100vw; overflow-x: hidden; box-sizing: border-box; }
      #root > main[data-crawler-content="true"] * { box-sizing: border-box; }
    </style>`

function replaceTag(html, pattern, replacement) {
  return html.replace(pattern, replacement)
}

function upsertAfter(html, anchorPattern, marker, tag) {
  if (html.includes(marker)) return html
  return html.replace(anchorPattern, (match) => `${match}\n    ${tag}`)
}

let html = await readFile(indexPath, 'utf8')

html = html
  .replace('<html lang="en"', '<html lang="uk"')
  .replace('content="Vitaloop"', 'content="Vitaloop Ukraine"')

html = replaceTag(html, /<title>[\s\S]*?<\/title>/, `<title>${UA.title}</title>`)
html = replaceTag(html, /<meta name="description" content="[^"]*"[^>]*\/>/, `<meta name="description" content="${UA.description}" data-rh="true" />`)
html = replaceTag(html, /<meta name="keywords" content="[^"]*" \/>/, '<meta name="keywords" content="самопочуття, симптоми, аналізи, лабораторні аналізи, здоровʼя українською, Vitaloop Ukraine" />')
html = replaceTag(html, /<link rel="canonical" href="[^"]*"[^>]*\/>/, `<link rel="canonical" href="${UA.url}" data-rh="true" />`)
html = replaceTag(html, /<meta property="og:title" content="[^"]*"[^>]*\/>/, `<meta property="og:title" content="${UA.title}" data-rh="true" />`)
html = replaceTag(html, /<meta property="og:description" content="[^"]*"[^>]*\/>/, `<meta property="og:description" content="${UA.description}" data-rh="true" />`)
html = replaceTag(html, /<meta property="og:url" content="[^"]*"[^>]*\/>/, `<meta property="og:url" content="${UA.url}" data-rh="true" />`)
html = replaceTag(html, /<meta property="og:site_name" content="[^"]*"[^>]*\/>/, '<meta property="og:site_name" content="VITALOOP Ukraine" data-rh="true" />')
html = replaceTag(html, /<meta property="og:image" content="[^"]*"[^>]*\/>/, `<meta property="og:image" content="${UA.image}" data-rh="true" />`)
html = replaceTag(html, /<meta property="og:image:alt" content="[^"]*"[^>]*\/>/, `<meta property="og:image:alt" content="${UA.imageAlt}" data-rh="true" />`)
html = replaceTag(html, /<meta property="og:locale" content="[^"]*"[^>]*\/>/, '<meta property="og:locale" content="uk_UA" data-rh="true" />')
html = replaceTag(html, /<meta name="twitter:title" content="[^"]*"[^>]*\/>/, `<meta name="twitter:title" content="${UA.title}" data-rh="true" />`)
html = replaceTag(html, /<meta name="twitter:description" content="[^"]*"[^>]*\/>/, `<meta name="twitter:description" content="${UA.description}" data-rh="true" />`)
html = replaceTag(html, /<meta name="twitter:image" content="[^"]*"[^>]*\/>/, `<meta name="twitter:image" content="${UA.image}" data-rh="true" />`)
html = replaceTag(html, /<meta name="twitter:image:alt" content="[^"]*"[^>]*\/>/, `<meta name="twitter:image:alt" content="${UA.imageAlt}" data-rh="true" />`)
html = html.replace(/\s*<link rel="alternate" hreflang="[^"]+" href="[^"]*" \/>/g, '')
html = upsertAfter(
  html,
  /<link rel="canonical" href="[^"]*"[^>]*\/>/,
  'hreflang="uk-UA"',
  `<link rel="alternate" hreflang="uk-UA" href="${UA.url}" />
    <link rel="alternate" hreflang="en" href="https://vitaloop.today/" />
    <link rel="alternate" hreflang="x-default" href="https://vitaloop.today/" />`,
)

html = upsertAfter(
  html,
  /<meta property="og:image" content="[^"]*" \/>/,
  'og:image:secure_url',
  `<meta property="og:image:secure_url" content="${UA.image}" />`,
)
html = upsertAfter(
  html,
  /<meta property="og:image:height" content="630" \/>/,
  'og:image:type',
  '<meta property="og:image:type" content="image/png" />',
)
html = upsertAfter(
  html,
  /<meta name="twitter:card" content="summary_large_image" \/>/,
  'twitter:url',
  `<meta name="twitter:url" content="${UA.url}" />`,
)
html = upsertAfter(
  html,
  /<meta name="viewport" content="[^"]*" \/>/,
  'ua-critical-shell',
  uaCriticalCss,
)
html = upsertAfter(
  html,
  /<style id="ua-critical-shell">[\s\S]*?<\/style>/,
  'ua-health-hero-dashboard-ua-20260606',
  '<link rel="preload" as="image" href="/images/ua-health-hero-dashboard-ua-20260606.jpg" fetchpriority="high" />\n    <link rel="preload" as="image" href="/images/ua-vitaloop-mark-160-20260606.png" />',
)

const uaJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://ua.vitaloop.today/#organization',
    name: 'VITALOOP Ukraine',
    url: 'https://ua.vitaloop.today/',
    logo: 'https://ua.vitaloop.today/images/ua-vitaloop-mark-20260603.png',
    description: UA.description,
    areaServed: 'UA',
    knowsLanguage: ['uk-UA'],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://ua.vitaloop.today/#website',
    url: 'https://ua.vitaloop.today/',
    name: 'VITALOOP Ukraine',
    description: UA.description,
    inLanguage: 'uk-UA',
    publisher: { '@id': 'https://ua.vitaloop.today/#organization' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': 'https://ua.vitaloop.today/#app',
    name: 'VITALOOP Ukraine',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web',
    url: 'https://ua.vitaloop.today/',
    inLanguage: 'uk-UA',
    description: UA.description,
    offers: [
      { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'UAH' },
      { '@type': 'Offer', name: 'Premium', price: '399', priceCurrency: 'UAH' },
    ],
    publisher: { '@id': 'https://ua.vitaloop.today/#organization' },
  },
]

html = html.replace(/\s*<!-- JSON-LD:[\s\S]*?<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
html = html.replace(
  /\s*<!-- Google tag/,
  `\n    <!-- JSON-LD: UA structured data -->\n${uaJsonLd.map((schema) => `    <script type="application/ld+json">\n    ${JSON.stringify(schema, null, 2).replace(/\n/g, '\n    ')}\n    </script>`).join('\n\n')}\n\n    <!-- Google tag`,
)

html = html.replace(/<div id="root">[\s\S]*?<\/div>\s*(?=\n\s*<script id="vitaloop-cookie-consent-script">|\n\s*<script|\n\s*<\/body>|$)/, uaRootFallback)

html = html.replace(/\s*<script id="vite-plugin-pwa:register-sw" src="\/registerSW\.js"><\/script>/, '')
html = html.replace(
  /\s*<\/body>/,
  `\n    <script>\n      if ('serviceWorker' in navigator) {\n        navigator.serviceWorker.getRegistrations().then(function (registrations) {\n          registrations.forEach(function (registration) { registration.unregister(); });\n        });\n      }\n      if ('caches' in window) {\n        caches.keys().then(function (keys) {\n          keys.forEach(function (key) { caches.delete(key); });\n        });\n      }\n    </script>\n  </body>`,
)

await writeFile(uaIndexPath, html)

for (const page of UA_STATIC_PAGES) {
  let pageHtml = html
  pageHtml = pageHtml.replace(/<div id="root">[\s\S]*?<\/div>\s*(?=\n\s*<script id="vitaloop-cookie-consent-script">|\n\s*<script|\n\s*<\/body>|$)/, uaStaticFallback(page))
  pageHtml = replaceTag(pageHtml, /<title>[\s\S]*?<\/title>/, `<title>${page.title}</title>`)
  pageHtml = replaceTag(pageHtml, /<meta name="description" content="[^"]*"[^>]*\/>/, `<meta name="description" content="${page.description}" data-rh="true" />`)
  pageHtml = replaceTag(pageHtml, /<link rel="canonical" href="[^"]*"[^>]*\/>/, `<link rel="canonical" href="${page.canonical}" data-rh="true" />`)
  pageHtml = replaceTag(pageHtml, /<meta property="og:title" content="[^"]*"[^>]*\/>/, `<meta property="og:title" content="${page.title}" data-rh="true" />`)
  pageHtml = replaceTag(pageHtml, /<meta property="og:description" content="[^"]*"[^>]*\/>/, `<meta property="og:description" content="${page.description}" data-rh="true" />`)
  pageHtml = replaceTag(pageHtml, /<meta property="og:url" content="[^"]*"[^>]*\/>/, `<meta property="og:url" content="${page.canonical}" data-rh="true" />`)
  pageHtml = replaceTag(pageHtml, /<meta name="twitter:title" content="[^"]*"[^>]*\/>/, `<meta name="twitter:title" content="${page.title}" data-rh="true" />`)
  pageHtml = replaceTag(pageHtml, /<meta name="twitter:description" content="[^"]*"[^>]*\/>/, `<meta name="twitter:description" content="${page.description}" data-rh="true" />`)
  pageHtml = pageHtml.replace(/\s*<link rel="alternate" hreflang="[^"]+" href="[^"]*" \/>/g, '')
  pageHtml = upsertAfter(
    pageHtml,
    /<link rel="canonical" href="[^"]*"[^>]*\/>/,
    `hreflang="uk-UA" href="${page.canonical}"`,
    `<link rel="alternate" hreflang="uk-UA" href="${page.canonical}" />
    <link rel="alternate" hreflang="en" href="${page.en}" />
    <link rel="alternate" hreflang="x-default" href="${page.en}" />`,
  )
  const dir = path.join(distDir, page.path)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'index.html'), pageHtml)
}

console.log(`Created ${path.relative(process.cwd(), uaIndexPath)}`)
