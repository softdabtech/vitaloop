import { readFile, writeFile } from 'node:fs/promises'
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

await writeFile(uaIndexPath, html)
console.log(`Created ${path.relative(process.cwd(), uaIndexPath)}`)
