import { HeartPulse, Instagram } from 'lucide-react'

const PRODUCT_LINKS = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Health Intelligence Hub', href: '/how-it-works' },
]

const COMPANY_LINKS = [
  { label: 'For Nutritionists', href: '/for-nutritionists' },
  { label: 'Help Center', href: '/help' },
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'For Investors', href: '/for-investors' },
]

const SOCIAL_LINKS = [
  { icon: Instagram, label: 'Instagram', href: 'https://www.instagram.com/vitaloop.today/' },
]

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-10">
      <div className="mx-auto grid w-full max-w-[1240px] gap-8 px-4 text-sm sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/90 text-white">
              <HeartPulse className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold tracking-tight">VITALOOP</span>
          </div>
          <p className="mt-4 max-w-md leading-relaxed text-slate-500">
            AI lab analysis, personalized protocols, and longitudinal biomarker tracking for people who want a repeatable health system instead of one-off interpretations.
          </p>
          <p className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-400">Not medical advice. Always work with a qualified clinician for diagnosis and treatment decisions.</p>
          <div className="mt-6 flex flex-col items-start gap-2">
            <a href="mailto:info@softdab.tech" className="text-left text-slate-500 underline-offset-2 hover:underline">
              info@softdab.tech
            </a>
            <p className="text-left text-slate-400">
              © 2026 VITALOOP. Made by{' '}
              <a
                href="https://softdab.tech"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 underline-offset-2 hover:text-emerald-600 hover:underline"
              >
                SoftDAB
              </a>
            </p>
          </div>
          <div className="mt-6 flex items-center gap-3">
            {SOCIAL_LINKS.map((link) => {
              const Icon = link.icon
              return (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-emerald-500/20 hover:text-emerald-600"
                >
                  <Icon className="h-4 w-4" />
                </a>
              )
            })}
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
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Company</div>
          <div className="mt-4 flex flex-col items-start gap-3 text-left">
            {COMPANY_LINKS.map((link) => (
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
