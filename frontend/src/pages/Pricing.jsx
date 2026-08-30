import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { gaViewPricing } from '../lib/analytics.js'
import { LANDING_PRICING_PLANS } from '../lib/pricing.js'
import Seo from '../components/Seo.jsx'
import Footer from '../components/landing/Footer.jsx'

export default function Pricing() {
  useEffect(() => {
    gaViewPricing('marketing_pricing_page')
  }, [])

  const free = LANDING_PRICING_PLANS.find((plan) => plan.id === 'free')
  const premium = LANDING_PRICING_PLANS.find((plan) => plan.id === 'personal')

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Seo
        title="Pricing | VITALOOP Premium"
        description="VITALOOP pricing: start free, or upgrade to Premium for full lab analysis, explainable reports, protocols, progress tracking, and weekly check-ins."
        path="/pricing"
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-20">
        <Link to="/" className="text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline">← Back to VITALOOP</Link>
        <section className="mt-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Simple pricing
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Choose how deeply you want VITALOOP to support your health loop.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            VITALOOP is educational health intelligence. It helps organize symptoms, lab results, safety context, questions for a clinician, retest timing, and progress tracking. It does not diagnose, treat, prescribe, or replace professional medical care.
          </p>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-2">
          {[free, premium].filter(Boolean).map((plan) => (
            <article key={plan.id} className={`rounded-3xl border p-6 shadow-sm ${plan.featured ? 'border-emerald-200 bg-white ring-2 ring-emerald-100' : 'border-slate-200 bg-white'}`}>
              {plan.badge && (
                <div className="mb-4 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
                  {plan.badge}
                </div>
              )}
              <h2 className="text-2xl font-black text-slate-950">{plan.name}</h2>
              <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-600">{plan.desc}</p>
              <div className="mt-6 flex items-end gap-2">
                <span className="text-5xl font-black tracking-tight">{plan.monthly}</span>
                {plan.period && <span className="pb-2 text-sm font-semibold text-slate-500">{plan.period}</span>}
              </div>
              {plan.yearly !== plan.monthly && (
                <p className="mt-2 text-sm font-semibold text-emerald-700">{plan.yearly}/year · {plan.annualNote}</p>
              )}
              <ul className="mt-6 grid gap-3">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
                    <CheckCircle2 className={`mt-1 h-4 w-4 shrink-0 ${feature.ok ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <span>{feature.text}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={plan.id === 'personal' ? '/login?returnUrl=/subscription' : '/login?signup=true'}
                className={`mt-7 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold transition ${plan.featured ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50'}`}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600">
          <h2 className="text-xl font-black text-slate-950">Billing and cancellation</h2>
          <p className="mt-3">Premium access is currently activated manually. VITALOOP does not send uploaded lab files, symptoms, biomarker values, health reports, or protocol text to billing tools.</p>
          <p className="mt-2">You can request billing help, cancellation support, or refund review at <a className="font-bold text-emerald-700 underline" href="mailto:info@softdab.tech">info@softdab.tech</a>.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="font-bold text-emerald-700 underline" to="/refund-policy/">Refund policy</Link>
            <Link className="font-bold text-emerald-700 underline" to="/terms/">Terms</Link>
            <Link className="font-bold text-emerald-700 underline" to="/privacy-policy/">Privacy policy</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
