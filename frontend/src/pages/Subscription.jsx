import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CreditCard, CheckCircle2, AlertCircle, ArrowRight, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
import { useAuth } from '../hooks/useAuth.js'
import api from '../lib/api.js'
import { SUBSCRIPTION_PLAN_IDS } from '../lib/subscriptionFlow.js'
import { gaBeginCheckout, gaViewPricing } from '../lib/analytics.js'
import '../styles/dashboard2026.css'

const PLANS = {
  free: {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Get started',
    features: [
      'Basic symptom intake',
      'Single upload analysis access',
      'Starter protocol visibility',
      'Limited tracking access',
    ],
    color: 'slate',
  },
  basic: {
    name: 'Premium',
    price: '$19.99',
    period: '/month',
    description: 'Most popular',
    features: [
      'Symptom intake and smart question depth',
      'Lab direction plan with priorities',
      'Upload analysis linked to concerns',
      'Protocol loop with weekly adaptation',
      'Results & trends with retest tracking',
      'Clinician discussion-ready context',
      'Practitioner sharing readiness',
    ],
    color: 'emerald',
    yearly: '$199/year (save 17%)',
    cta: 'Get Started'
  },
  pro: {
    name: 'Pro',
    price: '$39.99',
    period: '/month',
    description: 'Coming soon',
    features: [
      'Everything in Premium',
      'Deeper loop intelligence',
      'Long-term trend and retest optimization',
      'Advanced adherence-response tracking',
      'Priority updates and support',
      'Early access to new features'
    ],
    color: 'blue',
    comingSoon: true
  },
}

// Plan mapping from frontend keys to backend IDs
const PLAN_KEY_TO_BACKEND = {
  'free': 'personal',
  'basic': 'personal',
  'pro': 'practitioner',
}

function navigateToUrl(url) {
  if (typeof window !== 'undefined') {
    window.location.href = url
  }
}

function openUrlInNewTab(url) {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank')
  }
}

// Special plan handlers
function handleEnterprisePlan() {
  navigateToUrl('mailto:sales@vitaloop.today?subject=Enterprise%20Plan%20Inquiry')
}

function handleComingSoonPlan() {
  toast.error('Pro plan coming soon!')
}

function resolvePlanSelectionAction(planKey, currentPlan) {
  if (planKey === currentPlan) return 'noop'
  if (planKey === 'enterprise') return 'enterprise'
  if (planKey === 'pro' || planKey === 'comingSoon') return 'coming_soon'
  return 'checkout'
}

