import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { Check } from 'lucide-react'

const PRICING = {
  monthly: [
    {
      name: 'Free',
      price: '$0',
      period: '/month',
      points: ['1 active upload', 'Basic biomarker summary', 'Core dashboard'],
      cta: 'Try free',
      featured: false,
    },
    {
      name: 'Personal Premium',
      price: '$9.99',
      period: '/month',
      points: ['Unlimited uploads', 'Personalized protocol', 'Weekly AI check-ins', 'Priority insights'],
      cta: 'Upgrade',
      featured: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'contact sales',
      points: ['Practitioner CRM', 'Multi-client dashboards', 'API access', 'Custom integration'],
      cta: 'Contact',
      featured: false,
    },
  ],
  annual: [
    {
      name: 'Free',
      price: '$0',
      period: '/year',
      points: ['1 active upload', 'Basic biomarker summary', 'Core dashboard'],
      cta: 'Try free',
      featured: false,
    },
    {
      name: 'Personal Premium',
      price: '$95',
      period: '/year',
      points: ['Unlimited uploads', 'Personalized protocol', 'Weekly AI check-ins', 'Priority insights', 'Save 21%'],
      cta: 'Upgrade',
      featured: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'contact sales',
      points: ['Practitioner CRM', 'Multi-client dashboards', 'API access', 'Custom integration'],
      cta: 'Contact',
      featured: false,
    },
  ],
}

export function InteractivePricing() {
  const [isAnnual, setIsAnnual] = useState(false)
  const plans = isAnnual ? PRICING.annual : PRICING.monthly

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
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">Simple pricing</h2>
          <p className="text-lg text-slate-400 mb-8">Choose the plan that fits your health goals</p>

          {/* Toggle */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-4 bg-slate-800/50 backdrop-blur border border-slate-700 rounded-full p-1 w-fit"
          >
            <motion.button
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-2 rounded-full font-semibold transition-colors ${
                !isAnnual
                  ? 'bg-teal-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Monthly
            </motion.button>
            <motion.button
              onClick={() => setIsAnnual(true)}
              className={`px-6 py-2 rounded-full font-semibold transition-colors ${
                isAnnual
                  ? 'bg-teal-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
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
            {plans.map((plan, i) => (
              <PricingCard key={plan.name} plan={plan} index={i} isAnnual={isAnnual} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

function PricingCard({ plan, index, isAnnual }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      viewport={{ once: true }}
      whileHover={plan.featured ? { y: -8, boxShadow: '0 20px 25px -5px rgba(20, 184, 166, 0.2)' } : undefined}
      className={`relative rounded-2xl border transition-all ${
        plan.featured
          ? 'bg-gradient-to-br from-teal-500/10 to-emerald-500/5 border-teal-500/50 shadow-lg'
          : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'
      }`}
    >
      {/* Featured badge */}
      {plan.featured && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute -top-4 left-1/2 -translate-x-1/2"
        >
          <div className="bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-900 px-4 py-1 rounded-full text-xs font-bold">
            Most popular
          </div>
        </motion.div>
      )}

      <div className="p-8">
        {/* Plan name */}
        <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>

        {/* Price */}
        <motion.div
          key={isAnnual ? 'annual-price' : 'monthly-price'}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <div className="text-4xl font-bold text-white">
            {plan.price}
            <span className="text-lg text-slate-400 font-normal">{plan.period}</span>
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`w-full py-3 rounded-lg font-semibold mb-8 transition-all ${
            plan.featured
              ? 'bg-teal-500 hover:bg-teal-400 text-white'
              : 'bg-slate-700/50 hover:bg-slate-700 text-white border border-slate-600'
          }`}
        >
          {plan.cta}
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
              <Check className="w-5 h-5 text-teal-400 flex-shrink-0" />
              <span className="text-slate-300">{point}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
