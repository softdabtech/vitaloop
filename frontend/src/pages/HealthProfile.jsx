import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { ct } from '../lib/cabinetI18n.js'
import { useAuth } from '../hooks/useAuth.js'
import api from '../lib/api.js'
import { trackFunnelEvent } from '../lib/funnel.js'
import { gaEvent } from '../lib/analytics.js'
import { CoachButton, CoachCard, CoachInput, CoachProgress } from '../components/coach/CoachUI.jsx'
import { isUkrainianLocale } from '../lib/locale.js'
import '../styles/dashboard2026.css'
// coach-shell/coach-card/etc. have no built-in styles of their own — every
// rule lives in this stylesheet. Vite code-splits CSS per lazy route chunk,
// so each page using CoachUI must import it directly or it renders as
// unstyled browser-default HTML, not a build error.
import '../styles/coach-design-system.css'

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'America/Honolulu', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Europe/Helsinki', 'Europe/Moscow', 'Asia/Dubai',
  'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Tokyo', 'Asia/Shanghai',
  'Australia/Sydney', 'Pacific/Auckland',
]

const GOAL_KEYS = [
  'more_energy',
  'better_sleep',
  'hormone_balance',
  'improve_digestion',
  'cardiometabolic_health',
  'reduce_inflammation',
  'sports_performance',
  'healthy_aging',
]

// The backend stores goal text verbatim (no enum) — English canonical labels
// are what's persisted/read back either way, so goal VALUES stay English
// regardless of UI locale (this is stored, comparable data, not display
// copy) while the checkbox LABEL the user sees is localized via GOAL_LABELS.
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

const HEALTH_PROFILE_COPY = {
  en: {
    loadingProfile: 'Loading saved profile details...',
    basics: 'Basics',
    age: 'Age',
    agePlaceholder: 'Enter your age',
    sex: 'Sex',
    selectSex: 'Select sex',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    heightCm: 'Height (cm)',
    weightKg: 'Weight (kg)',
    timezone: 'Timezone',
    goals: 'Goals',
    goalsBody: 'Select goals to personalize your protocol recommendations.',
    goalLabels: {
      more_energy: 'More energy',
      better_sleep: 'Better sleep',
      hormone_balance: 'Hormone balance',
      improve_digestion: 'Improve digestion',
      cardiometabolic_health: 'Cardiometabolic health',
      reduce_inflammation: 'Reduce inflammation',
      sports_performance: 'Sports performance',
      healthy_aging: 'Healthy aging',
    },
    conditionsTitle: 'Conditions & Contraindications',
    conditionsBody: 'This information helps us interpret biomarkers safely and avoid dangerous recommendations.',
    medications: 'Current medications (if any)',
    medicationsPlaceholder: 'e.g., Aspirin 100mg daily, Vitamin D supplementation...',
    allergies: 'Known allergies',
    allergiesPlaceholder: 'e.g., Shellfish, Penicillin, Nuts...',
    pregnancyStatus: 'Pregnancy / Breastfeeding status',
    selectStatus: 'Select status',
    pregnant: 'Currently pregnant',
    breastfeeding: 'Breastfeeding',
    planning: 'Planning to conceive',
    notApplicable: 'Not applicable',
    currentSupplements: 'Current supplements (comma-separated)',
    supplementsPlaceholder: 'e.g., Vitamin D 2000IU, Magnesium 400mg, Omega-3...',
    currentMedications: 'Current prescribed medications (comma-separated)',
    currentMedicationsPlaceholder: 'e.g., Metformin 500mg, Lisinopril 10mg...',
    priorDiagnoses: 'Prior diagnoses / chronic conditions',
    priorDiagnosesPlaceholder: 'e.g., Type 2 diabetes, Hypothyroidism, IBS...',
    privacyNote: 'Your medical information is kept private and only used to provide safe, personalized recommendations.',
    save: 'Save Profile & Safety',
    saving: 'Saving...',
    savedToast: 'Profile & Safety updated!',
    saveFailedToast: 'Failed to save profile',
    profileCompletion: 'Profile Completion',
    bmi: 'BMI',
    ageMetric: 'Age',
    weightMetric: 'Weight',
    heightMetric: 'Height',
    tip: 'TIP',
    tipBody: 'Your profile data is used to personalize supplement recommendations, nutrition guidance, and protocol timing. Keep it updated!',
  },
  uk: {
    loadingProfile: 'Завантажуємо збережений профіль...',
    basics: 'Основне',
    age: 'Вік',
    agePlaceholder: 'Введіть ваш вік',
    sex: 'Стать',
    selectSex: 'Оберіть стать',
    male: 'Чоловіча',
    female: 'Жіноча',
    other: 'Інша',
    heightCm: 'Зріст (см)',
    weightKg: 'Вага (кг)',
    timezone: 'Часовий пояс',
    goals: 'Цілі',
    goalsBody: 'Оберіть цілі, щоб персоналізувати рекомендації протоколу.',
    goalLabels: {
      more_energy: 'Більше енергії',
      better_sleep: 'Кращий сон',
      hormone_balance: 'Гормональний баланс',
      improve_digestion: 'Покращення травлення',
      cardiometabolic_health: 'Кардіометаболічне здоровʼя',
      reduce_inflammation: 'Зменшення запалення',
      sports_performance: 'Спортивні результати',
      healthy_aging: 'Здорове старіння',
    },
    conditionsTitle: 'Стани та протипоказання',
    conditionsBody: 'Ця інформація допомагає безпечно інтерпретувати біомаркери та уникати небезпечних рекомендацій.',
    medications: 'Поточні ліки (якщо є)',
    medicationsPlaceholder: 'напр., Аспірин 100мг щодня, вітамін D...',
    allergies: 'Відомі алергії',
    allergiesPlaceholder: 'напр., Морепродукти, пеніцилін, горіхи...',
    pregnancyStatus: 'Вагітність / грудне вигодовування',
    selectStatus: 'Оберіть статус',
    pregnant: 'Наразі вагітна',
    breastfeeding: 'Годування груддю',
    planning: 'Планую вагітність',
    notApplicable: 'Не застосовується',
    currentSupplements: 'Поточні добавки (через кому)',
    supplementsPlaceholder: 'напр., Вітамін D 2000МО, Магній 400мг, Омега-3...',
    currentMedications: 'Поточні призначені ліки (через кому)',
    currentMedicationsPlaceholder: 'напр., Метформін 500мг, Лізиноприл 10мг...',
    priorDiagnoses: 'Попередні діагнози / хронічні стани',
    priorDiagnosesPlaceholder: 'напр., Діабет 2 типу, Гіпотиреоз, СРК...',
    privacyNote: 'Ваша медична інформація залишається приватною і використовується лише для безпечних персоналізованих рекомендацій.',
    save: 'Зберегти профіль і безпеку',
    saving: 'Зберігаємо...',
    savedToast: 'Профіль і безпеку оновлено!',
    saveFailedToast: 'Не вдалося зберегти профіль',
    profileCompletion: 'Заповненість профілю',
    bmi: 'ІМТ',
    ageMetric: 'Вік',
    weightMetric: 'Вага',
    heightMetric: 'Зріст',
    tip: 'ПОРАДА',
    tipBody: 'Дані профілю персоналізують рекомендації добавок, харчування та терміни протоколу. Тримайте їх актуальними!',
  },
}

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

