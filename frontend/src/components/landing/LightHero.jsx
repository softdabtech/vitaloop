import { ChevronRight, FileText, ListChecks, ShieldCheck, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const HERO_SCREENS = [
  {
    src: '/mockups/cabinet-real/upload-results.png',
    alt: 'VITALOOP upload results cabinet screen',
    label: 'Dashboard',
    className: 'vl-hero-shot-main',
  },
  {
    src: '/mockups/example-report/lab-results.png',
    alt: 'VITALOOP lab results table with biomarker status and ranges',
    label: 'Lab results',
    className: 'vl-hero-shot-side vl-hero-shot-results',
  },
  {
    src: '/mockups/example-report/check-in.png',
    alt: 'VITALOOP weekly check-in screen',
    label: 'Check-in',
    className: 'vl-hero-shot-side vl-hero-shot-checkin',
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
      <style>{`
        .vl-hero-shot-main { transform: rotate(-1deg); }
        .vl-hero-shot-results { transform: rotate(2.5deg); }
        .vl-hero-shot-checkin { transform: rotate(-2deg); }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Two-column grid */}
        <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-12 lg:gap-16 items-center">
          {/* LEFT: Content */}
          <div className="space-y-8">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-200 rounded-full">
              <span className="text-teal-600 font-semibold text-sm">AI BLOOD TEST ANALYSIS + SYMPTOM CONTEXT</span>
            </div>

            {/* Headline */}
            <h1 className="text-[44px] font-bold leading-[1.04] text-slate-900 sm:text-5xl lg:text-6xl">
              Understand your symptoms
              <br />
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
                <div className="text-2xl font-bold text-slate-900">$19.99/mo</div>
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

          {/* RIGHT: Animated product screens */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative h-[380px] w-full max-w-[620px] sm:h-[500px] lg:h-[560px]">
              <div className="absolute inset-4 rounded-[36px] bg-gradient-to-br from-teal-100 via-sky-50 to-white blur-2xl" />
              <div className="absolute left-4 right-4 top-8 rounded-[28px] border border-slate-200 bg-white/70 p-3 shadow-2xl backdrop-blur sm:left-8 sm:right-8">
                <div className="mb-3 flex items-center justify-between px-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Live product flow</p>
                    <p className="text-sm font-semibold text-slate-900">Cabinet → Upload → Report</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Report ready</span>
                </div>
                <img
                  src={HERO_SCREENS[0].src}
                  alt={HERO_SCREENS[0].alt}
                  className={`${HERO_SCREENS[0].className} w-full rounded-2xl border border-slate-200 bg-white shadow-xl`}
                />
              </div>

              <div className="absolute -left-1 bottom-14 w-[52%] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl sm:left-0 sm:bottom-10">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-slate-800">Upload results</span>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">3 review</span>
                </div>
                <img
                  src={HERO_SCREENS[1].src}
                  alt={HERO_SCREENS[1].alt}
                  className={`${HERO_SCREENS[1].className} w-full rounded-xl border border-slate-100`}
                />
              </div>

              <div className="absolute -right-1 bottom-2 w-[34%] rounded-[24px] border border-slate-200 bg-white p-2 shadow-2xl sm:right-3 sm:bottom-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold text-slate-800">Weekly loop</span>
                </div>
                <img
                  src={HERO_SCREENS[2].src}
                  alt={HERO_SCREENS[2].alt}
                  className={`${HERO_SCREENS[2].className} w-full rounded-[18px] border border-slate-100`}
                />
              </div>

              <div className="absolute right-4 top-4 hidden rounded-2xl border border-emerald-200 bg-white/95 px-4 py-3 shadow-xl sm:block">
                <p className="text-xs font-semibold text-slate-500">Knowledge report</p>
                <p className="mt-1 text-xl font-bold text-slate-900">85+ markers</p>
                <p className="text-xs font-medium text-emerald-700">Explainable patterns</p>
              </div>

              <div className="absolute left-6 top-[44%] hidden rounded-2xl border border-sky-200 bg-white/95 px-4 py-3 shadow-xl sm:block">
                <p className="text-xs font-semibold text-slate-500">Next step</p>
                <p className="mt-1 text-sm font-bold text-slate-900">Retest plan generated</p>
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
