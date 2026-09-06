import fs from 'node:fs'
import path from 'node:path'
import { ALL_ARTICLE_IDS, HELP_ARTICLES, HELP_SECTIONS } from '../src/data/helpArticles.js'
import { HEALTH_HUB_ARTICLES, HEALTH_HUB_CLUSTERS } from '../src/data/healthHubContent.js'

const DIST_DIR = path.resolve(process.cwd(), 'dist')
const BASE_URL = 'https://vitaloop.today'
const DEFAULT_IMAGE = `${BASE_URL}/vitaloop-social-preview-2026-06.png`
const UA_ALTERNATE_BY_EN_PATH = {
  '/': 'https://ua.vitaloop.today/',
  '/symptom-intake/': 'https://ua.vitaloop.today/samopochuttia/',
  '/about/': 'https://ua.vitaloop.today/about/',
  '/privacy-policy/': 'https://ua.vitaloop.today/privacy-policy/',
  '/terms/': 'https://ua.vitaloop.today/terms/',
  '/health-hub/': 'https://ua.vitaloop.today/health-hub/',
}

const routes = [
  {
    path: '/',
    title: 'AI Health Intelligence for Lab Results Over Time | VITALOOP',
    description: 'VITALOOP helps you make sense of symptoms, lab results, biomarker patterns, safety context, retests, and progress over time with AI.',
    priority: '1.0',
    changefreq: 'weekly',
    text: [
      'VITALOOP helps people make sense of health data and lab results over time using AI.',
      'Start with symptoms or upload blood test results when you have them.',
      'VITALOOP connects biomarker patterns, symptom context, Knowledge Base rules, safety notes, clinician discussion points, retest timing, and progress tracking into one clear health action loop.',
    ],
  },
  {
    path: '/how-it-works',
    title: 'How AI Blood Test Analysis Works | VITALOOP',
    description: 'See how VITALOOP connects symptom intake, analysis quality gates, biomarker normalization, Knowledge Base reasoning, evidence gaps, safety notes, protocol actions, trends, and weekly progress tracking.',
    priority: '0.9',
    changefreq: 'monthly',
    text: [
      'VITALOOP starts with symptoms and context.',
      'The product helps organize what may be useful to check, then interprets uploaded or entered lab results through the VITALOOP Health Intelligence Engine and turns them into a structured plan.',
      'The loop continues with weekly check-ins and retesting cycles.',
    ],
  },
  {
    path: '/symptom-intake',
    title: 'Free Symptom Checker & Lab Discussion Guide | VITALOOP',
    description: 'Organize fatigue, sleep, brain fog, hair loss, digestion, and other symptoms. Get lab categories and questions to discuss with a clinician.',
    priority: '0.9',
    changefreq: 'weekly',
    text: [
      'VITALOOP starts with symptoms before lab uploads.',
      'The symptom intake flow helps organize fatigue, sleep issues, hair loss, brain fog, digestion, and other signals.',
      'Recommendations are educational and intended for discussion with qualified healthcare professionals.',
    ],
  },
  {
    path: '/features',
    title: 'AI Blood Test Analysis Features | VITALOOP',
    description: 'Explore symptom intake, the VITALOOP Health Intelligence Engine, extraction quality gates, biomarker reasoning, safety notes, action plans, weekly check-ins, and progress tracking.',
    priority: '0.8',
    changefreq: 'monthly',
    text: [
      'Explore the VITALOOP symptom-first health workflow.',
      'Connect symptom intake, lab interpretation, safety notes, action protocols, weekly check-ins, and retesting in one continuous loop.',
      'VITALOOP supports clearer health conversations and does not replace qualified medical care.',
    ],
  },
  {
    path: '/example-report',
    title: 'Health Intelligence Example Report | VITALOOP',
    description: 'Preview a VITALOOP health intelligence report with normalized biomarkers, Knowledge Base reasoning, priority findings, safety notes, discussion points, retest timing, and progress tracking.',
    priority: '0.8',
    changefreq: 'monthly',
    text: [
      'The example report shows what users receive after uploading lab results.',
      'It highlights priority markers, plain-language context, safety notes, questions for a clinician, retest timing, and next steps.',
    ],
  },
  {
    path: '/for-nutritionists',
    title: 'Health Intelligence Platform for Nutritionists | VITALOOP',
    description: 'Organize client symptoms, review blood test results, prepare nutrition protocols, and track follow-up progress in one practitioner workspace.',
    priority: '0.8',
    changefreq: 'monthly',
    text: [
      'VITALOOP helps nutritionists and preventive health practitioners structure client symptoms, lab results, Knowledge Base reasoning, safety notes, and protocol execution.',
      'Practitioners can review biomarker patterns, track progress, and prepare focused follow-up conversations.',
    ],
  },
  {
    path: '/faq',
    title: 'VITALOOP Health Intelligence FAQ | Symptoms, Labs, Safety & Retests',
    description: 'Answers about symptom intake, blood test uploads, biomarker explanations, the VITALOOP Health Intelligence Engine, privacy, pricing, practitioner workflows, and VITALOOP safety limits.',
    priority: '0.7',
    changefreq: 'monthly',
    text: [
      'Frequently asked questions about VITALOOP.',
      'VITALOOP is not a diagnostic tool and does not replace medical care.',
      'It helps organize symptoms, lab context, safety notes, retest timing, and next-step questions.',
    ],
  },
  {
    path: '/pricing',
    title: 'VITALOOP Pricing | Premium Lab Intelligence Subscription',
    description: 'Compare VITALOOP Free and Premium access for lab uploads, explainable health reports, protocols, progress tracking, and weekly check-ins.',
    priority: '0.8',
    changefreq: 'monthly',
    text: [
      'VITALOOP offers free access for getting started and Premium access for deeper lab intelligence.',
      'Premium includes full lab analysis, explainable reports, personalized protocols, progress tracking, and weekly check-ins.',
      'VITALOOP is educational software and does not diagnose, treat, prescribe, or replace professional medical care.',
      'Premium access is currently activated manually. VITALOOP does not send uploaded lab files, symptoms, biomarker values, health reports, or protocol text to billing tools.',
    ],
    links: [
      { href: '/refund-policy/', label: 'Refund policy' },
      { href: '/terms/', label: 'Terms' },
      { href: '/privacy-policy/', label: 'Privacy policy' },
      { href: '/contact/', label: 'Contact' },
    ],
  },
  {
    path: '/for-investors',
    title: 'Investor Overview | VITALOOP AI Health Platform',
    description: 'Learn about VITALOOP as a HealthTech platform connecting symptom intake, lab interpretation, the VITALOOP Health Intelligence Engine, evidence gaps, safety-aware plans, and recurring health loops.',
    priority: '0.6',
    changefreq: 'monthly',
    text: [
      'VITALOOP is building a HealthTech product around symptom-first onboarding, lab interpretation, quality-gated analysis artifacts, safety-aware plans, and recurring feedback loops.',
    ],
  },
  {
    path: '/help',
    title: 'VITALOOP Help Center | Product & Account Support',
    description: 'Get help with account access, uploading lab reports, understanding results, subscriptions, privacy, and using the VITALOOP cabinet.',
    priority: '0.6',
    changefreq: 'monthly',
    text: [
      'The VITALOOP help center explains account access, uploads, lab results, subscriptions, privacy, and product support.',
    ],
  },
  {
    path: '/site-map',
    title: 'VITALOOP Site Map | Health Guides and Product Pages',
    description: 'Browse every public VITALOOP product page, health guide, editorial standard, and help center resource from one accessible site map.',
    priority: '0.5',
    changefreq: 'weekly',
    text: [
      'Use this site map to browse all public VITALOOP resources.',
      'Explore symptom-first product information, evidence-aware health guides, trust policies, and practical help articles.',
    ],
  },
  {
    path: '/terms',
    title: 'Terms of Service and Subscription Rules | VITALOOP',
    description: 'Read the VITALOOP terms of service for using the website, user cabinet, subscriptions, and health support features.',
    priority: '0.3',
    changefreq: 'yearly',
    text: [
      'VITALOOP terms of service for website and product use.',
      'Premium access can be cancelled from the account billing area or by contacting support when active.',
      'Refund requests are reviewed case by case under the VITALOOP refund policy.',
    ],
    links: [
      { href: '/pricing/', label: 'Pricing' },
      { href: '/refund-policy/', label: 'Refund policy' },
      { href: '/contact/', label: 'Contact' },
    ],
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy and Health Data Protection | VITALOOP',
    description: 'Learn how VITALOOP collects, processes, stores, protects, exports, and deletes symptom data, blood test reports, biomarker results, and account information.',
    priority: '0.3',
    changefreq: 'yearly',
    text: [
      'VITALOOP privacy policy covering account data, lab uploads, analytics, security, and user rights.',
      'Health data is not shared with marketing or billing tools. Payment processors receive only account and checkout metadata required for billing.',
    ],
    links: [
      { href: '/pricing/', label: 'Pricing' },
      { href: '/refund-policy/', label: 'Refund policy' },
      { href: '/contact/', label: 'Contact' },
    ],
  },
  {
    path: '/refund-policy',
    title: 'Refund Policy and Cancellation Support | VITALOOP',
    description: 'Read VITALOOP refund, cancellation, subscription access, and billing support rules for Premium subscriptions.',
    priority: '0.3',
    changefreq: 'yearly',
    text: [
      'VITALOOP Premium subscriptions can be cancelled from the account billing area or by contacting support.',
      'Refund requests are reviewed case by case for duplicate charges, accidental purchases, checkout or access issues, or other billing problems.',
      'VITALOOP is educational wellness and health-data organization software. Refund decisions are not based on medical outcomes.',
    ],
    links: [
      { href: '/pricing/', label: 'Pricing' },
      { href: '/terms/', label: 'Terms' },
      { href: '/privacy-policy/', label: 'Privacy policy' },
      { href: '/contact/', label: 'Contact' },
    ],
  },
  {
    path: '/contact',
    title: 'Contact VITALOOP | Support and Billing Help',
    description: 'Contact VITALOOP for account support, billing questions, cancellation and refund requests, privacy requests, partnerships, and product feedback.',
    priority: '0.5',
    changefreq: 'yearly',
    text: [
      'Contact VITALOOP for account support, billing questions, cancellation and refund requests, privacy requests, partnerships, and product feedback.',
      'VITALOOP is educational software and is not a medical provider.',
    ],
    links: [
      { href: 'mailto:info@softdab.tech', label: 'info@softdab.tech' },
      { href: '/pricing/', label: 'Pricing' },
      { href: '/refund-policy/', label: 'Refund policy' },
    ],
  },
  {
    path: '/about',
    title: 'About VITALOOP | Symptom & Lab Health Intelligence',
    description: 'Learn why VITALOOP connects symptom intake, biomarker analysis, Knowledge Base reasoning, safety context, and longitudinal progress in one health workflow.',
    priority: '0.6',
    changefreq: 'monthly',
    text: ['About VITALOOP and the product mission: clearer health decisions from symptoms, labs, and progress over time.'],
  },
  {
    path: '/health-hub',
    title: 'Health Hub: Symptoms and Blood Tests | VITALOOP',
    description: 'Evidence-aware guides that connect symptoms, blood-test categories, biomarker context, clinician questions, and practical next steps.',
    priority: '0.9',
    changefreq: 'weekly',
    text: [
      'Understand the signal before you chase the number.',
      'Explore connected guides about symptoms, blood tests, biomarker context, and better clinician conversations.',
      'Start with persistent fatigue and low energy, then move through focused testing and biomarker interpretation guides.',
    ],
    links: HEALTH_HUB_CLUSTERS.map((cluster) => ({
      href: `/health-hub/topics/${cluster.slug}/`,
      label: cluster.title,
    })),
  },
  {
    path: '/editorial-policy',
    title: 'Editorial Policy & Health Content Standards | VITALOOP',
    description: 'Read how VITALOOP researches, writes, reviews, updates, sources, and corrects educational content about symptoms, blood tests, and biomarkers.',
    priority: '0.5',
    changefreq: 'yearly',
    text: ['VITALOOP editorial standards for evidence-aware health education, transparent review status, authoritative sourcing, corrections, and updates.'],
  },
  {
    path: '/medical-review-policy',
    title: 'Medical Review Policy | VITALOOP',
    description: 'Learn when VITALOOP health content requires licensed clinical review, how reviewer credentials are disclosed, and what a medical-review badge means.',
    priority: '0.5',
    changefreq: 'yearly',
    text: ['VITALOOP does not display a medical-review badge unless a licensed clinician has reviewed the specific article within their professional scope.'],
  },
  {
    path: '/authors/vitaloop-editorial-team',
    title: 'VITALOOP Editorial Team | Health Content Authors',
    description: 'Meet the team responsible for researching, writing, sourcing, updating, and correcting VITALOOP educational content about symptoms and blood tests.',
    priority: '0.5',
    changefreq: 'yearly',
    text: ['The VITALOOP Editorial Team researches and writes educational content using authoritative health agencies, guidelines, and peer-reviewed evidence.'],
  },
]

