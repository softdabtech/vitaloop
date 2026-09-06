import { Helmet } from 'react-helmet-async'
import { useEffect } from 'react'

const BASE_URL = 'https://vitaloop.today'
const DEFAULT_TITLE = 'AI Blood Test Analysis & Symptom Checker | VITALOOP'
const DEFAULT_DESCRIPTION = 'Start with symptoms or upload blood test results. Get clear biomarker explanations, lab discussion guidance, and a health action plan you can track.'

function canonicalizePath(path) {
  if (!path || path === '/') return '/'
  return `${path.replace(/\/+$/, '')}/`
}

/**
 * Per-page SEO head manager.
 * @param {string}  title       - Full page title (no site name appended). Uses default if omitted.
 * @param {string}  description - Meta description (150–160 chars ideal).
 * @param {string}  path        - Canonical path, e.g. '/how-it-works'. Defaults to '/'.
 * @param {string}  image       - Absolute OG image URL.
 * @param {string}  imageAlt    - Alt text for the OG/Twitter image.
 * @param {boolean} noindex     - Set true to prevent indexing (404, private pages).
 * @param {Array}   schemas     - JSON-LD schema objects to inject as <script type="application/ld+json">.
 */
export default function Seo({
  title,
  description,
  path = '/',
  canonicalUrl,
  locale = 'en_US',
  image = `${BASE_URL}/vitaloop-social-preview-2026-06.png`,
  imageAlt = 'VITALOOP AI-powered health tracking dashboard with biomarker analysis, personalized protocols, and progress tracking',
  noindex = false,
  schemas = [],
}) {
  const fullTitle = title || DEFAULT_TITLE
  const safeDescription = description || DEFAULT_DESCRIPTION
  const canonical = canonicalUrl || `${BASE_URL}${canonicalizePath(path)}`
  const robotsContent = noindex
    ? 'noindex,nofollow'
    : 'index,follow,max-image-preview:large,max-snippet:-1'

  useEffect(() => {
    if (typeof document === 'undefined') return

    document.documentElement.lang = locale === 'uk_UA' ? 'uk' : 'en'
  }, [locale])

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={safeDescription} />
      <meta name="robots" content={robotsContent} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="VITALOOP" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={safeDescription} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={imageAlt} />
      <meta property="og:locale" content={locale} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@vitaloop_today" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={safeDescription} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={imageAlt} />

      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  )
}
