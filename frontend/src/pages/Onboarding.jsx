import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Shield, Sparkles, User } from 'lucide-react'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import api from '../lib/api.js'
import { trackFunnelEvent } from '../lib/funnel.js'
import { gaOnboardingComplete } from '../lib/analytics.js'
import toast from 'react-hot-toast'

const INTENT_OPTIONS = [
  { id: 'symptoms', label: 'I have symptoms and want to know what to check' },
  { id: 'labs', label: 'I already have lab results' },
  { id: 'baseline', label: 'I want a long-term health baseline' },
  { id: 'practitioner', label: 'My practitioner invited me' },
]

const GOAL_OPTIONS = [
  { id: 'energy', label: 'Energy and focus' },
  { id: 'sleep', label: 'Sleep quality' },
  { id: 'recovery', label: 'Recovery and resilience' },
  { id: 'metabolic', label: 'Metabolic health' },
  { id: 'hormonal', label: 'Hormonal balance' },
  { id: 'prevention', label: 'Prevention and longevity' },
]

const BODY_AREAS = ['General', 'Head', 'Chest', 'Abdomen', 'Back', 'Arms', 'Legs', 'Skin', 'Mood/Cognition']
const DURATION_OPTIONS = ['A few days', '1-2 weeks', '2-6 weeks', '2-6 months', 'More than 6 months']

function getViewportWidth() {
  if (typeof window === 'undefined') return 1024
  return window.innerWidth
}

function parseCsvList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function toCommaSeparatedString(value) {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'string') return value
  return ''
}

function splitFullName(fullName) {
  const normalized = String(fullName || '').trim().replace(/\s+/g, ' ')
  if (!normalized) return { first_name: '', last_name: '' }
  const parts = normalized.split(' ')
  if (parts.length === 1) return { first_name: parts[0], last_name: '' }
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') }
}

function buildSafetySummary(safety) {
  const notes = []
  if (safety.allergies) notes.push(`Allergies: ${safety.allergies}`)
  if (safety.pregnancy) notes.push(`Pregnancy/Breastfeeding: ${safety.pregnancy}`)
  if (safety.redFlags.length > 0) notes.push(`Red flags selected: ${safety.redFlags.join(', ')}`)
  return notes.join(' | ')
}

