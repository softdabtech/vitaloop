import fs from 'node:fs'
import path from 'node:path'

const DIST_DIR = path.resolve(process.cwd(), 'dist')
const BASE_URL = 'https://vitaloop.today'
const DEFAULT_IMAGE = `${BASE_URL}/og-cover-2026-05.jpg`

const routes = [
  {
    path: '/',
    title: 'Find the Cause, Not Just the Symptom | VITALOOP',
    description: 'Start with symptoms, understand what may be driving them, see which lab markers are worth checking, and turn results into a clear health action plan.',
    priority: '1.0',
    changefreq: 'weekly',
    text: [
      'VITALOOP is a symptom-first health platform.',
      'Start with fatigue, sleep, low energy, brain fog, hair loss, digestion, or other signals.',
      'VITALOOP helps connect symptoms, lab direction, biomarker results, recommendations, and weekly progress into one clear health action loop.',
    ],
  },
  {
    path: '/how-it-works',
    title: 'How VITALOOP Works: Symptoms, Labs, Action Plan',
    description: 'See how VITALOOP moves from symptom intake to lab direction, biomarker interpretation, personalized action plans, and weekly progress tracking.',
    priority: '0.9',
    changefreq: 'monthly',
    text: [
      'VITALOOP starts with symptoms and context.',
      'The product helps organize what may be useful to check, then interprets uploaded lab results and turns them into a structured plan.',
      'The loop continues with weekly check-ins and retesting cycles.',
    ],
  },
  {
    path: '/example-report',
    title: 'Example Health Report | VITALOOP',
    description: 'Preview how VITALOOP explains biomarker priorities, symptom context, recommendations, and progress without replacing a clinician.',
    priority: '0.8',
    changefreq: 'monthly',
    text: [
      'The example report shows what users receive after uploading lab results.',
      'It highlights priority markers, plain-language context, questions for a clinician, and next steps.',
    ],
  },
  {
    path: '/for-nutritionists',
    title: 'VITALOOP for Nutritionists and Preventive Health Practitioners',
    description: 'Manage client symptoms, lab results, biomarker trends, protocols, and progress tracking in one practitioner workflow.',
    priority: '0.8',
    changefreq: 'monthly',
    text: [
      'VITALOOP helps nutritionists and preventive health practitioners structure client symptoms, lab results, and protocol execution.',
      'Practitioners can review biomarker patterns, track progress, and prepare focused follow-up conversations.',
    ],
  },
  {
    path: '/faq',
    title: 'VITALOOP FAQ',
    description: 'Answers about symptoms, lab uploads, biomarker interpretation, privacy, safety, pricing, and how VITALOOP should be used with clinicians.',
    priority: '0.7',
    changefreq: 'monthly',
    text: [
      'Frequently asked questions about VITALOOP.',
      'VITALOOP is not a diagnostic tool and does not replace medical care.',
      'It helps organize symptoms, lab context, and next-step questions.',
    ],
  },
  {
    path: '/for-investors',
    title: 'VITALOOP for Investors',
    description: 'Learn about VITALOOP as a HealthTech platform connecting symptom intake, lab interpretation, protocols, and recurring health loops.',
    priority: '0.6',
    changefreq: 'monthly',
    text: [
      'VITALOOP is building a HealthTech product around symptom-first onboarding, lab interpretation, personalized protocols, and recurring feedback loops.',
    ],
  },
  {
    path: '/help',
    title: 'VITALOOP Help Center',
    description: 'Get help with account access, uploading lab reports, understanding results, subscriptions, privacy, and using the VITALOOP cabinet.',
    priority: '0.6',
    changefreq: 'monthly',
    text: [
      'The VITALOOP help center explains account access, uploads, lab results, subscriptions, privacy, and product support.',
    ],
  },
  {
    path: '/terms',
    title: 'Terms of Service | VITALOOP',
    description: 'Read the VITALOOP terms of service for using the website, user cabinet, subscriptions, and health support features.',
    priority: '0.3',
    changefreq: 'yearly',
    text: ['VITALOOP terms of service for website and product use.'],
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy | VITALOOP',
    description: 'Read how VITALOOP handles privacy, account data, lab uploads, analytics, security, and user rights.',
    priority: '0.3',
    changefreq: 'yearly',
    text: ['VITALOOP privacy policy covering account data, lab uploads, analytics, security, and user rights.'],
  },
  {
    path: '/about',
    title: 'About VITALOOP',
    description: 'VITALOOP helps people make better health decisions by connecting symptoms, lab results, context, and progress over time.',
    priority: '0.6',
    changefreq: 'monthly',
    text: ['About VITALOOP and the product mission: clearer health decisions from symptoms, labs, and progress over time.'],
  },
]

