import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Target, User, Activity, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
import { useAuth } from '../hooks/useAuth.js'
import api from '../lib/api.js'
import { trackFunnelEvent } from '../lib/funnel.js'
import { gaEvent } from '../lib/analytics.js'
import '../styles/dashboard2026.css'

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'America/Honolulu', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Europe/Helsinki', 'Europe/Moscow', 'Asia/Dubai',
  'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Tokyo', 'Asia/Shanghai',
  'Australia/Sydney', 'Pacific/Auckland',
]

const GOAL_OPTIONS = [
  'More energy',
  'Better sleep',
  'Hormone balance',
  'Improve digestion',
  'Cardiometabolic health',
  'Reduce inflammation',
  'Sports performance',
  'Healthy aging',
]

const DEFAULT_PROFILE = {
  age: '',
  sex: '',
  height_cm: '',
  weight_kg: '',
  goals: [],
  timezone: 'America/New_York',
  medications: '',
  allergies: '',
  pregnancy_status: '',
  current_supplements: '',
  current_medications: '',
  prior_diagnoses: '',
}

const fieldStyle = {
  width: '100%',
  minHeight: 44,
  padding: '10px 14px',
  background: '#f8fafc',
  border: '1px solid rgba(15,23,42,0.12)',
  borderRadius: 14,
  color: '#0f172a',
  fontSize: 16,
  outline: 'none',
  transition: 'border-color 200ms, box-shadow 200ms',
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6, lineHeight: 1.3 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function normalizeSexValue(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'm' || normalized === 'male') return 'male'
  if (normalized === 'f' || normalized === 'female') return 'female'
  if (normalized === 'o' || normalized === 'other') return 'other'
  return ''
}

function parseCommaSeparatedList(value) {
  return value
    ? value.split(',').map((item) => item.trim()).filter(Boolean)
    : []
}

function mapProfileFromApi(data) {
  return {
    age: data.age || '',
    sex: normalizeSexValue(data.sex),
    height_cm: data.height_cm || '',
    weight_kg: data.weight_kg || '',
    goals: Array.isArray(data.goals) ? data.goals : [],
    timezone: data.timezone || 'America/New_York',
    medications: data.medications || '',
    allergies: data.allergies || '',
    pregnancy_status: data.pregnancy_status || '',
    current_supplements: Array.isArray(data.current_supplements) ? data.current_supplements.join(', ') : (data.current_supplements || ''),
    current_medications: Array.isArray(data.current_medications) ? data.current_medications.join(', ') : (data.current_medications || ''),
    prior_diagnoses: data.prior_diagnoses || '',
  }
}

function mapProfileFromUserMeta(meta) {
  return {
    age: meta.age || '',
    sex: normalizeSexValue(meta.sex),
    height_cm: meta.height_cm || '',
    weight_kg: meta.weight_kg || '',
    goals: meta.goals || [],
    timezone: meta.timezone || 'America/New_York',
    medications: meta.medications || '',
    allergies: meta.allergies || '',
    pregnancy_status: meta.pregnancy_status || '',
    current_supplements: '',
    current_medications: '',
    prior_diagnoses: '',
  }
}

function buildProfileUpdatePayload(profile) {
  const supplementsList = parseCommaSeparatedList(profile.current_supplements)
  const medicationsList = parseCommaSeparatedList(profile.current_medications)

  return {
    age: profile.age ? parseInt(profile.age, 10) : null,
    sex: profile.sex,
    height_cm: profile.height_cm ? parseFloat(profile.height_cm) : null,
    weight_kg: profile.weight_kg ? parseFloat(profile.weight_kg) : null,
    goals: profile.goals,
    timezone: profile.timezone,
    medications: profile.medications || null,
    allergies: profile.allergies || null,
    pregnancy_status: profile.pregnancy_status || null,
    current_supplements: supplementsList.length ? supplementsList : null,
    current_medications: medicationsList.length ? medicationsList : null,
    prior_diagnoses: profile.prior_diagnoses || null,
  }
}

