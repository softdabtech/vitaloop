import { readFile, writeFile } from 'node:fs/promises'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { UA_HUB_ARTICLES, UA_HUB_CLUSTERS } from '../src/data/uaHealthHubContent.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const indexPath = path.join(distDir, 'index.html')
const uaIndexPath = path.join(distDir, 'ua-index.html')
const uaStaticDir = path.join(distDir, 'ua-static')

mkdirSync(uaStaticDir, { recursive: true })

const UA = {
  title: 'Vitaloop Ukraine — персональна оцінка симптомів і аналізів',
  description:
    'Постійна втома, поганий сон чи низька енергія? Vitaloop допоможе знайти можливі причини, пріоритети аналізів і персональний план дій.',
  url: 'https://ua.vitaloop.today/',
  image: 'https://ua.vitaloop.today/images/ua-og-preview-20260604.png',
  imageAlt: 'Vitaloop Ukraine — персональна оцінка симптомів, аналізів і плану дій',
}

const UA_PUBLIC_ROUTES = [
  {
    path: '/',
    title: UA.title,
    description: UA.description,
    text: [
      'Vitaloop Ukraine допомагає структурувати симптоми, аналізи й наступні кроки українською мовою.',
      'Почніть із самопочуття або завантажте результати аналізів, якщо вони вже є.',
    ],
    priority: '1.0',
    changefreq: 'weekly',
  },
  {
    path: '/samopochuttia',
    title: 'Самопочуття — персональна оцінка симптомів | Vitaloop Ukraine',
    description: 'Опишіть втому, сон, енергію та інші сигнали, щоб отримати структурований підсумок і зрозумілий наступний крок.',
    text: ['Почніть із того, що відчуваєте. Vitaloop структурує симптоми й допомагає підготувати питання до лікаря.'],
    priority: '0.9',
    changefreq: 'weekly',
  },
  {
    path: '/symptomy',
    title: 'Розбір симптомів українською | Vitaloop Ukraine',
    description: 'Зберіть симптоми в одну картину: що турбує, як давно, що впливає і які питання варто поставити спеціалісту.',
    text: ['Розбір симптомів без паніки: тривалість, частота, звʼязок зі сном, стресом, харчуванням і ліками.'],
    priority: '0.9',
    changefreq: 'weekly',
  },
  {
    path: '/analizy',
    title: 'Аналізи крові українською | Vitaloop Ukraine',
    description: 'Завантажте PDF або фото аналізів і отримайте зрозумілий розбір показників, референсів, пріоритетів і повторної перевірки.',
    text: ['Vitaloop пояснює показники аналізів українською мовою й не замінює консультацію лікаря.'],
    priority: '0.9',
    changefreq: 'weekly',
  },
  {
    path: '/laboratorii',
    title: 'Завантаження аналізів з лабораторій | Vitaloop Ukraine',
    description: 'Vitaloop працює з PDF, фото або сканом результатів. Важлива якість файлу, видимі назви, значення, одиниці й референси.',
    text: ['Додавайте результати з вашої лабораторії, щоб отримати структурований підсумок у кабінеті.'],
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    path: '/tarify',
    title: 'Безкоштовний тариф і Premium | Vitaloop Ukraine',
    description: 'Почніть безкоштовно. Premium відкриває більше аналізів, динаміку, повніші пояснення й регулярну роботу зі станом.',
    text: ['Безкоштовний тариф підходить для старту, Premium — для регулярної роботи з аналізами й динамікою.'],
    priority: '0.7',
    changefreq: 'monthly',
  },
  {
    path: '/about',
    title: 'Про Vitaloop Ukraine',
    description: 'Український сервіс, що допомагає зібрати самопочуття, лабораторні показники й динаміку в одну зрозумілу картину.',
    text: ['Vitaloop поєднує симптоми, біомаркери, контекст безпеки та версіоновану базу знань в одному освітньому маршруті.'],
    priority: '0.6',
    changefreq: 'monthly',
  },
  {
    path: '/privacy-policy',
    title: 'Політика конфіденційності | Vitaloop Ukraine',
    description: 'Як Vitaloop збирає, використовує, захищає та видаляє персональні й медичні дані користувачів.',
    text: ['Права на доступ, експорт, виправлення та видалення даних, правила використання cookie і контакти з питань приватності.'],
    priority: '0.4',
    changefreq: 'monthly',
  },
  {
    path: '/terms',
    title: 'Умови використання | Vitaloop Ukraine',
    description: 'Основні правила користування Vitaloop Ukraine та важливі обмеження освітнього сервісу.',
    text: ['Vitaloop не встановлює діагнози, не призначає лікування та не замінює консультацію лікаря.'],
    priority: '0.4',
    changefreq: 'monthly',
  },
  {
    path: '/ferytyn',
    title: 'Феритин: що означає показник | Vitaloop Ukraine',
    description: 'Феритин показує запаси заліза. Дізнайтеся, чому його оцінюють при втомі, випадінні волосся і слабкості.',
    text: ['Феритин варто оцінювати разом із симптомами, загальним аналізом крові, харчуванням і клінічним контекстом.'],
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    path: '/vtoma',
    title: 'Постійна втома: можливі причини | Vitaloop Ukraine',
    description: 'Втома може бути повʼязана зі сном, дефіцитами, стресом, навантаженням або кількома факторами одночасно.',
    text: ['Vitaloop допомагає структурувати втому й визначити, які дані варто зібрати перед консультацією.'],
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    path: '/vitamin-d',
    title: 'Вітамін D: як читати результат | Vitaloop Ukraine',
    description: 'Результат вітаміну D потрібно читати в контексті одиниць, сезону, симптомів, способу життя й повторної перевірки.',
    text: ['Окреме число в бланку не пояснює весь стан. Потрібен контекст і безпечний план обговорення.'],
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    path: '/volossia',
    title: 'Випадіння волосся: симптоми й аналізи | Vitaloop Ukraine',
    description: 'Феритин, ТТГ, вітамін D, цинк і гормональний контекст можуть бути частиною розмови про випадіння волосся.',
    text: ['Vitaloop допомагає зібрати симптоми, аналізи й питання до спеціаліста в одному місці.'],
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    path: '/son',
    title: 'Сон і відновлення: що відстежувати | Vitaloop Ukraine',
    description: 'Опишіть засинання, пробудження, ранкову енергію, стрес і навантаження, щоб отримати більш точний наступний крок.',
    text: ['Сон варто описувати конкретно: якість, тривалість, пробудження, кофеїн, стрес і відновлення.'],
    priority: '0.8',
    changefreq: 'monthly',
  },
  {
    path: '/dity-analizy',
    title: 'Аналізи для дітей: як підготувати питання | Vitaloop Ukraine',
    description: 'Для дитячих питань важливо не робити висновки самостійно, а підготувати симптоми й результати до розмови з педіатром.',
    text: ['Vitaloop структурує інформацію, але рішення щодо дітей завжди має залишатися за лікарем.'],
    priority: '0.6',
    changefreq: 'monthly',
  },
  {
    path: '/health-hub',
    title: 'Центр знань — статті про аналізи й симптоми | Vitaloop Ukraine',
    description: 'Докладні пояснення аналізів крові, симптомів і біомаркерів українською мовою: феритин, вітамін D, ТТГ та інші показники.',
    text: ['Українська бібліотека матеріалів про симптоми, аналізи крові та підготовку до розмови з лікарем.'],
    priority: '0.9',
    changefreq: 'weekly',
  },
]

