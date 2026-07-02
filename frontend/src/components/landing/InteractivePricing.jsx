import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import { useSubscription } from '../../hooks/useSubscription.js'
import { buildSignupPath, buildSignupRedirect, buildSubscriptionPath, SUBSCRIPTION_PLAN_IDS } from '../../lib/subscriptionFlow.js'

const PRICING = {
  monthly: [
    {
      name: 'Free',
      price: '$0',
      period: '/month',
      description: 'Start the loop and test VITALOOP with one real report',
      points: ['1 active lab upload', 'PDF/image biomarker extraction', 'Basic Knowledge summary', 'Safety-aware flags', 'Core dashboard'],
      cta: 'Try free',
      featured: false,
    },
    {
      name: 'Premium',
      price: '$19.99',
      period: '/month',
      description: 'For people actively tracking labs, symptoms, and protocol response',
      points: ['Unlimited uploads and retests', 'Full explainable Knowledge report', 'Priority action and retest plan', 'Weekly symptom check-ins', 'Progress and trend tracking', 'Protocol adaptation across cycles'],
      cta: 'Upgrade',
      featured: true,
    },
    {
      name: 'Pro Premium',
      price: '$99',
      period: '/month',
      description: 'For practitioners and laboratory/client workflows',
      points: ['Everything in Premium', 'Practitioner CRM workspace', 'Client and assignment workflows', 'Team roles and visibility', 'White-label/report preparation', 'Laboratory integration direction'],
      cta: 'Get Pro Premium',
      featured: false,
    },
  ],
  annual: [
    {
      name: 'Free',
      price: '$0',
      period: '/year',
      description: 'Start the loop and test VITALOOP with one real report',
      points: ['1 active lab upload', 'PDF/image biomarker extraction', 'Basic Knowledge summary', 'Safety-aware flags', 'Core dashboard'],
      cta: 'Try free',
      featured: false,
    },
    {
      name: 'Premium',
      price: '$199',
      period: '/year',
      description: 'For people actively tracking labs, symptoms, and protocol response',
      points: ['Unlimited uploads and retests', 'Full explainable Knowledge report', 'Priority action and retest plan', 'Weekly symptom check-ins', 'Progress and trend tracking', 'Save 17% vs monthly'],
      cta: 'Upgrade',
      featured: true,
    },
    {
      name: 'Pro Premium',
      price: '$990',
      period: '/year',
      description: 'For practitioners and laboratory/client workflows',
      points: ['Everything in Premium', 'Practitioner CRM workspace', 'Client and assignment workflows', 'Team roles and visibility', 'White-label/report preparation', 'Laboratory integration direction'],
      cta: 'Get Pro Premium',
      featured: false,
    },
  ],
}

export function InteractivePricing() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { planName } = useSubscription()
  const [isAnnual, setIsAnnual] = useState(false)
  const plans = isAnnual ? PRICING.annual : PRICING.monthly
  const currentPlanName = planName || SUBSCRIPTION_PLAN_IDS.FREE
  const rank = { free: 0, personal: 1, practitioner: 2 }
  const currentRank = user ? (rank[currentPlanName] ?? 0) : -1

  function getPlanId(plan) {
    if (plan.name === 'Premium') return SUBSCRIPTION_PLAN_IDS.PERSONAL
    if (plan.name === 'Pro Premium') return SUBSCRIPTION_PLAN_IDS.PRACTITIONER
    return SUBSCRIPTION_PLAN_IDS.FREE
  }

  function handlePlanClick(plan) {
    if (authLoading) return

    const planId = getPlanId(plan)
    const billingCycle = isAnnual ? 'yearly' : 'monthly'

    if (planId === SUBSCRIPTION_PLAN_IDS.FREE) {
      if (!user) {
        navigate(buildSignupPath())
        return
      }

      navigate('/dashboard')
      return
    }

    const targetUrl = buildSubscriptionPath({ planId, billingCycle })
    if (!user) {
      navigate(buildSignupRedirect({ planId, billingCycle }))
      return
    }

    navigate(targetUrl)
  }

  return (
    <section id="pricing" className="relative py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">Simple pricing</h2>
          <p className="text-lg text-slate-600 mb-8">Choose the plan that fits your health goals</p>

          {/* Toggle */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-4 bg-slate-100 border border-slate-300 rounded-full p-1 w-fit"
          >
            <motion.button
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-2 rounded-full font-semibold transition-colors ${
                !isAnnual
                  ? 'bg-emerald-500 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </motion.button>
            <motion.button
              onClick={() => setIsAnnual(true)}
              className={`px-6 py-2 rounded-full font-semibold transition-colors ${
                isAnnual
                  ? 'bg-emerald-500 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Annual
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Plans */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isAnnual ? 'annual' : 'monthly'}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="grid md:grid-cols-3 gap-8"
          >
            {plans.map((plan, i) => {
              const planId = getPlanId(plan)
              const planRank = rank[planId] ?? 0
              const isCurrentPlan = user && planId !== SUBSCRIPTION_PLAN_IDS.FREE && planId === currentPlanName
              const isDisabled = user ? planRank <= currentRank : false

              return (
                <PricingCard
                  key={plan.name}
                  plan={plan}
                  index={i}
                  isAnnual={isAnnual}
                  onClick={() => handlePlanClick(plan)}
                  isDisabled={isDisabled}
                  isCurrentPlan={isCurrentPlan}
                />
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

function PricingCard({ plan, index, isAnnual, onClick, isDisabled, isCurrentPlan }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      viewport={{ once: true }}
      className={`relative rounded-2xl border transition-all ${
        plan.featured
          ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-300 shadow-lg'
          : 'bg-white border-slate-200 hover:border-emerald-300'
      }`}
    >
      {/* Featured badge */}
      {plan.featured && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute -top-4 left-1/2 -translate-x-1/2"
        >
          <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 text-white px-4 py-1 rounded-full text-xs font-bold">
            Most popular
          </div>
        </motion.div>
      )}

      <div className="p-8">
        {/* Plan name */}
        <h3 className="text-2xl font-bold text-slate-900 mb-1">{plan.name}</h3>

        {/* Description */}
        <p className="text-sm text-slate-600 mb-6">{plan.description}</p>

        {/* Price */}
        <motion.div
          key={isAnnual ? 'annual-price' : 'monthly-price'}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <div className="text-4xl font-bold text-slate-900">
            {plan.price}
            <span className="text-lg text-slate-600 font-normal">{plan.period}</span>
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.button
          type="button"
          onClick={onClick}
          disabled={isDisabled}
          className={`w-full py-3 rounded-lg font-semibold mb-8 transition-all ${
            plan.featured
              ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
              : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 hover:border-emerald-300'
          } ${isDisabled ? 'cursor-default opacity-70' : ''}`}
        >
          {isCurrentPlan ? 'Current plan' : plan.cta}
        </motion.button>

        {/* Features */}
        <div className="space-y-4">
          {plan.points.map((point, i) => (
            <motion.div
              key={point}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              viewport={{ once: true }}
              className="flex items-center gap-3"
            >
              <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span className="text-slate-700">{point}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