export default function HealthProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const profileCompletion = useMemo(() => {
    const checks = [
      Boolean(profile.age),
      Boolean(profile.sex),
      Boolean(profile.timezone),
      Boolean(profile.height_cm),
      Boolean(profile.weight_kg),
      Array.isArray(profile.goals) && profile.goals.length > 0,
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [profile])

  // Calculate BMI
  const bmi = useMemo(() => {
    if (!profile.height_cm || !profile.weight_kg) return null
    const heightM = profile.height_cm / 100
    return (profile.weight_kg / (heightM * heightM)).toFixed(1)
  }, [profile.height_cm, profile.weight_kg])

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      try {
        const response = await api.get('/profile', { timeout: 8000 })
        const data = response.data?.profile || {}
        setProfile(mapProfileFromApi(data))
      } catch (error) {
        const meta = user?.user_metadata || {}
        setProfile(mapProfileFromUserMeta(meta))
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      loadProfile()
    }
  }, [user])

  async function saveProfile() {
    setSaving(true)
    try {
      const payload = buildProfileUpdatePayload(profile)
      const response = await api.patch('/profile', payload)
      const data = response.data?.profile || {}
      setProfile(mapProfileFromApi(data))
      const changedFieldCount = Object.entries(payload).filter(([, value]) => value !== null && value !== undefined).length
      trackFunnelEvent(
        'funnel_profile_updated',
        'User updated health profile',
        {
          fields_changed: changedFieldCount,
        },
      )
      gaEvent('profile_updated', {
        fields_changed: changedFieldCount,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['timeline'] }),
        queryClient.invalidateQueries({ queryKey: ['insights'] }),
        queryClient.invalidateQueries({ queryKey: ['health-score'] }),
      ])
      toast.success('Profile & Safety updated!')
    } catch (error) {
      toast.error('Failed to save profile')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <CabinetPageHeader
        title={ct().healthProfile.title}
        subtitle={ct().healthProfile.subtitle}
        helper={ct().healthProfile.helper}
      />

      {loading && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Loading saved profile details...
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Activity className="h-3.5 w-3.5 text-emerald-600" /> Profile completion</div>
          <p className="text-2xl font-bold text-slate-900">{profileCompletion}%</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${profileCompletion}%` }} /></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> BMI</div>
          <p className="text-2xl font-bold text-slate-900">{bmi || '—'}</p>
          <p className="mt-1 text-xs text-slate-500">Calculated from height and weight.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Target className="h-3.5 w-3.5 text-emerald-600" /> Active goals</div>
          <p className="text-2xl font-bold text-slate-900">{Array.isArray(profile.goals) ? profile.goals.length : 0}</p>
          <p className="mt-1 text-xs text-slate-500">Used to personalize recommendations.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900"><User className="h-4 w-4 text-emerald-600" /> Basics</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Age">
            <input type="number" value={profile.age} onChange={(e) => setProfile({ ...profile, age: e.target.value })} placeholder="Enter age" style={fieldStyle} min="0" max="150" />
          </Field>
          <Field label="Sex">
            <select value={profile.sex} onChange={(e) => setProfile({ ...profile, sex: e.target.value })} style={fieldStyle}>
              <option value="">Select sex</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Timezone">
            <select value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} style={fieldStyle}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="Height (cm)">
            <input type="number" value={profile.height_cm} onChange={(e) => setProfile({ ...profile, height_cm: e.target.value })} placeholder="e.g., 180" style={fieldStyle} min="0" max="300" step="0.1" />
          </Field>
          <Field label="Weight (kg)">
            <input type="number" value={profile.weight_kg} onChange={(e) => setProfile({ ...profile, weight_kg: e.target.value })} placeholder="e.g., 80" style={fieldStyle} min="0" max="500" step="0.1" />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Goals</h3>
        <div className="flex flex-wrap gap-2">
          {GOAL_OPTIONS.map((goal) => {
            const selected = profile.goals.includes(goal)
            return (
              <button
                key={goal}
                type="button"
                onClick={() => {
                  if (selected) {
                    setProfile({ ...profile, goals: profile.goals.filter((g) => g !== goal) })
                  } else {
                    setProfile({ ...profile, goals: [...profile.goals, goal] })
                  }
                }}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${selected ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50'}`}
              >
                {goal}
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 sm:p-6">
        <h3 className="mb-1 text-base font-semibold text-rose-900">Safety context</h3>
        <p className="mb-4 text-sm text-rose-700">Used to avoid unsafe suggestions and make recommendations more accurate.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current medications (if any)">
            <textarea value={profile.medications} onChange={(e) => setProfile({ ...profile, medications: e.target.value })} rows={3} placeholder="e.g., Aspirin 100mg daily" style={{ ...fieldStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>
          <Field label="Known allergies">
            <textarea value={profile.allergies} onChange={(e) => setProfile({ ...profile, allergies: e.target.value })} rows={3} placeholder="e.g., Penicillin" style={{ ...fieldStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>
          <Field label="Pregnancy / breastfeeding status">
            <select value={profile.pregnancy_status} onChange={(e) => setProfile({ ...profile, pregnancy_status: e.target.value })} style={fieldStyle}>
              <option value="">Select status</option>
              <option value="pregnant">Currently pregnant</option>
              <option value="breastfeeding">Breastfeeding</option>
              <option value="planning">Planning to conceive</option>
              <option value="none">Not applicable</option>
            </select>
          </Field>
          <Field label="Current supplements (comma-separated)">
            <textarea value={profile.current_supplements} onChange={(e) => setProfile({ ...profile, current_supplements: e.target.value })} rows={3} placeholder="e.g., Vitamin D, Magnesium" style={{ ...fieldStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>
          <Field label="Current prescribed medications (comma-separated)">
            <textarea value={profile.current_medications} onChange={(e) => setProfile({ ...profile, current_medications: e.target.value })} rows={3} placeholder="e.g., Metformin, Lisinopril" style={{ ...fieldStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>
          <Field label="Prior diagnoses / chronic conditions">
            <textarea value={profile.prior_diagnoses} onChange={(e) => setProfile({ ...profile, prior_diagnoses: e.target.value })} rows={3} placeholder="e.g., Hypothyroidism" style={{ ...fieldStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>
        </div>
      </section>

      <button
        onClick={saveProfile}
        disabled={saving}
        className="w-full rounded-2xl bg-emerald-600 px-6 py-3 text-center font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
      >
        {saving ? 'Saving...' : 'Save Health Profile'}
      </button>
    </div>
  )
}
