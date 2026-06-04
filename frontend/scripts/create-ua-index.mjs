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
html = replaceTag(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${UA.description}" />`)
html = replaceTag(html, /<meta name="keywords" content="[^"]*" \/>/, '<meta name="keywords" content="самопочуття, симптоми, аналізи, лабораторні аналізи, здоровʼя українською, Vitaloop Ukraine" />')
html = replaceTag(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${UA.url}" />`)
html = replaceTag(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${UA.title}" />`)
html = replaceTag(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${UA.description}" />`)
html = replaceTag(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${UA.url}" />`)
html = replaceTag(html, /<meta property="og:site_name" content="[^"]*" \/>/, '<meta property="og:site_name" content="VITALOOP Ukraine" />')
html = replaceTag(html, /<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${UA.image}" />`)
html = replaceTag(html, /<meta property="og:image:alt" content="[^"]*" \/>/, `<meta property="og:image:alt" content="${UA.imageAlt}" />`)
html = replaceTag(html, /<meta property="og:locale" content="[^"]*" \/>/, '<meta property="og:locale" content="uk_UA" />')
html = replaceTag(html, /<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${UA.title}" />`)
html = replaceTag(html, /<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${UA.description}" />`)
html = replaceTag(html, /<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${UA.image}" />`)
html = replaceTag(html, /<meta name="twitter:image:alt" content="[^"]*" \/>/, `<meta name="twitter:image:alt" content="${UA.imageAlt}" />`)
html = replaceTag(html, /<link rel="alternate" hreflang="en" href="[^"]*" \/>/, `<link rel="alternate" hreflang="uk-UA" href="${UA.url}" />`)
html = replaceTag(html, /<link rel="alternate" hreflang="x-default" href="[^"]*" \/>/, `<link rel="alternate" hreflang="x-default" href="${UA.url}" />`)

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

await writeFile(uaIndexPath, html)
console.log(`Created ${path.relative(process.cwd(), uaIndexPath)}`)
