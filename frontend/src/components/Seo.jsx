import { Helmet } from 'react-helmet-async'

export default function Seo({
  title,
  description,
  path = '/',
  image = 'https://vitaloop.softdab.tech/og-cover.jpg',
}) {
  const siteName = 'VITALOOP'
  const fullTitle = title ? `${title} | ${siteName}` : `${siteName} — Biohacking as a Service`
  const canonical = `https://vitaloop.softdab.tech${path}`

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index,follow,max-image-preview:large" />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  )
}