for (const cluster of HEALTH_HUB_CLUSTERS) {
  routes.push({
    path: `/health-hub/topics/${cluster.slug}`,
    title: cluster.seoTitle,
    description: cluster.seoDescription,
    priority: '0.85',
    changefreq: 'monthly',
    text: [
      cluster.intro,
      ...cluster.questions,
      ...cluster.steps,
    ],
    links: cluster.articleSlugs.map((slug) => {
      const article = HEALTH_HUB_ARTICLES.find((item) => item.slug === slug)
      return { href: `/health-hub/${slug}/`, label: article?.title || slug }
    }),
  })
}

for (const article of HEALTH_HUB_ARTICLES) {
  const cluster = HEALTH_HUB_CLUSTERS.find((item) => item.articleSlugs.includes(article.slug))
  routes.push({
    path: `/health-hub/${article.slug}`,
    title: article.seoTitle,
    description: article.description,
    priority: '0.8',
    changefreq: 'monthly',
    text: [
      article.summary,
      ...article.keyPoints,
      ...article.sections.flatMap((section) => [
        section.heading,
        ...(section.paragraphs || []),
        ...(section.bullets || []),
        ...(section.callout ? [section.callout] : []),
      ]),
    ],
    links: [
      ...(cluster ? [{ href: `/health-hub/topics/${cluster.slug}/`, label: cluster.title }] : []),
      ...article.related.map((slug) => {
        const related = HEALTH_HUB_ARTICLES.find((item) => item.slug === slug)
        return { href: `/health-hub/${slug}/`, label: related?.title || slug }
      }),
    ],
  })
}

