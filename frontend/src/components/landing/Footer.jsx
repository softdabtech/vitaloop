import BrandMark from './BrandMark.jsx'

const PRODUCT_LINKS = [
  { label: 'How it works', href: '/#problem' },
  { label: 'Example report', href: '/example-report' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Help Center', href: '/help' },
  { label: 'Health Intelligence Hub', href: '/health-hub/' },
  { label: 'Fatigue & low energy', href: '/health-hub/topics/fatigue-low-energy/' },
  { label: 'Blood test biomarkers', href: '/health-hub/topics/blood-test-biomarkers/' },
]

const COMPANY_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'For practitioners', href: '/for-nutritionists' },
  { label: 'For laboratories', href: '/for-nutritionists' },
  { label: 'For investors', href: '/for-investors' },
]

const TRUST_LINKS = [
  { label: 'Privacy & security', href: '/privacy-policy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Editorial policy', href: '/editorial-policy/' },
  { label: 'Medical review policy', href: '/medical-review-policy/' },
  { label: 'Medical disclaimer', href: '/terms' },
]

const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://www.instagram.com/vitaloop_today/' },
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

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-10">
      <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-4 text-sm sm:px-6 lg:grid-cols-[1.25fr_0.7fr_0.7fr_0.7fr]">
        <div>
          <div className="flex items-center gap-2">
            <BrandMark />
          </div>
          <p className="mt-4 max-w-md leading-relaxed text-slate-500">
            Symptom-first lab intelligence, explainable Knowledge reports, and weekly health-loop tracking for people and professional teams.
          </p>
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-slate-600">Not medical advice. Always work with a qualified clinician for diagnosis and treatment decisions.</p>
          <div className="mt-6 flex flex-col items-start gap-2">
            <a href="mailto:info@softdab.tech" className="text-left text-slate-500 underline-offset-2 hover:underline">
              info@softdab.tech
            </a>
            <p className="text-left text-slate-600">
              © 2026 VITALOOP. Made by{' '}
              <a
                href="https://softdab.tech"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 underline decoration-current underline-offset-2 hover:text-emerald-600"
              >
                SoftDAB
              </a>
            </p>
          </div>
          <div className="mt-6 flex items-center gap-3">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-emerald-500/20 hover:text-emerald-600"
              >
                <InstagramIcon />
              </a>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Product</div>
          <div className="mt-4 flex flex-col gap-3">
            {PRODUCT_LINKS.map((link) => (
              <a key={link.label} href={link.href} className="text-left text-slate-500 underline-offset-2 hover:underline">
                {link.label}
              </a>
            ))}
            <a
              href="https://www.producthunt.com/products/softdab-custom-data-encryption-solution?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-vitaloop-ai-health-protocol-platform"
              target="_blank"
              rel="noopener noreferrer"
              className="pt-1"
            >
              <img
                alt="VITALOOP - AI Health Protocol Platform - Turn lab results into personalized health action | Product Hunt"
                width="250"
                height="54"
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1154180&theme=light&t=1779636101269"
                loading="lazy"
              />
            </a>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Professionals</div>
          <div className="mt-4 flex flex-col items-start gap-3 text-left">
            {COMPANY_LINKS.map((link) => (
              <a key={link.label} href={link.href} className="text-left text-slate-500 underline-offset-2 hover:underline">
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Trust</div>
          <div className="mt-4 flex flex-col items-start gap-3 text-left">
            {TRUST_LINKS.map((link) => (
              <a key={link.label} href={link.href} className="text-left text-slate-500 underline-offset-2 hover:underline">
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
