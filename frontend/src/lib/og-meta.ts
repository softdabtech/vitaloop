export interface OGMetaTags {
  title: string
  description: string
  image: string
  url: string
  type?: 'website' | 'article'
  author?: string
}

export function setOGMetaTags(tags: OGMetaTags) {
  // Remove existing OG tags
  document.querySelectorAll('meta[property^="og:"]').forEach(el => el.remove())

  const metaTags = {
    'og:title': tags.title,
    'og:description': tags.description,
    'og:image': tags.image,
    'og:url': tags.url,
    'og:type': tags.type || 'website',
    'twitter:title': tags.title,
    'twitter:description': tags.description,
    'twitter:image': tags.image,
    'twitter:card': 'summary_large_image',
  }

  Object.entries(metaTags).forEach(([property, content]) => {
    const meta = document.createElement('meta')
    meta.setAttribute('property', property)
    meta.setAttribute('content', content)
    document.head.appendChild(meta)
  })
}

export function generateShareImage(metrics: {
  score: number
  improving: number
  stable: number
  declining: number
  userName: string
}): string {
  // Generate SVG as data URL for OG image
  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="1200" height="630" fill="url(#grad)"/>

      <!-- Header -->
      <text x="60" y="100" font-size="48" font-weight="700" fill="white" font-family="system-ui">
        My Health Progress
      </text>
      <text x="60" y="150" font-size="24" fill="rgba(255,255,255,0.9)" font-family="system-ui">
        Tracked with VITALOOP
      </text>

      <!-- Main Score -->
      <circle cx="250" cy="380" r="100" fill="rgba(255,255,255,0.15)"/>
      <text x="250" y="420" font-size="72" font-weight="900" fill="white" text-anchor="middle" font-family="system-ui">
        ${metrics.score}
      </text>
      <text x="250" y="450" font-size="20" fill="rgba(255,255,255,0.8)" text-anchor="middle" font-family="system-ui">
        / 100
      </text>

      <!-- Stats -->
      <g id="stat1">
        <rect x="480" y="300" width="160" height="140" rx="10" fill="rgba(255,255,255,0.15)"/>
        <text x="560" y="330" font-size="16" fill="rgba(255,255,255,0.8)" text-anchor="middle" font-family="system-ui">
          Improving
        </text>
        <text x="560" y="380" font-size="48" font-weight="700" fill="white" text-anchor="middle" font-family="system-ui">
          ${metrics.improving}
        </text>
      </g>

      <g id="stat2">
        <rect x="700" y="300" width="160" height="140" rx="10" fill="rgba(255,255,255,0.15)"/>
        <text x="780" y="330" font-size="16" fill="rgba(255,255,255,0.8)" text-anchor="middle" font-family="system-ui">
          Stable
        </text>
        <text x="780" y="380" font-size="48" font-weight="700" fill="white" text-anchor="middle" font-family="system-ui">
          ${metrics.stable}
        </text>
      </g>

      <!-- Logo/Branding -->
      <text x="1100" y="600" font-size="14" fill="rgba(255,255,255,0.7)" text-anchor="end" font-family="system-ui">
        vitaloop.today
      </text>
    </svg>
  `

  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export function getResultsShareMetaTags(result: {
  uploadId: string
  score: number
  improving: number
  stable: number
  declining: number
  userName?: string
}) {
  const shareUrl = `${window.location.origin}/results/${result.uploadId}`

  return {
    title: `${result.userName || 'I'} tracked ${result.score}/100 health score on VITALOOP`,
    description: `${result.improving} improving biomarkers, ${result.stable} stable. See my full health analysis.`,
    image: generateShareImage(result),
    url: shareUrl,
    type: 'article' as const,
  }
}