for (const cluster of UA_HUB_CLUSTERS) {
  UA_PUBLIC_ROUTES.push({
    path: `/health-hub/topics/${cluster.slug}`,
    title: `${cluster.title} — Центр знань | Vitaloop Ukraine`,
    description: cluster.description,
    text: [cluster.description],
    priority: '0.8',
    changefreq: 'monthly',
  })
}

for (const article of UA_HUB_ARTICLES) {
  UA_PUBLIC_ROUTES.push({
    path: `/health-hub/${article.slug}`,
    title: `${article.title} | Vitaloop Ukraine Центр знань`,
    description: article.description,
    text: [article.description, ...(article.keyPoints || [])],
    priority: '0.8',
    changefreq: 'monthly',
  })
}

const UA_PRIVATE_ROUTES = [
  '/login',
  '/dashboard',
  '/upload',
  '/lab-plan',
  '/avatar',
  '/assignments',
  '/lab-results',
  '/results',
  '/protocol',
  '/progress',
  '/settings',
  '/health-profile',
  '/subscription',
  '/billing-history',
  '/help-center',
  '/onboarding',
  '/questionnaire',
  '/check-ins',
  '/insights',
  '/ops',
  '/admin/dashboard',
  '/crm/programs',
  '/crm/clients',
  '/crm/practitioners',
  '/crm/activity',
]

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