function helpBlockText(block) {
  if (block.text) return block.text
  if (!Array.isArray(block.items)) return ''
  return block.items.map((item) => (
    typeof item === 'string'
      ? item
      : [item.title, item.body, item.label, item.desc].filter(Boolean).join(' ')
  )).join(' ')
}

function truncateAtWord(value, maxLength) {
  if (value.length <= maxLength) return value
  const shortened = value.slice(0, maxLength + 1)
  return `${shortened.slice(0, shortened.lastIndexOf(' ')).replace(/[?:,;.-]+$/, '')}…`
}

function helpDescription(article) {
  const firstText = article.content.map(helpBlockText).find(Boolean) || ''
  const suffix = ' Find clear steps, safety context, and product guidance in the VITALOOP Help Center.'
  return truncateAtWord(`${firstText}${suffix}`, 155)
}

for (const section of HELP_SECTIONS) {
  routes.push({
    path: `/help/section/${section.id}`,
    title: `${section.title} | VITALOOP Help Center`,
    description: `Browse VITALOOP help articles about ${section.title.toLowerCase()}, product use, blood test uploads, privacy, account access, and practical troubleshooting.`,
    priority: '0.5',
    changefreq: 'monthly',
    text: section.articles
      .map((articleId) => HELP_ARTICLES[articleId]?.title)
      .filter(Boolean),
  })
}

