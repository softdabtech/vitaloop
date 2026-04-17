import { Helmet } from 'react-helmet-async'

const BASE_URL = 'https://vitaloop.today'

/**
 * Per-page SEO head manager.
 * @param {string}  title       - Full page title (no site name appended). Uses default if omitted.
 * @param {string}  description - Meta description (150–160 chars ideal).
 * @param {string}  path        - Canonical path, e.g. '/how-it-works'. Defaults to '/'.
 * @param {string}  image       - Absolute OG image URL.
 * @param {Array}   schemas     - JSON-LD schema objects to inject as <script type="application/ld+json">.
 */
export default function Seo({
  title,
  description,
  path = '/',
  image = `${BASE_URL}/og-cover.jpg`,
  schemas = [],
}) {
  const fullTitle = title || 'AI Lab Analysis & Biohacking Platform | VITALOOP'
  const canonical = `${BASE_URL}${path}`

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="VITALOOP" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@vitaloop" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  )
}