const s = {
  wrap: {
    minHeight: '100vh',
    background: '#f8fafc',
    color: '#0f172a',
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '24px 16px',
  },
  card: {
    width: '100%',
    maxWidth: 640,
    background: '#ffffff',
    border: '1px solid rgba(15,23,42,0.08)',
    borderRadius: 24,
    padding: '36px 30px',
    boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
  },
  title: { fontSize: 26, fontWeight: 700, color: '#0f172a', marginBottom: 6 },
  sub: { fontSize: 15, color: '#64748b', marginBottom: 22, lineHeight: 1.55 },
  label: { display: 'block', fontSize: 12, color: '#475569', marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' },
  input: { width: '100%', background: '#f8fafc', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 10, padding: '12px 14px', color: '#0f172a', fontSize: 15, outline: 'none', boxSizing: 'border-box', minHeight: '44px' },
  textarea: { width: '100%', background: '#f8fafc', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 10, padding: '12px 14px', color: '#0f172a', fontSize: 15, outline: 'none', boxSizing: 'border-box', minHeight: '98px', resize: 'vertical' },
  btnPrimary: { width: '100%', padding: '14px', background: '#10b981', borderRadius: 12, color: '#ffffff', fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer', minHeight: '44px' },
  btnSec: { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, marginTop: 12, textDecoration: 'underline', padding: 0 },
  progress: { display: 'flex', gap: 6, marginBottom: 28 },
  dot: (active, done) => ({
    height: 4,
    flex: 1,
    borderRadius: 2,
    background: done ? '#10b981' : active ? 'rgba(16,185,129,0.5)' : 'rgba(15,23,42,0.1)',
    transition: 'background 0.3s',
  }),
}

export default function Onboarding() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(getViewportWidth)

  const [orgCheckDone, setOrgCheckDone] = useState(false)
  const [needsOrg, setNeedsOrg] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [orgSaving, setOrgSaving] = useState(false)

  const [intent, setIntent] = useState('')
  const [hasLabsNow, setHasLabsNow] = useState(null)
  const [practitionerConfirmed, setPractitionerConfirmed] = useState(false)
  const [baselineFocus, setBaselineFocus] = useState('')

  const [concern, setConcern] = useState({
    summary: '',
    duration: '',
    severity: 5,
    body_area: 'General',
    triggers: '',
    related_symptoms: '',
    tried: '',
  })

  const [safety, setSafety] = useState({
    medications: '',
    supplements: '',
    allergies: '',
    pregnancy: '',
    redFlags: [],
  })

  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    height_cm: '',
    weight_kg: '',
    goals: [],
    country: '',
  })

  const redFlagOptions = useMemo(() => [
    'Sudden severe symptom change',
    'New chest pain or shortness of breath',
    'Fainting, numbness, or weakness',
    'High fever with rapid worsening',
    'Recent injury with persistent pain',
  ], [])

  const steps = useMemo(() => {
    return ['Intent', 'Main context', 'Smart follow-ups', 'Safety context', 'Profile basics', 'First action']
  }, [])

  const TOTAL = steps.length

  useEffect(() => {
    api.get('/auth/me').then((r) => {
      const memberships = r.data?.memberships
      const globalRole = String(r.data?.user?.global_role || r.data?.global_role || '').toLowerCase()
      const fullName = r.data?.user?.full_name || ''
      const nameParts = splitFullName(fullName)

      setProfile((prev) => ({
        ...prev,
        first_name: prev.first_name || nameParts.first_name,
        last_name: prev.last_name || nameParts.last_name,
      }))

      const requiresOrg = globalRole === 'org_admin' || globalRole === 'super_admin'
      const hasMembership = Array.isArray(memberships) && memberships.length > 0
      setNeedsOrg(requiresOrg && !hasMembership)
      setOrgCheckDone(true)
    }).catch(() => {
      setNeedsOrg(false)
      setOrgCheckDone(true)
    })
  }, [])

  useEffect(() => {
    api.get('/profile').then((r) => {
      const p = r.data?.profile || {}
      const loc = r.data?.location || {}
      setProfile((prev) => ({
        ...prev,
        height_cm: p.height_cm || '',
        weight_kg: p.weight_kg || '',
        goals: Array.isArray(p.goals) ? p.goals.filter((goal) => !String(goal).startsWith('intent:')) : [],
        country: loc.country || '',
      }))
      setSafety((prev) => ({
        ...prev,
        supplements: toCommaSeparatedString(p.current_supplements),
        medications: toCommaSeparatedString(p.current_medications),
      }))
      if (p.onboarding_complete) {
        navigate('/dashboard', { replace: true })
      }
    }).catch(() => {})
  }, [navigate])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const toggleGoal = (id) => {
    setProfile((prev) => ({
      ...prev,
      goals: prev.goals.includes(id) ? prev.goals.filter((goal) => goal !== id) : [...prev.goals, id],
    }))
  }

  const toggleRedFlag = (label) => {
    setSafety((prev) => ({
      ...prev,
      redFlags: prev.redFlags.includes(label)
        ? prev.redFlags.filter((item) => item !== label)
        : [...prev.redFlags, label],
    }))
  }

  const validateCurrentStep = () => {
    if (step === 0 && !intent) {
      toast.error('Select what brought you to VITALOOP today.')
      return false
    }

    if (step === 1) {
      if (intent === 'symptoms' && !concern.summary.trim()) {
        toast.error('Describe your main concern to continue.')
        return false
      }
      if (intent === 'labs' && hasLabsNow === null) {
        toast.error('Tell us whether you already have labs to upload.')
        return false
      }
      if (intent === 'practitioner' && !practitionerConfirmed) {
        toast.error('Please confirm practitioner relationship to continue.')
        return false
      }
      if (intent === 'baseline' && !baselineFocus.trim()) {
        toast.error('Choose what you want to improve first.')
        return false
      }
    }

    if (step === 2 && intent === 'symptoms') {
      if (!concern.duration || !concern.severity) {
        toast.error('Add duration and severity so we can prioritize safely.')
        return false
      }
    }

    return true
  }

  const goNext = () => {
    if (!validateCurrentStep()) return
    setStep((prev) => Math.min(prev + 1, TOTAL - 1))
  }

  const buildConcernPayload = () => {
    if (intent === 'symptoms' && concern.summary.trim()) {
      return {
        complaint: concern.summary.trim(),
        duration_description: `${concern.duration || 'Not specified'} | Severity ${concern.severity}/10 | Area: ${concern.body_area}`,
        tried_interventions: [
          concern.tried ? `Tried: ${concern.tried}` : null,
          concern.triggers ? `Triggers: ${concern.triggers}` : null,
          concern.related_symptoms ? `Related: ${concern.related_symptoms}` : null,
        ].filter(Boolean).join(' | '),
      }
    }

    if (intent === 'labs') {
      return {
        complaint: hasLabsNow ? 'User has existing labs and wants interpretation context' : 'User needs lab direction before upload',
        duration_description: 'Lab-first path',
        tried_interventions: concern.summary ? `Focus: ${concern.summary}` : undefined,
      }
    }

    if (intent === 'baseline' && baselineFocus.trim()) {
      return {
        complaint: `Baseline focus: ${baselineFocus.trim()}`,
        duration_description: 'Long-term baseline path',
        tried_interventions: undefined,
      }
    }

    return null
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      const fullName = [profile.first_name, profile.last_name]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(' ')

      const derivedGoals = [...profile.goals, `intent:${intent}`]
      const profilePayload = {
        full_name: fullName || undefined,
        height_cm: profile.height_cm ? Number(profile.height_cm) : undefined,
        weight_kg: profile.weight_kg ? Number(profile.weight_kg) : undefined,
        goals: derivedGoals,
        current_supplements: parseCsvList(safety.supplements),
        current_medications: parseCsvList(safety.medications),
        prior_diagnoses: buildSafetySummary(safety) || undefined,
        onboarding_complete: true,
      }

      await api.patch('/profile', profilePayload)

      if (profile.country.trim()) {
        await api.patch('/profile/location', { country: profile.country.trim() })
      }

      const complaintPayload = buildConcernPayload()
      if (complaintPayload?.complaint) {
        await api.post('/complaints', complaintPayload)
      }

      await api.post('/auth/onboarding/complete')

      gaOnboardingComplete()
      trackFunnelEvent('funnel_onboarding_completed', 'User completed symptom-first onboarding', {
        intent,
        red_flags_count: safety.redFlags.length,
      }, { oncePerSession: true })

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['timeline'] }),
        queryClient.invalidateQueries({ queryKey: ['insights'] }),
        queryClient.invalidateQueries({ queryKey: ['health-score'] }),
      ])

      toast.success('Your first health loop is ready. Continue in Today.')
      navigate('/dashboard', { replace: true })
    } catch {
      toast.error('Failed to save onboarding details. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSkipOnboarding = async () => {
    try {
      await api.post('/auth/onboarding/skip')
      trackFunnelEvent('funnel_onboarding_skipped', 'User skipped onboarding and entered dashboard', {
        stage: steps[step] || 'unknown',
      }, { oncePerSession: true })
      toast('Setup skipped. You can complete it later from Profile & Safety.', {
        icon: 'ℹ️',
        style: { background: '#fef9c3', color: '#92400e', fontSize: 14 },
      })
    } catch {
      // Fail-open.
    }
    navigate('/dashboard', { replace: true })
  }

  const handleCreateOrg = async (e) => {
    e.preventDefault()
    const name = orgName.trim()
    if (!name) {
      toast.error('Enter organization name.')
      return
    }
    setOrgSaving(true)
    try {
      await api.post('/auth/onboarding/organization', { name })
      toast.success('Organization created.')
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Unable to create organization.')
    } finally {
      setOrgSaving(false)
    }
  }

  const cardStyle = {
    ...s.card,
    padding: viewportWidth < 500 ? '24px 16px' : '36px 30px',
  }

  return (
    <div style={s.wrap}>
      <div style={{ width: '100%', maxWidth: 760 }}>
        <CabinetPageHeader
          title="Onboarding"
          subtitle="Let's understand what brought you here."
          helper="Your answers help VITALOOP suggest useful labs, connect results to symptoms, and build safer recommendations."
        />

        <motion.div style={cardStyle} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          {!orgCheckDone && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #10b981', borderTopColor: 'transparent', margin: '0 auto', animation: 'spin 0.7s linear infinite' }} />
              <div style={{ marginTop: 16, color: '#64748b', fontSize: 14 }}>Loading...</div>
            </div>
          )}

          {orgCheckDone && needsOrg && (
            <motion.div key="org-setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>👋</div>
                <div style={s.title}>Welcome</div>
                <div style={s.sub}>Name your organization to continue to CRM.</div>
              </div>
              <form onSubmit={handleCreateOrg}>
                <label>
                  <span style={s.label}>Organization Name</span>
                  <input
                    style={s.input}
                    type="text"
                    placeholder="HealthFirst Clinic"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    autoFocus
                    maxLength={120}
                  />
                </label>
                <button type="submit" style={{ ...s.btnPrimary, marginTop: 16, opacity: orgSaving ? 0.6 : 1 }} disabled={orgSaving}>
                  {orgSaving ? 'Creating...' : 'Create Organization'}
                </button>
              </form>
            </motion.div>
          )}

          {orgCheckDone && !needsOrg && (
            <>
              <div style={s.progress}>
                {steps.map((_, i) => <div key={i} style={s.dot(i === step, i < step)} />)}
              </div>

              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 24, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Step {step + 1} of {TOTAL} - {steps[step]}
              </div>

              {step === 0 && (
                <motion.div key="intent" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div style={s.title}><Sparkles size={22} style={{ display: 'inline', marginRight: 10, color: '#10b981' }} />What brought you to VITALOOP today?</div>
                  <div style={s.sub}>Choose one starting path. You can refine it anytime in Today.</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {INTENT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setIntent(option.id)}
                        style={{
                          textAlign: 'left',
                          padding: '12px 14px',
                          borderRadius: 12,
                          border: `1px solid ${intent === option.id ? '#10b981' : 'rgba(15,23,42,0.15)'}`,
                          background: intent === option.id ? 'rgba(16,185,129,0.08)' : '#f8fafc',
                          color: '#0f172a',
                          cursor: 'pointer',
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="main-context" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div style={s.title}><AlertTriangle size={22} style={{ display: 'inline', marginRight: 10, color: '#f59e0b' }} />Main context</div>

                  {intent === 'symptoms' && (
                    <>
                      <div style={s.sub}>What do you want to understand first?</div>
                      <label>
                        <span style={s.label}>Main Concern</span>
                        <textarea
                          style={s.textarea}
                          placeholder="Examples: low energy, poor sleep, recurring headaches, brain fog"
                          value={concern.summary}
                          onChange={(e) => setConcern((prev) => ({ ...prev, summary: e.target.value }))}
                        />
                      </label>
                    </>
                  )}

                  {intent === 'labs' && (
                    <>
                      <div style={s.sub}>Do you already have lab files to upload now?</div>
                      <div style={{ display: 'grid', gap: 10 }}>
                        <button
                          onClick={() => setHasLabsNow(true)}
                          style={{ ...s.input, cursor: 'pointer', textAlign: 'left', borderColor: hasLabsNow === true ? '#10b981' : 'rgba(15,23,42,0.12)' }}
                        >Yes, I have lab results</button>
                        <button
                          onClick={() => setHasLabsNow(false)}
                          style={{ ...s.input, cursor: 'pointer', textAlign: 'left', borderColor: hasLabsNow === false ? '#10b981' : 'rgba(15,23,42,0.12)' }}
                        >No, I need lab direction first</button>
                      </div>
                      <div style={{ marginTop: 16 }}>
                        <span style={s.label}>What are you trying to improve?</span>
                        <input
                          style={s.input}
                          placeholder="Optional context for interpretation"
                          value={concern.summary}
                          onChange={(e) => setConcern((prev) => ({ ...prev, summary: e.target.value }))}
                        />
                      </div>
                    </>
                  )}

                  {intent === 'baseline' && (
                    <>
                      <div style={s.sub}>Set your first baseline focus area.</div>
                      <label>
                        <span style={s.label}>Baseline Focus</span>
                        <input
                          style={s.input}
                          placeholder="Energy, sleep, recovery, prevention..."
                          value={baselineFocus}
                          onChange={(e) => setBaselineFocus(e.target.value)}
                        />
                      </label>
                    </>
                  )}

                  {intent === 'practitioner' && (
                    <>
                      <div style={s.sub}>Confirm practitioner context to align assignments safely.</div>
                      <button
                        onClick={() => setPractitionerConfirmed((prev) => !prev)}
                        style={{
                          ...s.input,
                          cursor: 'pointer',
                          textAlign: 'left',
                          borderColor: practitionerConfirmed ? '#10b981' : 'rgba(15,23,42,0.12)',
                        }}
                      >
                        {practitionerConfirmed ? 'Confirmed: my practitioner invited me' : 'Click to confirm practitioner invitation'}
                      </button>
                    </>
                  )}
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="followups" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div style={s.title}>Smart follow-ups</div>
                  <div style={s.sub}>These details help prioritize what to check first.</div>

                  <div style={{ display: 'grid', gridTemplateColumns: viewportWidth < 600 ? '1fr' : '1fr 1fr', gap: 14 }}>
                    <div>
                      <span style={s.label}>Duration</span>
                      <select
                        style={s.input}
                        value={concern.duration}
                        onChange={(e) => setConcern((prev) => ({ ...prev, duration: e.target.value }))}
                      >
                        <option value="">Select duration</option>
                        {DURATION_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                    <div>
                      <span style={s.label}>Severity (1-10)</span>
                      <input
                        style={s.input}
                        type="number"
                        min="1"
                        max="10"
                        value={concern.severity}
                        onChange={(e) => setConcern((prev) => ({ ...prev, severity: Number(e.target.value) || 1 }))}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: viewportWidth < 600 ? '1fr' : '1fr 1fr', gap: 14 }}>
                    <div>
                      <span style={s.label}>Body area / system</span>
                      <select
                        style={s.input}
                        value={concern.body_area}
                        onChange={(e) => setConcern((prev) => ({ ...prev, body_area: e.target.value }))}
                      >
                        {BODY_AREAS.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </div>
                    <div>
                      <span style={s.label}>Better/worse triggers</span>
                      <input
                        style={s.input}
                        value={concern.triggers}
                        onChange={(e) => setConcern((prev) => ({ ...prev, triggers: e.target.value }))}
                        placeholder="Sleep loss, stress, meals, exercise..."
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <span style={s.label}>Related symptoms</span>
                    <input
                      style={s.input}
                      value={concern.related_symptoms}
                      onChange={(e) => setConcern((prev) => ({ ...prev, related_symptoms: e.target.value }))}
                      placeholder="Brain fog, palpitations, GI discomfort..."
                    />
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <span style={s.label}>What have you tried so far?</span>
                    <input
                      style={s.input}
                      value={concern.tried}
                      onChange={(e) => setConcern((prev) => ({ ...prev, tried: e.target.value }))}
                      placeholder="Supplements, schedule changes, diet, therapy..."
                    />
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="safety" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div style={s.title}><Shield size={22} style={{ display: 'inline', marginRight: 10, color: '#2563eb' }} />Safety context</div>
                  <div style={s.sub}>This does not diagnose. It helps route you toward safer next steps.</div>

                  <div style={{ marginBottom: 12 }}>
                    <span style={s.label}>Red-flag check (select any that apply)</span>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {redFlagOptions.map((option) => (
                        <button
                          key={option}
                          onClick={() => toggleRedFlag(option)}
                          style={{
                            ...s.input,
                            textAlign: 'left',
                            cursor: 'pointer',
                            borderColor: safety.redFlags.includes(option) ? '#ef4444' : 'rgba(15,23,42,0.12)',
                            background: safety.redFlags.includes(option) ? 'rgba(239,68,68,0.06)' : '#f8fafc',
                          }}
                        >
                          {safety.redFlags.includes(option) ? '✓ ' : ''}{option}
                        </button>
                      ))}
                    </div>
                    {safety.redFlags.length > 0 && (
                      <div style={{ marginTop: 10, fontSize: 13, color: '#b91c1c' }}>
                        Urgent symptoms may require immediate qualified medical review.
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <span style={s.label}>Current medications</span>
                    <input
                      style={s.input}
                      placeholder="Comma-separated"
                      value={safety.medications}
                      onChange={(e) => setSafety((prev) => ({ ...prev, medications: e.target.value }))}
                    />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <span style={s.label}>Current supplements</span>
                    <input
                      style={s.input}
                      placeholder="Comma-separated"
                      value={safety.supplements}
                      onChange={(e) => setSafety((prev) => ({ ...prev, supplements: e.target.value }))}
                    />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <span style={s.label}>Allergies (optional)</span>
                    <input
                      style={s.input}
                      value={safety.allergies}
                      onChange={(e) => setSafety((prev) => ({ ...prev, allergies: e.target.value }))}
                    />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <span style={s.label}>Pregnancy/Breastfeeding (optional)</span>
                    <input
                      style={s.input}
                      value={safety.pregnancy}
                      onChange={(e) => setSafety((prev) => ({ ...prev, pregnancy: e.target.value }))}
                    />
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div style={s.title}><User size={22} style={{ display: 'inline', marginRight: 10, color: '#10b981' }} />Profile basics</div>
                  <div style={s.sub}>Optional now, useful later for deeper personalization.</div>

                  <div style={{ display: 'grid', gridTemplateColumns: viewportWidth < 600 ? '1fr' : '1fr 1fr', gap: 14 }}>
                    <div>
                      <span style={s.label}>First Name</span>
                      <input
                        style={s.input}
                        value={profile.first_name}
                        onChange={(e) => setProfile((prev) => ({ ...prev, first_name: e.target.value }))}
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <span style={s.label}>Last Name</span>
                      <input
                        style={s.input}
                        value={profile.last_name}
                        onChange={(e) => setProfile((prev) => ({ ...prev, last_name: e.target.value }))}
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: viewportWidth < 600 ? '1fr' : '1fr 1fr', gap: 14 }}>
                    <div>
                      <span style={s.label}>Height (cm) - optional</span>
                      <input
                        style={s.input}
                        type="number"
                        min="50"
                        max="250"
                        value={profile.height_cm}
                        onChange={(e) => setProfile((prev) => ({ ...prev, height_cm: e.target.value }))}
                        placeholder="175"
                      />
                    </div>
                    <div>
                      <span style={s.label}>Weight (kg) - optional</span>
                      <input
                        style={s.input}
                        type="number"
                        min="20"
                        max="300"
                        value={profile.weight_kg}
                        onChange={(e) => setProfile((prev) => ({ ...prev, weight_kg: e.target.value }))}
                        placeholder="72"
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <span style={s.label}>Country / Region (optional)</span>
                    <input
                      style={s.input}
                      value={profile.country}
                      onChange={(e) => setProfile((prev) => ({ ...prev, country: e.target.value }))}
                      placeholder="United States"
                    />
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <span style={s.label}>Secondary goals</span>
                    <div style={{ display: 'grid', gridTemplateColumns: viewportWidth < 600 ? '1fr' : '1fr 1fr', gap: 10 }}>
                      {GOAL_OPTIONS.map((goal) => (
                        <button
                          key={goal.id}
                          onClick={() => toggleGoal(goal.id)}
                          style={{
                            ...s.input,
                            cursor: 'pointer',
                            textAlign: 'left',
                            borderColor: profile.goals.includes(goal.id) ? '#10b981' : 'rgba(15,23,42,0.12)',
                            background: profile.goals.includes(goal.id) ? 'rgba(16,185,129,0.08)' : '#f8fafc',
                          }}
                        >
                          {profile.goals.includes(goal.id) ? '✓ ' : ''}{goal.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 5 && (
                <motion.div key="action" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div style={s.title}>Your first action</div>
                  <div style={s.sub}>
                    {intent === 'symptoms' && 'Your concern is saved. Next, continue Symptom Check and finalize lab direction.'}
                    {intent === 'labs' && (hasLabsNow ? 'Great. Continue to Upload Results and connect your symptoms for a precise protocol.' : 'We will guide you through a practical lab direction before upload.')}
                    {intent === 'baseline' && 'Your baseline path is set. Continue to Lab Plan to build your first tracking panel.'}
                    {intent === 'practitioner' && 'Practitioner path confirmed. Continue to assigned intake and upload flow.'}
                  </div>
                  <div style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.06)', fontSize: 14, color: '#1e293b' }}>
                    VITALOOP is a decision-support tool and does not provide diagnosis.
                    Share urgent symptoms with a qualified medical professional.
                  </div>
                </motion.div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 28, alignItems: 'center' }}>
                {step > 0 && (
                  <button style={{ ...s.btnPrimary, flex: 0.4, background: '#e2e8f0', color: '#475569' }} onClick={() => setStep((prev) => prev - 1)}>
                    <ChevronLeft size={18} style={{ display: 'inline' }} /> Back
                  </button>
                )}
                {step < TOTAL - 1 ? (
                  <button style={{ ...s.btnPrimary, flex: 1 }} onClick={goNext}>
                    Next <ChevronRight size={18} style={{ display: 'inline' }} />
                  </button>
                ) : (
                  <button style={{ ...s.btnPrimary, flex: 1, opacity: saving ? 0.6 : 1 }} onClick={saveAll} disabled={saving}>
                    {saving ? 'Saving...' : <><CheckCircle size={18} style={{ display: 'inline', marginRight: 6 }} />Start my health loop</>}
                  </button>
                )}
              </div>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button style={s.btnSec} onClick={handleSkipOnboarding}>Skip setup for now</button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