for (const articleId of ALL_ARTICLE_IDS) {
  const article = HELP_ARTICLES[articleId]
  const articleText = article.content.map(helpBlockText).filter(Boolean)
  routes.push({
    path: `/help/${articleId}`,
    title: truncateAtWord(`${article.title} | VITALOOP Help`, 60),
    description: helpDescription(article),
    priority: '0.5',
    changefreq: 'monthly',
    text: articleText.slice(0, 6),
  })
}

const siteMapRoute = routes.find((route) => route.path === '/site-map')
siteMapRoute.links = routes
  .filter((route) => route.path !== '/site-map')
  .map((route) => ({
    href: route.path === '/' ? '/' : `${route.path.replace(/\/+$/, '')}/`,
    label: route.title.replace(' | VITALOOP', ''),
  }))

const privateRoutes = [
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
  const [lead, ...supportingText] = route.text
  const paragraphs = [
    lead ? `<p><strong>${escapeHtml(lead)}</strong></p>` : '',
    ...supportingText.map((item) => `<p>${escapeHtml(item)}</p>`),
  ].join('\n          ')
  const coreLinks = [
    { href: '/', label: 'VITALOOP home' },
    { href: '/how-it-works/', label: 'How VITALOOP works' },
    { href: '/symptom-intake/', label: 'Start symptom check' },
    { href: '/health-hub/', label: 'Health Intelligence Hub' },
    { href: '/example-report/', label: 'Example health report' },
    { href: '/about/', label: 'About VITALOOP' },
    { href: '/site-map/', label: 'Browse the complete VITALOOP site map' },
  ]
  const links = [...coreLinks, ...(route.links || [])]
    .filter((link, index, all) => all.findIndex((item) => item.href === link.href) === index)
  const navigation = `<nav aria-label="Related pages"><h2>Explore VITALOOP</h2><ul>${links.map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join('')}</ul></nav>`
  return `<div id="root"><main data-crawler-content="true">
        <h1>${escapeHtml(route.title.replace(' | VITALOOP', ''))}</h1>
        <p>${escapeHtml(route.description)}</p>
        ${paragraphs}
        ${navigation}
      </main></div>`
}

