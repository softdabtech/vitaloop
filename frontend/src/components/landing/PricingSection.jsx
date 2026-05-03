import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Check, Minus } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { stagger, staggerChild, cardHoverProps, viewport } from '../../lib/motion.js'
import { LANDING_PRICING_PLANS, PRICING_PLAN_IDS } from '../../lib/pricing.js'

export default function PricingSection() {
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [billing, setBilling] = useState('monthly')

  const getPlanPrice = (plan) => {
    if (plan.id === PRICING_PLAN_IDS.ENTERPRISE && billing === 'yearly') {
      return { value: plan.yearly, period: '' }
    }
    if (billing === 'yearly' && plan.id !== PRICING_PLAN_IDS.FREE) {
      return { value: plan.yearly, period: '/year' }
    }
    return { value: plan.monthly, period: plan.period }
  }

  return (
    <section id="pricing" className="bg-zinc-50 px-6 py-20 md:py-24">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <motion.div
          variants={reduced ? {} : stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-60px')}
          className="mb-12 text-center md:mb-16"
        >
          <motion.div variants={reduced ? {} : staggerChild} className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">
            Pricing
          </motion.div>
          <motion.h2 variants={reduced ? {} : staggerChild} className="mb-4 text-balance text-3xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl">
            Freemium pricing built for users and practitioners
          </motion.h2>
          <motion.p variants={reduced ? {} : staggerChild} className="mx-auto max-w-2xl text-base leading-7 text-zinc-600 md:text-lg">
            Start free, upgrade to Premium, and scale with multi-tenancy CRM when your team is ready.
          </motion.p>
          <motion.div variants={reduced ? {} : staggerChild} className="mt-5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700">
              Early access — join before public launch
            </span>
          </motion.div>
          <motion.div variants={reduced ? {} : staggerChild} className="mt-6 flex justify-center">
            <div className="inline-flex gap-1 rounded-full border border-zinc-200 bg-white p-1 shadow-sm">
              <button
                onClick={() => setBilling('monthly')}
                className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  billing === 'monthly' ? 'bg-emerald-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  billing === 'yearly' ? 'bg-emerald-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                Yearly (save up to 17%)
              </button>
            </div>
          </motion.div>
        </motion.div>

        {/* Cards */}
        <motion.div
          variants={reduced ? {} : stagger(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-40px')}
          className="mb-9 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          {LANDING_PRICING_PLANS.map((plan) => {
            const { id, name, annualNote, desc, badge, dark, featured, premium, pricePrefix, cta, features } = plan
            const display = getPlanPrice(plan)
            const yearlyHighlight = id === PRICING_PLAN_IDS.PERSONAL || id === PRICING_PLAN_IDS.PRACTITIONER
            return (
              <motion.div
                key={id}
                variants={reduced ? {} : staggerChild}
              >
                <motion.div
                  className={`relative flex h-full flex-col overflow-hidden rounded-3xl border p-8 md:p-9 ${
                    featured
                      ? 'border-indigo-700 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white shadow-lg shadow-indigo-900/20'
                      : dark
                        ? 'border-zinc-800 bg-zinc-900 text-white shadow-lg shadow-zinc-900/15'
                        : premium
                          ? 'border-emerald-300 bg-white shadow-md shadow-emerald-100/60'
                          : 'border-zinc-200 bg-white shadow-sm'
                  }`}
                  {...(reduced ? {} : cardHoverProps)}
                >
                  {/* Badge */}
                  {badge && (
                    <div className={`absolute right-5 top-5 rounded-md px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] ${
                      featured ? 'bg-indigo-400 text-white' : dark ? 'bg-emerald-500 text-white' : 'border border-emerald-300 bg-emerald-50 text-emerald-700'
                    }`}>
                      {badge}
                    </div>
                  )}

                  {/* Plan name */}
                  <div className={`mb-3 text-sm font-semibold ${featured || dark ? 'text-indigo-200' : 'text-zinc-500'}`}>
                    {name}
                  </div>

                  {/* Price */}
                  <div className="mb-1 flex items-baseline gap-1">
                    {pricePrefix && billing === 'monthly' && (
                      <span className={`text-lg font-semibold ${featured || dark ? 'text-indigo-300' : 'text-zinc-500'}`}>
                        {pricePrefix}
                      </span>
                    )}
                    <span className={`text-5xl font-bold leading-none tracking-tight ${featured || dark ? 'text-white' : 'text-zinc-900'}`}>
                      {display.value}
                    </span>
                    {display.period && (
                      <span className={`mb-0.5 text-base ${featured ? 'text-indigo-300' : dark ? 'text-emerald-300' : 'text-zinc-400'}`}>
                        {display.period}
                      </span>
                    )}
                  </div>
                  {annualNote && (
                    <div className={`mb-4 inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${
                      yearlyHighlight
                        ? featured
                          ? 'bg-indigo-400/20 text-indigo-200'
                          : dark
                            ? 'bg-emerald-500/20 text-emerald-200'
                            : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : featured || dark
                          ? 'text-indigo-200'
                          : 'text-emerald-700'
                    }`}>
                      {annualNote}
                    </div>
                  )}

                  {/* Description */}
                  <p className={`mb-7 text-sm leading-6 ${featured ? 'text-indigo-200' : dark ? 'text-emerald-100' : 'text-zinc-600'}`}>
                    {desc}
                  </p>

                  {/* Features */}
                  <ul className="mb-8 flex flex-1 flex-col gap-3">
                    {features.map(({ text, ok }) => (
                      <li key={text} className="flex items-center gap-2.5 text-sm">
                        {ok
                          ? <Check size={14} className={`shrink-0 ${featured ? 'text-indigo-300' : dark ? 'text-emerald-300' : 'text-emerald-600'}`} aria-hidden="true" />
                          : <Minus size={14} className={`shrink-0 ${featured || dark ? 'text-white/30' : 'text-zinc-300'}`} aria-hidden="true" />
                        }
                        <span className={`${ok ? (featured ? 'text-indigo-100' : dark ? 'text-emerald-100' : 'text-zinc-700') : (featured || dark ? 'text-white/35' : 'text-zinc-300')}`}>
                          {text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => {
                      if (id === PRICING_PLAN_IDS.ENTERPRISE) {
                        const subject = encodeURIComponent('Enterprise Plan Inquiry')
                        window.location.href = `mailto:info@softdab.tech?subject=${subject}`
                        return
                      }
                      if (id === PRICING_PLAN_IDS.PRACTITIONER) {
                        const subject = encodeURIComponent('Practitioner Premium Application')
                        const body = encodeURIComponent(
                          'Hi VITALOOP team,\n\nI am interested in the Practitioner Premium plan.\n\n' +
                        'Name:\nSpecialty:\nNumber of patients:\n\nPlease contact me.'
                        )
                        window.location.href = `mailto:info@softdab.tech?subject=${subject}&body=${body}`
                        return
                      }
                      navigate('/login?signup=true')
                    }}
                    className="btn-primary min-h-[46px] rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-500"
                  >
                    {cta}
                  </button>
                </motion.div>
              </motion.div>
            )})}
        </motion.div>

        {/* Footer note */}
        <motion.div
          variants={reduced ? {} : staggerChild}
          initial="hidden"
          whileInView="visible"
          viewport={viewport('-40px')}
          className="text-center text-sm text-zinc-500"
        >
          All paid plans include secure storage, protocol updates, and onboarding support.
        </motion.div>

      </div>
    </section>
  )
}
