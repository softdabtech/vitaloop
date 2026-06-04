import { Helmet } from 'react-helmet-async'
import { useEffect } from 'react'

const BASE_URL = 'https://vitaloop.today'
const DEFAULT_TITLE = 'Interpret Blood Test Results with AI | VITALOOP'
const DEFAULT_DESCRIPTION = 'Upload your blood test PDF, get thorough AI-powered biomarker analysis, and follow a personalized weekly protocol. Start free with no credit card.'

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
  image = `${BASE_URL}/og-cover-2026-05.jpg`,
  imageAlt = 'VITALOOP — AI-powered blood test analysis and biohacking platform dashboard',
  noindex = false,
  schemas = [],
}) {
  const fullTitle = title || DEFAULT_TITLE
  const safeDescription = description || DEFAULT_DESCRIPTION
  const canonical = canonicalUrl || `${BASE_URL}${path}`
  const robotsContent = noindex
    ? 'noindex,nofollow'
    : 'index,follow,max-image-preview:large,max-snippet:-1'

  useEffect(() => {
    if (typeof document === 'undefined') return

    const setSingleMeta = (selector, createAttrs, content) => {
      const nodes = Array.from(document.head.querySelectorAll(selector))
      const node = nodes[0] || document.createElement('meta')
      Object.entries(createAttrs).forEach(([key, value]) => node.setAttribute(key, value))
      node.setAttribute('content', content)
      if (!nodes[0]) document.head.appendChild(node)
      nodes.slice(1).forEach((extra) => extra.remove())
    }

    const setSingleLink = (selector, createAttrs, href) => {
      const nodes = Array.from(document.head.querySelectorAll(selector))
      const node = nodes[0] || document.createElement('link')
      Object.entries(createAttrs).forEach(([key, value]) => node.setAttribute(key, value))
      node.setAttribute('href', href)
      if (!nodes[0]) document.head.appendChild(node)
      nodes.slice(1).forEach((extra) => extra.remove())
    }

    const syncHead = () => {
      document.documentElement.lang = locale === 'uk_UA' ? 'uk' : 'en'
      document.title = fullTitle
      setSingleMeta('meta[name="description"]', { name: 'description' }, safeDescription)
      setSingleMeta('meta[name="robots"]', { name: 'robots' }, robotsContent)
      setSingleLink('link[rel="canonical"]', { rel: 'canonical' }, canonical)
      setSingleMeta('meta[property="og:title"]', { property: 'og:title' }, fullTitle)
      setSingleMeta('meta[property="og:description"]', { property: 'og:description' }, safeDescription)
      setSingleMeta('meta[property="og:url"]', { property: 'og:url' }, canonical)
      setSingleMeta('meta[property="og:image"]', { property: 'og:image' }, image)
      setSingleMeta('meta[property="og:image:alt"]', { property: 'og:image:alt' }, imageAlt)
      setSingleMeta('meta[property="og:locale"]', { property: 'og:locale' }, locale)
      setSingleMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, fullTitle)
      setSingleMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, safeDescription)
      setSingleMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, image)
      setSingleMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt' }, imageAlt)
    }

    syncHead()
    const cleanupId = window.setTimeout(syncHead, 0)
    return () => window.clearTimeout(cleanupId)
  }, [canonical, fullTitle, image, imageAlt, locale, robotsContent, safeDescription])

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
      <meta name="twitter:site" content="@vitaloop" />
      <meta name="twitter:creator" content="@vitaloop" />
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
