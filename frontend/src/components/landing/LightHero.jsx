import { ChevronRight, FileText, ListChecks, ShieldCheck, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CLIENT_PREMIUM_PLAN } from '../../lib/pricing.js'

const HERO_SCREENS = [
  {
    src: '/mockups/cabinet-real/upload-results.webp',
    alt: 'VITALOOP upload results cabinet screen',
    label: 'Upload results',
  },
  {
    src: '/mockups/example-report/lab-results.webp',
    alt: 'VITALOOP lab results table with biomarker status and ranges',
    label: 'Lab results',
  },
  {
    src: '/mockups/example-report/check-in.webp',
    alt: 'VITALOOP weekly check-in screen',
    label: 'Weekly check-in',
  },
]

const TRUST_CHIPS = [
  { icon: FileText, label: 'PDF/image lab upload' },
  { icon: Sparkles, label: 'Explainable Knowledge Base' },
  { icon: ListChecks, label: 'Priority report and retest plan' },
  { icon: ShieldCheck, label: 'Privacy-first flow' },
]

export function LightHero() {
  const navigate = useNavigate()

  return (
    <section className="relative overflow-hidden bg-white py-10 sm:py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Two-column grid */}
        <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-12 lg:gap-16 items-center">
          {/* LEFT: Content */}
          <div className="min-w-0 space-y-8">
            {/* Eyebrow badge */}
            <div className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 sm:rounded-full sm:px-4">
              <span className="min-w-0 whitespace-normal text-center text-[11px] font-semibold leading-4 text-teal-600 sm:text-sm">AI BLOOD TEST ANALYSIS + SYMPTOM CONTEXT</span>
            </div>

            {/* Headline */}
            <h1 className="max-w-full break-words text-[38px] font-bold leading-[1.04] tracking-[-0.035em] text-slate-900 sm:text-5xl lg:text-6xl">
              Understand your symptoms
              <br className="hidden sm:block" />
              {' '}
              <span className="bg-gradient-to-r from-teal-600 to-teal-500 bg-clip-text text-transparent">
                and blood test results
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg text-slate-600 leading-relaxed max-w-xl space-y-3">
              <span className="block">Start with symptoms. Upload labs when you have them.</span>
              <span className="block font-semibold text-slate-900">From scattered signals to an explainable health report.</span>
              <span className="block text-base text-slate-500">
                VITALOOP explains biomarker results in plain language and organizes priority findings, clinician discussion points, retest timing, and weekly follow-through.
              </span>
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                onClick={() => navigate('/symptom-intake')}
                className="group px-8 py-4 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                Start with symptoms
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => navigate('/example-report')}
                className="px-8 py-4 border-2 border-teal-500 text-teal-600 hover:bg-teal-50 rounded-lg font-semibold transition-all"
              >
                See example report
              </button>
            </div>

            <div className="hidden flex-wrap gap-2 sm:flex">
              {TRUST_CHIPS.map((chip) => {
                const Icon = chip.icon
                return (
                  <span key={chip.label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                    <Icon className="h-4 w-4 text-teal-600" />
                    {chip.label}
                  </span>
                )
              })}
            </div>

            {/* Key stats */}
            <div className="hidden grid-cols-2 gap-6 border-t border-slate-200 pt-8 sm:grid">
              <div>
                {/* Read from lib/pricing.js instead of a hardcoded string —
                    this exact stat drifted to a stale "$19.99/mo" (the real
                    price is $4.99/mo) because it was a fourth independent
                    copy of the number; sourcing it removes that failure mode
                    here. */}
                <div className="text-2xl font-bold text-slate-900">{CLIENT_PREMIUM_PLAN.monthly}/mo</div>
                <div className="text-sm text-slate-600">Premium plan</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">85+</div>
                <div className="text-sm text-slate-600">Biomarkers analyzed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">1 upload</div>
                <div className="text-sm text-slate-600">Free plan includes one lab upload</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">One loop</div>
                <div className="text-sm text-slate-600">Symptoms, labs, actions, and retests</div>
              </div>
            </div>
          </div>

          {/* RIGHT: Product workflow preview */}
          <div className="min-w-0 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[660px]">
              <div className="absolute inset-6 rounded-[36px] bg-gradient-to-br from-teal-100 via-sky-50 to-white blur-3xl" />
              <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_28px_80px_rgba(15,23,42,0.16)] sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-4 px-1 sm:mb-4 sm:px-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Live product flow</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-900 sm:text-base">Upload → Results → Weekly follow-through</p>
                  </div>
                  <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 sm:inline-flex">Real product screens</span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img
                    src={HERO_SCREENS[0].src}
                    alt={HERO_SCREENS[0].alt}
                    width="1792"
                    height="928"
                    fetchPriority="high"
                    decoding="async"
                    className="aspect-[1.93/1] w-full object-cover object-top"
                  />
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {HERO_SCREENS.slice(1).map((screen) => (
                    <div key={screen.label} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                        <span className="text-xs font-bold text-slate-700">{screen.label}</span>
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      </div>
                      <img
                        src={screen.src}
                        alt={screen.alt}
                        width="1600"
                        height="1000"
                        loading="lazy"
                        decoding="async"
                        className="aspect-[1.6/1] w-full object-cover object-top"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    ['85+', 'biomarkers'],
                    ['Clear', 'priority report'],
                    ['Weekly', 'progress loop'],
                  ].map(([value, label]) => (
                    <div key={label} className="rounded-xl bg-slate-50 px-2 py-3 text-center">
                      <p className="text-sm font-black text-slate-900 sm:text-base">{value}</p>
                      <p className="mt-0.5 text-[10px] font-semibold text-slate-500 sm:text-xs">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-teal-50 rounded-full opacity-30 blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-50 rounded-full opacity-20 blur-3xl -z-10" />
    </section>
  )
}