function MetricTile({ label, value, tone = 'default' }) {
  const toneClass = tone === 'success' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'
  const valueClass = tone === 'success' ? 'text-emerald-900' : 'text-slate-950'
  const labelClass = tone === 'success' ? 'text-emerald-700' : 'text-slate-500'
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className={`text-xs font-bold uppercase tracking-wide ${labelClass}`}>{label}</p>
      <p className={`mt-2 text-2xl font-extrabold ${valueClass}`}>{value}</p>
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
  const isUk = isUkrainianLocale()
  const copy = isUk ? HEALTH_PROFILE_COPY.uk : HEALTH_PROFILE_COPY.en
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
      toast.success(copy.savedToast)
    } catch (error) {
      toast.error(copy.saveFailedToast)
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="coach-shell">
      <CabinetPageHeader
        title={ct().healthProfile.title}
        subtitle={ct().healthProfile.subtitle}
        helper={ct().healthProfile.helper}
      />

      {loading && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {copy.loadingProfile}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          {/* Main grid: Personal Info + Health Goals side by side */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Biometrics Section - Left Column */}
            <CoachCard className="p-6 sm:p-8">
              <h3 className="coach-title-lg mb-6">{copy.basics}</h3>

              <div className="space-y-5">
                <CoachInput label={copy.age}>
                  <input
                    type="number"
                    value={profile.age}
                    onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                    placeholder={copy.agePlaceholder}
                    min="0"
                    max="150"
                  />
                </CoachInput>

                <CoachInput label={copy.sex}>
                  <select
                    value={profile.sex}
                    onChange={(e) => setProfile({ ...profile, sex: e.target.value })}
                  >
                    <option value="">{copy.selectSex}</option>
                    <option value="male">{copy.male}</option>
                    <option value="female">{copy.female}</option>
                    <option value="other">{copy.other}</option>
                  </select>
                </CoachInput>

                <CoachInput label={copy.heightCm}>
                  <input
                    type="number"
                    value={profile.height_cm}
                    onChange={(e) => setProfile({ ...profile, height_cm: e.target.value })}
                    placeholder="e.g., 180"
                    min="0"
                    max="300"
                    step="0.1"
                  />
                </CoachInput>

                <CoachInput label={copy.weightKg}>
                  <input
                    type="number"
                    value={profile.weight_kg}
                    onChange={(e) => setProfile({ ...profile, weight_kg: e.target.value })}
                    placeholder="e.g., 80"
                    min="0"
                    max="500"
                    step="0.1"
                  />
                </CoachInput>

                <CoachInput label={copy.timezone}>
                  <select
                    value={profile.timezone}
                    onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </CoachInput>
              </div>
            </CoachCard>

            {/* Health Goals - Right Column */}
            <CoachCard className="p-6 sm:p-8">
              <h3 className="coach-title-lg mb-2">{copy.goals}</h3>
              <p className="coach-body mb-4">{copy.goalsBody}</p>

              <div className="space-y-3">
                {GOAL_OPTIONS.map((goal, index) => {
                  const goalKey = GOAL_KEYS[index]
                  const isChecked = profile.goals.includes(goal)
                  return (
                    <label
                      key={goal}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border p-3 transition ${
                        isChecked ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setProfile({ ...profile, goals: [...profile.goals, goal] })
                          } else {
                            setProfile({ ...profile, goals: profile.goals.filter((g) => g !== goal) })
                          }
                        }}
                        className="h-[18px] w-[18px] cursor-pointer"
                      />
                      <span className="text-sm font-medium text-slate-900">{copy.goalLabels[goalKey]}</span>
                    </label>
                  )
                })}
              </div>
            </CoachCard>
          </div>

          {/* Medical Flags - Important Context */}
          <CoachCard tone="attention" className="p-6 sm:p-8">
            <h3 className="mb-2 text-lg font-extrabold text-rose-900">⚠️ {copy.conditionsTitle}</h3>
            <p className="mb-5 text-sm text-rose-700">{copy.conditionsBody}</p>

            <div className="space-y-5">
              <CoachInput label={copy.medications}>
                <textarea
                  value={profile.medications}
                  onChange={(e) => setProfile({ ...profile, medications: e.target.value })}
                  placeholder={copy.medicationsPlaceholder}
                  rows={3}
                />
              </CoachInput>

              <CoachInput label={copy.allergies}>
                <textarea
                  value={profile.allergies}
                  onChange={(e) => setProfile({ ...profile, allergies: e.target.value })}
                  placeholder={copy.allergiesPlaceholder}
                  rows={3}
                />
              </CoachInput>

              <CoachInput label={copy.pregnancyStatus}>
                <select
                  value={profile.pregnancy_status}
                  onChange={(e) => setProfile({ ...profile, pregnancy_status: e.target.value })}
                >
                  <option value="">{copy.selectStatus}</option>
                  <option value="pregnant">{copy.pregnant}</option>
                  <option value="breastfeeding">{copy.breastfeeding}</option>
                  <option value="planning">{copy.planning}</option>
                  <option value="none">{copy.notApplicable}</option>
                </select>
              </CoachInput>

              <CoachInput label={copy.currentSupplements}>
                <textarea
                  value={profile.current_supplements}
                  onChange={(e) => setProfile({ ...profile, current_supplements: e.target.value })}
                  placeholder={copy.supplementsPlaceholder}
                  rows={3}
                />
              </CoachInput>

              <CoachInput label={copy.currentMedications}>
                <textarea
                  value={profile.current_medications}
                  onChange={(e) => setProfile({ ...profile, current_medications: e.target.value })}
                  placeholder={copy.currentMedicationsPlaceholder}
                  rows={3}
                />
              </CoachInput>

              <CoachInput label={copy.priorDiagnoses}>
                <textarea
                  value={profile.prior_diagnoses}
                  onChange={(e) => setProfile({ ...profile, prior_diagnoses: e.target.value })}
                  placeholder={copy.priorDiagnosesPlaceholder}
                  rows={3}
                />
              </CoachInput>
            </div>

            <p className="mt-4 text-xs text-rose-700">
              ✓ {copy.privacyNote}
            </p>
          </CoachCard>

          <CoachButton onClick={saveProfile} disabled={saving}>
            {saving ? copy.saving : copy.save}
          </CoachButton>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Completion */}
          <CoachCard className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.profileCompletion}</p>
            <CoachProgress value={profileCompletion} />
            <p className="mt-2 text-center text-xl font-extrabold text-slate-950">{profileCompletion}%</p>
          </CoachCard>

          {/* Biometrics Display */}
          {bmi && (
            <MetricTile
              label={copy.bmi}
              value={bmi}
              tone={bmi < 25 ? 'success' : 'default'}
            />
          )}

          {profile.age && (
            <MetricTile
              label={copy.ageMetric}
              value={profile.age}
            />
          )}

          {profile.weight_kg && (
            <MetricTile
              label={copy.weightMetric}
              value={`${profile.weight_kg} kg`}
            />
          )}

          {profile.height_cm && (
            <MetricTile
              label={copy.heightMetric}
              value={`${profile.height_cm} cm`}
            />
          )}

          {/* Info Box */}
          <CoachCard tone="soft" className="p-4">
            <p className="mb-1.5 text-xs font-bold text-emerald-700">💡 {copy.tip}</p>
            <p className="text-[13px] leading-relaxed text-emerald-900">{copy.tipBody}</p>
          </CoachCard>
        </div>
      </div>
    </div>
  )
}
