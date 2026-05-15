import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Target, User, Activity, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
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

function MetricTile({ label, value, tone = 'default' }) {
  const themes = {
    default: { bg: '#f8fafc', border: 'rgba(15,23,42,0.08)', title: '#64748b', value: '#0f172a' },
    success: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.18)', title: '#047857', value: '#065f46' },
  }
  const theme = themes[tone] || themes.default

  return (
    <div style={{ borderRadius: 18, padding: '16px 18px', background: theme.bg, border: `1px solid ${theme.border}` }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.title, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: theme.value }}>{value}</div>
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
  const [profile, setProfile] = useState({
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
  })
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
        const response = await api.get('/profile')
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
      toast.success('Health profile updated!')
    } catch (error) {
      toast.error('Failed to save profile')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <CabinetPageHeader
        title="Health Profile"
        subtitle="Your personal health information and biometric data"
        helper="Keep this information up to date so recommendations are tailored to you."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          {/* Main grid: Personal Info + Health Goals side by side */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Biometrics Section - Left Column */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <h3 className="mb-6 text-lg font-bold text-slate-900">Personal Information</h3>

              <div className="space-y-5">
                <Field label="Age">
                  <input
                    type="number"
                    value={profile.age}
                    onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                    placeholder="Enter your age"
                    style={fieldStyle}
                    min="0"
                    max="150"
                  />
                </Field>

                <Field label="Sex">
                  <select
                    value={profile.sex}
                    onChange={(e) => setProfile({ ...profile, sex: e.target.value })}
                    style={fieldStyle}
                  >
                    <option value="">Select sex</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </Field>

                <Field label="Height (cm)">
                  <input
                    type="number"
                    value={profile.height_cm}
                    onChange={(e) => setProfile({ ...profile, height_cm: e.target.value })}
                    placeholder="e.g., 180"
                    style={fieldStyle}
                    min="0"
                    max="300"
                    step="0.1"
                  />
                </Field>

                <Field label="Weight (kg)">
                  <input
                    type="number"
                    value={profile.weight_kg}
                    onChange={(e) => setProfile({ ...profile, weight_kg: e.target.value })}
                    placeholder="e.g., 80"
                    style={fieldStyle}
                    min="0"
                    max="500"
                    step="0.1"
                  />
                </Field>

                <Field label="Timezone">
                  <select
                    value={profile.timezone}
                    onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                    style={fieldStyle}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            {/* Health Goals - Right Column */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <h3 className="mb-6 text-lg font-bold text-slate-900">Health Goals</h3>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
                Select goals to personalize your protocol recommendations.
              </p>

              <div className="space-y-3">
                {GOAL_OPTIONS.map((goal) => (
                  <label key={goal} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    background: profile.goals.includes(goal) ? '#f0fdf4' : '#f8fafc',
                    border: `1px solid ${profile.goals.includes(goal) ? '#dcfce7' : 'rgba(15,23,42,0.12)'}`,
                    borderRadius: 14,
                    cursor: 'pointer',
                    transition: 'all 200ms',
                  }}>
                    <input
                      type="checkbox"
                      checked={profile.goals.includes(goal)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setProfile({ ...profile, goals: [...profile.goals, goal] })
                        } else {
                          setProfile({ ...profile, goals: profile.goals.filter((g) => g !== goal) })
                        }
                      }}
                      style={{ cursor: 'pointer', width: 18, height: 18 }}
                    />
                    <span style={{ color: '#0f172a', fontSize: 14, fontWeight: 500 }}>{goal}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Medical Flags - Important Context */}
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 sm:p-8">
            <h3 className="mb-6 text-lg font-bold text-rose-900">⚠️ Important Medical Information</h3>
            <p style={{ fontSize: 14, color: '#b91c1c', marginBottom: 20 }}>
              This information helps us interpret biomarkers safely and avoid dangerous recommendations.
            </p>

            <div className="space-y-5">
              <Field label="Current medications (if any)">
                <textarea
                  value={profile.medications}
                  onChange={(e) => setProfile({ ...profile, medications: e.target.value })}
                  placeholder="e.g., Aspirin 100mg daily, Vitamin D supplementation..."
                  style={{
                    ...fieldStyle,
                    minHeight: 80,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </Field>

              <Field label="Known allergies">
                <textarea
                  value={profile.allergies}
                  onChange={(e) => setProfile({ ...profile, allergies: e.target.value })}
                  placeholder="e.g., Shellfish, Penicillin, Nuts..."
                  style={{
                    ...fieldStyle,
                    minHeight: 80,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </Field>

              <Field label="Pregnancy / Breastfeeding status">
                <select
                  value={profile.pregnancy_status}
                  onChange={(e) => setProfile({ ...profile, pregnancy_status: e.target.value })}
                  style={fieldStyle}
                >
                  <option value="">Select status</option>
                  <option value="pregnant">Currently pregnant</option>
                  <option value="breastfeeding">Breastfeeding</option>
                  <option value="planning">Planning to conceive</option>
                  <option value="none">Not applicable</option>
                </select>
              </Field>

              <Field label="Current supplements (comma-separated)">
                <textarea
                  value={profile.current_supplements}
                  onChange={(e) => setProfile({ ...profile, current_supplements: e.target.value })}
                  placeholder="e.g., Vitamin D 2000IU, Magnesium 400mg, Omega-3..."
                  style={{
                    ...fieldStyle,
                    minHeight: 80,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </Field>

              <Field label="Current prescribed medications (comma-separated)">
                <textarea
                  value={profile.current_medications}
                  onChange={(e) => setProfile({ ...profile, current_medications: e.target.value })}
                  placeholder="e.g., Metformin 500mg, Lisinopril 10mg..."
                  style={{
                    ...fieldStyle,
                    minHeight: 80,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </Field>

              <Field label="Prior diagnoses / chronic conditions">
                <textarea
                  value={profile.prior_diagnoses}
                  onChange={(e) => setProfile({ ...profile, prior_diagnoses: e.target.value })}
                  placeholder="e.g., Type 2 diabetes, Hypothyroidism, IBS..."
                  style={{
                    ...fieldStyle,
                    minHeight: 80,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </Field>
            </div>

            <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 16 }}>
              ✓ Your medical information is kept private and only used to provide safe, personalized recommendations.
            </p>
          </div>

          {/* Save Button */}
          <button
            onClick={saveProfile}
            disabled={saving}
            className="rounded-2xl bg-emerald-600 px-6 py-3 text-center font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Health Profile'}
          </button>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Completion */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Profile Completion</div>
            <div style={{
              width: '100%',
              height: 6,
              background: '#e2e8f0',
              borderRadius: 99,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${profileCompletion}%`,
                background: '#10b981',
                transition: 'width 300ms',
              }} />
            </div>
            <div className="mt-2 text-center text-xl font-bold text-slate-900">{profileCompletion}%</div>
          </div>

          {/* Biometrics Display */}
          {bmi && (
            <MetricTile
              label="BMI"
              value={bmi}
              tone={bmi < 25 ? 'success' : 'default'}
            />
          )}

          {profile.age && (
            <MetricTile
              label="Age"
              value={profile.age}
            />
          )}

          {profile.weight_kg && (
            <MetricTile
              label="Weight"
              value={`${profile.weight_kg} kg`}
            />
          )}

          {profile.height_cm && (
            <MetricTile
              label="Height"
              value={`${profile.height_cm} cm`}
            />
          )}

          {/* Info Box */}
          <div style={{
            borderRadius: 18,
            padding: 16,
            background: '#f0fdf4',
            border: '1px solid rgba(16,185,129,0.18)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#047857', marginBottom: 6 }}>💡 TIP</div>
            <div style={{ fontSize: 13, color: '#065f46', lineHeight: 1.5 }}>
              Your profile data is used to personalize supplement recommendations, nutrition guidance, and protocol timing. Keep it updated!
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