function PlanCard({ plan, planKey, currentPlan, onSelect, isLoading }) {
  const isCurrentPlan = currentPlan === planKey
  const colorMap = {
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', button: 'bg-slate-600 hover:bg-slate-700' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', button: 'bg-emerald-600 hover:bg-emerald-700' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', button: 'bg-blue-600 hover:bg-blue-700' },
  }
  const colors = colorMap[plan.color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -4, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
      className={`rounded-2xl border-2 ${isCurrentPlan ? colors.border : 'border-slate-200'} ${colors.bg} p-6 sm:p-8 relative overflow-hidden transition-all`}
    >
      {isCurrentPlan && (
        <div className="absolute top-4 right-4 flex items-center gap-1 bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
          <CheckCircle2 className="w-3 h-3" />
          Active
        </div>
      )}

      {plan.comingSoon && !isCurrentPlan && (
        <div className="absolute top-4 right-4 flex items-center gap-1 bg-slate-400 text-white px-3 py-1 rounded-full text-xs font-semibold">
          Coming Soon
        </div>
      )}

      <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
      <div className="mb-6">
        <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
        <span className="text-sm text-slate-500 ml-2">{plan.period}</span>
        {plan.yearly && (
          <div className="text-xs text-emerald-700 font-semibold mt-2">{plan.yearly}</div>
        )}
      </div>

      <ul className="space-y-3 mb-8">
        {plan.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-slate-700">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(planKey)}
        disabled={isCurrentPlan || isLoading || plan.comingSoon}
        className={`w-full py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
          isCurrentPlan
            ? 'bg-slate-300 text-slate-600 cursor-default'
            : plan.comingSoon
              ? 'bg-slate-300 text-slate-600 cursor-default'
              : `${colors.button} text-white`
        }`}
      >
        {isCurrentPlan ? 'Current Plan' : plan.comingSoon ? 'Coming Soon' : planKey === 'pro' ? 'Upgrade' : 'Select Plan'}
        {!isCurrentPlan && !plan.comingSoon && planKey !== 'pro' && <ArrowRight className="w-4 h-4" />}
      </button>
    </motion.div>
  )
}

export default function Subscription() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)
  const autoCheckoutKey = useRef(null)

  const _planNameToKey = { personal: 'basic', practitioner: 'pro' }
  const currentPlan = subscription
    ? (subscription.is_premium
      ? (_planNameToKey[subscription.plan_name] || 'basic')
      : 'free')
    : 'free'
  const planStatus = subscription?.sub_status || 'free'
  const daysRemaining = subscription?.current_period_end ? Math.ceil((subscription.current_period_end - Date.now() / 1000) / 86400) : null
  const uploadCount = subscription?.upload_count || 0
  const uploadLimit = subscription?.upload_limit ?? null  // null means unlimited (premium)
  const isPremium = subscription?.is_premium ?? false
  const hasStripeCustomer = subscription?.has_stripe_customer ?? false

  useEffect(() => {
    loadSubscription()
  }, [user])

  useEffect(() => {
    gaViewPricing('subscription_page')
  }, [])

  async function loadSubscription() {
    setLoading(true)
    try {
      const { data } = await api.get('/stripe/subscription')
      setSubscription(data)
    } catch (error) {
      console.error('Failed to load subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectPlan(planKey, billingCycle = 'monthly') {
    const action = resolvePlanSelectionAction(planKey, currentPlan)
    if (action === 'noop') return
    if (action === 'enterprise') {
      handleEnterprisePlan()
      return
    }
    if (action === 'coming_soon') {
      handleComingSoonPlan()
      return
    }

    setUpgrading(true)
    try {
      const backendPlanId = PLAN_KEY_TO_BACKEND[planKey] || 'personal'
      gaBeginCheckout(`${backendPlanId}_${billingCycle}`)
      const { data } = await api.post('/stripe/checkout', { plan_id: backendPlanId, billing_cycle: billingCycle })
      if (data.checkout_url) {
        navigateToUrl(data.checkout_url)
      }
    } catch (error) {
      toast.error('Failed to initiate checkout')
      console.error(error)
    } finally {
      setUpgrading(false)
    }
  }

  useEffect(() => {
    if (loading || !user) return

    const requestedPlan = searchParams.get('plan')
    if (!requestedPlan) return

    const billingCycle = searchParams.get('billing') === 'yearly' ? 'yearly' : 'monthly'
    const normalizedPlan = requestedPlan === SUBSCRIPTION_PLAN_IDS.PERSONAL
      ? 'basic'
      : requestedPlan === SUBSCRIPTION_PLAN_IDS.PRACTITIONER
        ? 'pro'
        : requestedPlan
    const checkoutKey = `${normalizedPlan}:${billingCycle}`

    if (autoCheckoutKey.current === checkoutKey) return
    autoCheckoutKey.current = checkoutKey

    handleSelectPlan(normalizedPlan, billingCycle)
  }, [loading, user, searchParams, currentPlan])

  async function openBillingPortal() {
    if (!hasStripeCustomer) {
      navigate('/billing-history')
      return
    }
    setOpeningPortal(true)
    try {
      const { data } = await api.post('/stripe/portal')
      if (data.portal_url) {
        openUrlInNewTab(data.portal_url)
        toast.success('Opening billing portal...')
      } else {
        toast.error('Failed to load billing portal. Please try again.')
        console.error('No portal_url returned from API')
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to open billing portal'
      toast.error(errorMsg)
      console.error('Billing portal error:', error)
    } finally {
      setOpeningPortal(false)
    }
  }

  if (loading) {
    return (
      <>
        <CabinetPageHeader
          title={ct().subscription.title}
          subtitle={ct().subscription.subtitle}
          helper={ct().subscription.helper}
        />
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </>
    )
  }

  const timelineItems = Array.isArray(subscription?.timeline)
    ? subscription.timeline
    : [
      {
        date: subscription?.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString().slice(0, 10) : 'Current',
        title: isPremium ? 'Premium access active' : 'Free plan active',
        details: isPremium ? 'Renews automatically unless canceled.' : 'Upgrade anytime to unlock premium features.',
      },
    ]

  return (
    <div className="space-y-6">
      <CabinetPageHeader
        title={ct().subscription.title}
        subtitle={ct().subscription.subtitle}
        helper={ct().subscription.helper}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {subscription && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0 }}
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Current subscription</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                    planStatus === 'active'
                      ? 'bg-emerald-100 text-emerald-700'
                      : planStatus === 'paused'
                        ? 'bg-amber-100 text-amber-700'
                        : planStatus === 'free'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-700'
                  }`}>
                    {planStatus === 'active' && <CheckCircle2 className="w-4 h-4" />}
                    {planStatus === 'active' ? 'Active' : planStatus === 'paused' ? 'Paused' : planStatus === 'free' ? 'Free Plan' : 'Inactive'}
                  </div>
                  {planStatus !== 'active' && planStatus !== 'free' && (
                    <div className="flex items-center gap-1.5 text-amber-700 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      Your plan is {planStatus}
                    </div>
                  )}
                </div>
              </div>
              {isPremium && (
                <button
                  onClick={openBillingPortal}
                  disabled={openingPortal}
                  className="rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {openingPortal ? 'Opening...' : hasStripeCustomer ? 'Manage Billing' : 'Billing History'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Current Plan</div>
                <div className="text-2xl font-bold text-slate-900">{PLANS[currentPlan]?.name || 'Free'}</div>
              </div>

              {daysRemaining !== null && (
                <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200">
                  <div className="flex items-center gap-1 mb-2">
                    <Calendar className="w-3 h-3 text-emerald-600" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Renewal Date</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-700">{daysRemaining}d</div>
                </div>
              )}

              <div className="rounded-xl bg-blue-50 p-4 border border-blue-200">
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">Uploads</div>
                <div className="text-2xl font-bold text-blue-900">
                  {currentPlan === 'free' && uploadLimit !== null ? `${Math.max(0, uploadLimit - uploadCount)}/month` : 'Unlimited'}
                </div>
              </div>

              <div className="rounded-xl bg-indigo-50 p-4 border border-indigo-200">
                <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-2">Billing Status</div>
                <div className={`text-sm font-bold capitalize ${
                  planStatus === 'active' ? 'text-indigo-900' :
                    planStatus === 'free' ? 'text-blue-900' :
                      'text-amber-900'
                }`}>{planStatus === 'free' ? 'Free' : planStatus}</div>
              </div>
            </div>
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl border border-slate-200 bg-white p-6"
        >
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900"><CreditCard className="h-4 w-4 text-emerald-600" /> Subscription timeline</h3>
          <div className="space-y-3">
            {timelineItems.map((item, idx) => (
              <div key={`${item.date}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.date || '—'}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{item.title || 'Subscription event'}</p>
                <p className="mt-1 text-xs text-slate-600">{item.details || item.description || 'No additional details.'}</p>
              </div>
            ))}
          </div>
        </motion.section>
      </div>

      {subscription && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-6">Usage & limits</h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-slate-700">Lab Uploads</span>
                  {uploadLimit !== null ? (
                    <span className="text-sm font-semibold text-slate-500">{uploadCount} of {uploadLimit}</span>
                  ) : (
                    <span className="text-sm font-semibold text-emerald-600">Unlimited</span>
                  )}
                </div>
                {uploadLimit !== null && (
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{ width: `${Math.min((uploadCount / uploadLimit) * 100, 100)}%` }}
                    />
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  {currentPlan === 'free' ? 'Free plan: 1 upload every 30 days' : 'Upload lab reports for analysis'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Included Features</h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(subscription?.features || PLANS[currentPlan]?.features || []).map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.section>
      )}

      {currentPlan === 'free' && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="rounded-2xl border border-blue-200 bg-blue-50 p-6"
          >
            <h3 className="font-semibold text-blue-900 mb-3">💡 About Your Free Plan</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>You're currently using the Free plan which includes:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>1 lab report upload every 30 days</li>
                <li>Basic biomarker analysis</li>
                <li>Core dashboard access</li>
                <li>Community support</li>
              </ul>
              <p className="pt-2 text-blue-900 font-medium">Upgrade to Premium to unlock unlimited uploads and AI-powered protocols.</p>
            </div>
          </motion.section>
        )}

        {currentPlan === 'free' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-4">Choose a plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(PLANS).map(([key, plan]) => (
                <PlanCard
                  key={key}
                  planKey={key}
                  plan={plan}
                  currentPlan={currentPlan}
                  onSelect={handleSelectPlan}
                  isLoading={upgrading}
                />
              ))}
            </div>
          </motion.div>
        )}

        {isPremium && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="rounded-2xl border border-blue-200 bg-blue-50 p-6 sm:p-8"
          >
            <div className="flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">
                  {hasStripeCustomer ? 'Manage Payment Method & Billing' : 'Billing History'}
                </h4>
                <p className="text-sm text-blue-800 mb-4">
                  {hasStripeCustomer
                    ? 'Update your billing address, payment method, view invoices, and manage your subscription renewal.'
                    : 'View your subscription timeline and plan change history.'}
                </p>
                <button
                  onClick={openBillingPortal}
                  disabled={openingPortal}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {openingPortal ? 'Opening...' : hasStripeCustomer ? 'Open Billing Portal' : 'View Billing History'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-4">Questions About Your Plan?</h3>
          <p className="text-slate-600 mb-4">
            If you have any questions about your subscription, pricing, or need help choosing the right plan for your needs, please contact our support team.
          </p>
          <a
            href="mailto:support@vitaloop.today"
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900 transition"
          >
            Contact Support
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
    </div>
  )
}
