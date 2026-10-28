import BrandMark from './BrandMark.jsx'

const PRODUCT_LINKS = [
  { label: 'How it works', href: '/#problem' },
  { label: 'Example report', href: '/example-report/' },
  { label: 'Pricing', href: '/#pricing' },
]

const HEALTH_HUB_LINKS = [
  { label: 'Help Center', href: '/help/' },
  { label: 'Health Intelligence Hub', href: '/health-hub/' },
  { label: 'Fatigue & low energy', href: '/health-hub/topics/fatigue-low-energy/' },
  { label: 'Blood test biomarkers', href: '/health-hub/topics/blood-test-biomarkers/' },
  { label: 'Site map', href: '/site-map/' },
]

const COMPANY_LINKS = [
  { label: 'Team', href: '/team/' },
  { label: 'For practitioners & teams', href: '/for-nutritionists/' },
  { label: 'For investors', href: '/for-investors/' },
]

const TRUST_LINKS = [
  { label: 'Privacy & security', href: '/privacy-policy/' },
  { label: 'Terms', href: '/terms/' },
  { label: 'Refund policy', href: '/refund-policy/' },
  { label: 'Editorial policy', href: '/editorial-policy/' },
  { label: 'Medical review policy', href: '/medical-review-policy/' },
  { label: 'Medical disclaimer', href: '/terms/#medical-disclaimer' },
]

const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://www.instagram.com/vitaloop_today/' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/vitaloop-today' },
  { label: 'Facebook', href: 'https://www.facebook.com/vitaloop.today' },
]

function InstagramIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <circle cx="17.5" cy="6.5" r="1.5" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6.94 8.5A1.94 1.94 0 1 0 6.94 4.62a1.94 1.94 0 0 0 0 3.88ZM5.25 9.99h3.38V19H5.25V9.99ZM10.74 9.99h3.24v1.23h.05c.45-.86 1.56-1.77 3.22-1.77 3.44 0 4.08 2.27 4.08 5.22V19h-3.38v-3.84c0-.92-.02-2.1-1.28-2.1-1.28 0-1.48 1-1.48 2.03V19h-3.38V9.99Z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.65 20v-7.3h2.45l.37-2.84h-2.82V8.05c0-.82.23-1.39 1.41-1.39h1.5V4.12c-.26-.04-1.15-.12-2.19-.12-2.17 0-3.66 1.32-3.66 3.76v2.1H8.25v2.84h2.46V20h2.94Z" />
    </svg>
  )
}

const SOCIAL_ICONS = {
  Instagram: InstagramIcon,
  LinkedIn: LinkedInIcon,
  Facebook: FacebookIcon,
}

export default function Footer() {
  const columns = [
    { title: 'Product', links: PRODUCT_LINKS },
    { title: 'Health Hub', links: HEALTH_HUB_LINKS },
    { title: 'Professionals', links: COMPANY_LINKS },
    { title: 'Trust', links: TRUST_LINKS },
  ]

  return (
    <footer className="border-t border-[color:var(--vtl-color-border)] bg-[color:var(--vtl-color-canvas)]">
      <div className="mx-auto w-full max-w-[1240px] px-4 py-12 sm:px-6 md:py-16">
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.55fr)_repeat(4,minmax(0,0.82fr))]">
          <div className="sm:col-span-2 lg:col-span-1">
            <BrandMark />
            <p className="mt-5 max-w-sm text-[15px] leading-7 text-[color:var(--vtl-color-text-muted)]">
              Symptom-first lab intelligence, explainable Knowledge reports, and weekly health-loop tracking for people and professional teams.
            </p>
            <p className="mt-5 max-w-sm text-xs font-semibold uppercase leading-5 tracking-[0.15em] text-[color:var(--vtl-color-ink-secondary)]">
              Not medical advice. Always work with a qualified clinician for diagnosis and treatment decisions.
            </p>
            <a
              href="mailto:info@softdab.tech"
              className="mt-5 inline-flex min-h-11 items-center rounded-[var(--vtl-radius-pill)] border border-[color:var(--vtl-color-border-strong)] bg-[color:var(--vtl-color-surface)] px-4 text-sm font-semibold text-[color:var(--vtl-color-ink)] transition hover:border-[color:var(--vtl-color-brand-500)] hover:text-[color:var(--vtl-color-brand-700)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--vtl-color-focus-ring)]"
            >
              info@softdab.tech
            </a>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-xs font-bold uppercase tracking-[0.17em] text-[color:var(--vtl-color-brand-700)]">
                {column.title}
              </h2>
              <div className="mt-5 flex flex-col items-start gap-3">
                {column.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-sm leading-6 text-[color:var(--vtl-color-text-muted)] transition hover:text-[color:var(--vtl-color-brand-700)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--vtl-color-focus-ring)]"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-5 border-t border-[color:var(--vtl-color-border)] pt-6 text-sm text-[color:var(--vtl-color-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © 2026 VITALOOP. Made by{' '}
            <a
              href="https://softdab.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[color:var(--vtl-color-brand-700)] underline decoration-current underline-offset-2 hover:text-[color:var(--vtl-color-brand-800)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--vtl-color-focus-ring)]"
            >
              SoftDAB
            </a>
          </p>
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map((link) => {
              const Icon = SOCIAL_ICONS[link.label]
              return (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--vtl-radius-field)] border border-[color:var(--vtl-color-border)] bg-[color:var(--vtl-color-surface)] text-[color:var(--vtl-color-ink-secondary)] transition hover:border-[color:var(--vtl-color-brand-500)] hover:text-[color:var(--vtl-color-brand-700)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--vtl-color-focus-ring)]"
                >
                  <Icon />
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </footer>
  )
}