html = html.replace(/<div id="root">[\s\S]*?<\/div>\s*(?=<\/body>|<script>|$)/, uaRootFallback)

html = html.replace(/\s*<script id="vite-plugin-pwa:register-sw" src="\/registerSW\.js"><\/script>/, '')
html = html.replace(
  /\s*<\/body>/,
  `\n    <script>\n      if ('serviceWorker' in navigator) {\n        navigator.serviceWorker.getRegistrations().then(function (registrations) {\n          registrations.forEach(function (registration) { registration.unregister(); });\n        });\n      }\n      if ('caches' in window) {\n        caches.keys().then(function (keys) {\n          keys.forEach(function (key) { caches.delete(key); });\n        });\n      }\n    </script>\n  </body>`,
)

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function canonicalPath(pathname) {
  return pathname === '/' ? '/' : `${pathname.replace(/\/+$/, '')}/`
}

function routeUrl(pathname) {
  return `https://ua.vitaloop.today${canonicalPath(pathname)}`
}

function writeRouteFile(pathname, contents) {
  if (pathname === '/') {
    return writeFile(path.join(uaStaticDir, 'index.html'), contents)
  }
  const routeDir = path.join(uaStaticDir, pathname.replace(/^\//, '').replace(/\/+$/, ''))
  mkdirSync(routeDir, { recursive: true })
  return writeFile(path.join(routeDir, 'index.html'), contents)
}

function renderCrawlerRoot(route, { privatePage = false } = {}) {
  if (route.path === '/' && !privatePage) return uaRootFallback
  const heading = privatePage ? 'Приватна сторінка VITALOOP' : route.title.replace(' | Vitaloop Ukraine', '').replace(' | Vitaloop Ukraine Health Hub', '')
  const lead = privatePage
    ? 'Ця сторінка доступна після входу в акаунт VITALOOP Ukraine.'
    : route.description
  const paragraphs = (route.text || [])
    .slice(0, 6)
    .map((item) => `<p>${escapeHtml(item)}</p>`)
    .join('\n          ')
  return `<div id="root"><main data-crawler-content="true" style="min-height:100vh;font-family:Inter,Arial,sans-serif;color:#0f172a;background:#f8f5f0;padding:48px 20px;">
        <section style="max-width:880px;margin:0 auto;background:#fff;border:1px solid #e5dfd6;border-radius:28px;padding:32px;box-shadow:0 20px 60px rgba(15,23,42,0.08);">
          <p style="margin:0 0 14px;color:#0f766e;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;">VITALOOP Ukraine</p>
          <h1 style="margin:0;font-size:42px;line-height:1.08;font-weight:900;">${escapeHtml(heading)}</h1>
          <p style="margin:18px 0 0;font-size:18px;line-height:1.7;color:#475569;">${escapeHtml(lead)}</p>
          ${paragraphs}
          <nav aria-label="Навігація" style="margin-top:28px;display:flex;gap:12px;flex-wrap:wrap;">
            <a href="/" style="color:#0f766e;font-weight:800;">Головна</a>
            <a href="/health-hub/" style="color:#0f766e;font-weight:800;">Центр знань</a>
            <a href="/login/?locale=uk" style="color:#0f766e;font-weight:800;">Увійти</a>
          </nav>
        </section>
      </main></div>`
}

function renderUaRoute(route, { noindex = false, privatePage = false } = {}) {
  const canonical = routeUrl(route.path)
  let pageHtml = html
  pageHtml = pageHtml.replace(/<html\b[^>]*>/i, '<html lang="uk" prefix="og: https://ogp.me/ns#">')
  pageHtml = replaceTag(pageHtml, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(route.title)}</title>`)
  pageHtml = replaceTag(pageHtml, /<meta name="description" content="[^"]*"[^>]*\/>/, `<meta name="description" content="${escapeHtml(route.description)}" data-rh="true" />`)
  pageHtml = replaceTag(pageHtml, /<meta name="robots" content="[^"]*"[^>]*\/>/, `<meta name="robots" content="${noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'}" data-rh="true" />`)
  pageHtml = replaceTag(pageHtml, /<link rel="canonical" href="[^"]*"[^>]*\/>/, `<link rel="canonical" href="${canonical}" data-rh="true" />`)
  pageHtml = replaceTag(pageHtml, /<meta property="og:title" content="[^"]*"[^>]*\/>/, `<meta property="og:title" content="${escapeHtml(route.title)}" data-rh="true" />`)
  pageHtml = replaceTag(pageHtml, /<meta property="og:description" content="[^"]*"[^>]*\/>/, `<meta property="og:description" content="${escapeHtml(route.description)}" data-rh="true" />`)
  pageHtml = replaceTag(pageHtml, /<meta property="og:url" content="[^"]*"[^>]*\/>/, `<meta property="og:url" content="${canonical}" data-rh="true" />`)
  pageHtml = replaceTag(pageHtml, /<meta name="twitter:title" content="[^"]*"[^>]*\/>/, `<meta name="twitter:title" content="${escapeHtml(route.title)}" data-rh="true" />`)
  pageHtml = replaceTag(pageHtml, /<meta name="twitter:description" content="[^"]*"[^>]*\/>/, `<meta name="twitter:description" content="${escapeHtml(route.description)}" data-rh="true" />`)
  pageHtml = pageHtml.replace(/\s*<link rel="alternate" hreflang="[^"]+" href="[^"]*" \/>/g, '')
  if (!noindex) {
    pageHtml = upsertAfter(
      pageHtml,
      /<link rel="canonical" href="[^"]*"[^>]*\/>/,
      `hreflang="uk-UA" href="${canonical}"`,
      `<link rel="alternate" hreflang="uk-UA" href="${canonical}" />
    <link rel="alternate" hreflang="en" href="https://vitaloop.today${canonicalPath(route.path)}" />
    <link rel="alternate" hreflang="x-default" href="https://vitaloop.today${canonicalPath(route.path)}" />`,
    )
  }
  pageHtml = pageHtml.replace(/<div id="root">[\s\S]*?<\/div>\s*(?=<script|<\/body>|$)/, renderCrawlerRoot(route, { privatePage }))
  return pageHtml
}

for (const route of UA_PUBLIC_ROUTES) {
  await writeRouteFile(route.path, renderUaRoute(route))
}

for (const privatePath of UA_PRIVATE_ROUTES) {
  await writeRouteFile(privatePath, renderUaRoute({
    path: privatePath,
    title: 'Приватна сторінка VITALOOP Ukraine',
    description: 'Ця сторінка кабінету VITALOOP Ukraine доступна після входу в акаунт.',
    text: ['Увійдіть, щоб переглянути персональний кабінет, аналізи, рекомендації та прогрес.'],
  }, { noindex: true, privatePage: true }))
}

const today = new Date().toISOString().slice(0, 10)
const sitemapUrls = UA_PUBLIC_ROUTES.map((route) => `  <url>
    <loc>${routeUrl(route.path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n')

await writeFile(path.join(distDir, 'ua-sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls}
</urlset>
`)

await writeFile(path.join(distDir, 'ua-robots.txt'), `User-agent: *
Allow: /

Disallow: /api/
Disallow: /dashboard
Disallow: /dashboard/
Disallow: /upload
Disallow: /lab-plan
Disallow: /avatar
Disallow: /lab-results
Disallow: /lab-results/
Disallow: /results/
Disallow: /protocol/
Disallow: /settings
Disallow: /assignments
Disallow: /check-ins
Disallow: /insights
Disallow: /health-profile
Disallow: /billing-history
Disallow: /help-center
Disallow: /subscription
Disallow: /onboarding
Disallow: /questionnaire
Disallow: /admin
Disallow: /ops
Disallow: /crm
Disallow: /login
Disallow: /auth/confirmation

Sitemap: https://ua.vitaloop.today/sitemap.xml
`)

await writeFile(path.join(distDir, 'ua-llms.txt'), `# VITALOOP Ukraine

> VITALOOP Ukraine — україномовний health intelligence сервіс для структурування симптомів, аналізів, пояснень біомаркерів, рекомендацій і динаміки стану.

## Офіційні URL
- Сайт: https://ua.vitaloop.today/
- Аналізи: https://ua.vitaloop.today/analizy/
- Симптоми: https://ua.vitaloop.today/symptomy/
- Центр знань: https://ua.vitaloop.today/health-hub/
- Тарифи: https://ua.vitaloop.today/tarify/

## Безпека
VITALOOP Ukraine має освітній характер і не є діагностичним інструментом. Відхилення або тривожні результати потрібно обговорювати з кваліфікованим лікарем.
`)

await writeFile(uaIndexPath, html)
console.log(`Created ${path.relative(process.cwd(), uaIndexPath)} and ${UA_PUBLIC_ROUTES.length} UA crawler routes in ${path.relative(process.cwd(), uaStaticDir)}`)