function renderHtml(baseHtml, route, { noindex = false } = {}) {
  const canonicalPath = route.path === '/' ? '/' : `${route.path.replace(/\/+$/, '')}/`
  const canonical = `${BASE_URL}${canonicalPath}`
  let html = baseHtml
  html = html.replace(/<html\b[^>]*>/i, '<html lang="en" prefix="og: https://ogp.me/ns#">')
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(route.title)}</title>`)
  html = upsertTag(html, /<meta\s+name="description"\s+content="[^"]*"[^>]*\/?>/i, `<meta name="description" content="${escapeHtml(route.description)}" data-rh="true" />`)
  html = upsertTag(html, /<meta\s+name="robots"\s+content="[^"]*"[^>]*\/?>/i, `<meta name="robots" content="${noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'}" data-rh="true" />`)
  html = upsertTag(html, /<link\s+rel="canonical"\s+href="[^"]*"[^>]*\/?>/i, `<link rel="canonical" href="${canonical}" data-rh="true" />`)
  html = upsertTag(html, /<meta\s+property="og:title"\s+content="[^"]*"[^>]*\/?>/i, `<meta property="og:title" content="${escapeHtml(route.title)}" data-rh="true" />`)
  html = upsertTag(html, /<meta\s+property="og:description"\s+content="[^"]*"[^>]*\/?>/i, `<meta property="og:description" content="${escapeHtml(route.description)}" data-rh="true" />`)
  html = upsertTag(html, /<meta\s+property="og:url"\s+content="[^"]*"[^>]*\/?>/i, `<meta property="og:url" content="${canonical}" data-rh="true" />`)
  html = upsertTag(html, /<meta\s+property="og:image"\s+content="[^"]*"[^>]*\/?>/i, `<meta property="og:image" content="${DEFAULT_IMAGE}" data-rh="true" />`)
  html = upsertTag(html, /<meta\s+name="twitter:title"\s+content="[^"]*"[^>]*\/?>/i, `<meta name="twitter:title" content="${escapeHtml(route.title)}" data-rh="true" />`)
  html = upsertTag(html, /<meta\s+name="twitter:description"\s+content="[^"]*"[^>]*\/?>/i, `<meta name="twitter:description" content="${escapeHtml(route.description)}" data-rh="true" />`)
  if (route.path !== '/') {
    html = html.replace(/\s*<link\s+rel="alternate"\s+hreflang="[^"]+"\s+href="[^"]*"\s*\/?>/gi, '')
    const uaAlternate = UA_ALTERNATE_BY_EN_PATH[canonicalPath]
    const alternates = [
      `<link rel="alternate" hreflang="en" href="${canonical}" />`,
      uaAlternate ? `<link rel="alternate" hreflang="uk-UA" href="${uaAlternate}" />` : null,
      uaAlternate ? `<link rel="alternate" hreflang="x-default" href="${canonical}" />` : null,
    ].filter(Boolean).join('\n    ')
    html = html.replace('</head>', `    ${alternates}\n  </head>`)
  }
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
Disallow: /login
Disallow: /auth/confirmation

Sitemap: ${BASE_URL}/sitemap.xml
`)

  const today = new Date().toISOString().slice(0, 10)
  const urls = routes.map((route) => `  <url>
    <loc>${BASE_URL}${route.path === '/' ? '/' : `${route.path.replace(/\/+$/, '')}/`}</loc>
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
- [Website](${BASE_URL}/)
- [How it works](${BASE_URL}/how-it-works/)
- [Features](${BASE_URL}/features/)
- [Symptom intake](${BASE_URL}/symptom-intake/)
- [Example report](${BASE_URL}/example-report/)
- [FAQ](${BASE_URL}/faq/)
- [Practitioners](${BASE_URL}/for-nutritionists/)
- [Privacy policy](${BASE_URL}/privacy-policy/)
- [Terms](${BASE_URL}/terms/)
- [Sitemap](${BASE_URL}/sitemap.xml)
- [Robots](${BASE_URL}/robots.txt)

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