const privateRoutes = [
  '/login',
  '/dashboard',
  '/upload',
  '/lab-results',
  '/settings',
  '/health-profile',
  '/subscription',
  '/billing-history',
  '/onboarding',
  '/questionnaire',
  '/check-ins',
  '/insights',
]

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function upsertTag(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`)
}

function renderStaticRoot(route) {
  const paragraphs = route.text.map((item) => `<p>${escapeHtml(item)}</p>`).join('\n          ')
  return `<div id="root"><main data-crawler-content="true" aria-hidden="true" style="display: none !important; visibility: hidden; max-width: 760px; margin: 0 auto; padding: 48px 20px; font-family: Inter, Arial, sans-serif; color: #0f172a;">
        <h1>${escapeHtml(route.title.replace(' | VITALOOP', ''))}</h1>
        <p>${escapeHtml(route.description)}</p>
        ${paragraphs}
      </main></div>`
}

function renderHtml(baseHtml, route, { noindex = false } = {}) {
  const canonical = `${BASE_URL}${route.path === '/' ? '/' : route.path}`
  let html = baseHtml
  html = html.replace(/<html\b[^>]*>/i, '<html lang="en" prefix="og: https://ogp.me/ns#">')
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(route.title)}</title>`)
  html = upsertTag(html, /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${escapeHtml(route.description)}" />`)
  html = upsertTag(html, /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i, `<meta name="robots" content="${noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'}" />`)
  html = upsertTag(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${canonical}" />`)
  html = upsertTag(html, /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${escapeHtml(route.title)}" />`)
  html = upsertTag(html, /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${escapeHtml(route.description)}" />`)
  html = upsertTag(html, /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${canonical}" />`)
  html = upsertTag(html, /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${DEFAULT_IMAGE}" />`)
  html = upsertTag(html, /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`)
  html = upsertTag(html, /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`)
  html = html.replace(/<div id="root"><\/div>/i, renderStaticRoot(route))
  return html
}

function writeRouteFile(route, html) {
  if (route.path === '/') {
    fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html)
    return
  }
  const routeDir = path.join(DIST_DIR, route.path.replace(/^\//, ''))
  fs.mkdirSync(routeDir, { recursive: true })
  fs.writeFileSync(path.join(routeDir, 'index.html'), html)
}

function writeTextFile(name, contents) {
  fs.writeFileSync(path.join(DIST_DIR, name), contents.trimStart())
}

function main() {
  const indexPath = path.join(DIST_DIR, 'index.html')
  if (!fs.existsSync(indexPath)) throw new Error('dist/index.html not found. Run vite build first.')
  const baseHtml = fs.readFileSync(indexPath, 'utf8')

  for (const route of routes) {
    writeRouteFile(route, renderHtml(baseHtml, route))
  }

  for (const privatePath of privateRoutes) {
    const route = {
      path: privatePath,
      title: 'Private VITALOOP page',
      description: 'This VITALOOP page requires an account.',
      text: ['This page requires authentication.'],
    }
    writeRouteFile(route, renderHtml(baseHtml, route, { noindex: true }))
  }

  const notFound = renderHtml(baseHtml, {
    path: '/404.html',
    title: 'Page Not Found | VITALOOP',
    description: 'The requested VITALOOP page could not be found.',
    text: ['The requested page could not be found. Return to the VITALOOP homepage.'],
  }, { noindex: true })
  fs.writeFileSync(path.join(DIST_DIR, '404.html'), notFound)

  writeTextFile('robots.txt', `User-agent: *
Allow: /

Disallow: /api/
Disallow: /dashboard
Disallow: /dashboard/
Disallow: /upload
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
Disallow: /subscription
Disallow: /onboarding
Disallow: /questionnaire
Disallow: /admin
Disallow: /ops
Disallow: /login
Disallow: /auth/confirmation

Sitemap: ${BASE_URL}/sitemap.xml
`)

  const today = new Date().toISOString().slice(0, 10)
  const urls = routes.map((route) => `  <url>
    <loc>${BASE_URL}${route.path === '/' ? '/' : route.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>${route.path === '/' ? `
    <image:image>
      <image:loc>${DEFAULT_IMAGE}</image:loc>
      <image:title>VITALOOP symptom-first health action platform</image:title>
    </image:image>` : ''}
  </url>`).join('\n')

  writeTextFile('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`)

  writeTextFile('llms.txt', `# VITALOOP

> VITALOOP is a symptom-first HealthTech platform that helps people connect symptoms, lab direction, biomarker results, personalized recommendations, and progress tracking.

## Official URLs
- Website: ${BASE_URL}/
- How it works: ${BASE_URL}/how-it-works
- Example report: ${BASE_URL}/example-report
- FAQ: ${BASE_URL}/faq
- Practitioners: ${BASE_URL}/for-nutritionists
- Privacy policy: ${BASE_URL}/privacy-policy
- Terms: ${BASE_URL}/terms

## What VITALOOP does
- Starts with symptoms and health context.
- Suggests lab marker categories worth discussing with a qualified clinician.
- Interprets uploaded lab results in plain language.
- Highlights priorities and next steps.
- Supports weekly feedback and progress tracking.

## Safety
VITALOOP is not a diagnostic tool and does not replace a doctor. Content is educational and should be reviewed with qualified medical professionals.
`)

  console.log(`Generated crawler pages for ${routes.length} public routes and ${privateRoutes.length} private noindex routes.`)
}

main()
