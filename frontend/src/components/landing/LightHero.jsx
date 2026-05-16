import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function LightHero() {
  const navigate = useNavigate()

  return (
    <section className="relative bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Two-column grid */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* LEFT: Content */}
          <div className="space-y-8">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-200 rounded-full">
              <span className="text-teal-600 font-semibold text-sm">✨ AI LAB INTELLIGENCE</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl lg:text-6xl font-bold text-slate-900 leading-tight">
              Spent $400 on blood tests.
              <br />
              <span className="bg-gradient-to-r from-teal-600 to-teal-500 bg-clip-text text-transparent">
                Don't know what to do?
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg text-slate-600 leading-relaxed max-w-xl space-y-3">
              <span className="block">Upload your PDF. Get a comprehensive protocol with dosages.</span>
              <span className="block font-semibold text-slate-900">Not interpretation. Execution.</span>
              <span className="block text-base text-slate-500">
                Stop wasting time decoding lab results. Get a personalized action plan ranked by priority, with exact supplement dosages, meal timing, and weekly milestones to track real progress.
              </span>
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                onClick={() => navigate('/upload')}
                className="group px-8 py-4 bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                Upload Lab PDF (Free)
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => navigate('/for-nutritionists')}
                className="px-8 py-4 border-2 border-teal-500 text-teal-600 hover:bg-teal-50 rounded-lg font-semibold transition-all"
              >
                For Nutritionists
              </button>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-2 gap-6 pt-8 border-t border-slate-200">
              <div>
                <div className="text-2xl font-bold text-slate-900">$19.99/mo</div>
                <div className="text-sm text-slate-600">vs $400 spent</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">12 weeks</div>
                <div className="text-sm text-slate-600">See real results</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">68 ng/mL</div>
                <div className="text-sm text-slate-600">Ferritin: 14 → 68 in 12 weeks</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">100%</div>
                <div className="text-sm text-slate-600">Personalized to your labs</div>
              </div>
            </div>
          </div>

          {/* RIGHT: Illustration */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-lg">
              <img
                src="/images/woman-health-dashboard.webp"
                alt="Woman reviewing health improvement dashboard"
                className="w-full h-auto rounded-2xl shadow-2xl"
              />
              {/* Subtle glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-teal-500/20 to-transparent pointer-events-none" />
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
