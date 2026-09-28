import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Ruler, Scale, ShieldCheck, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'

import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import api from '../lib/api.js'
import { gaOnboardingComplete } from '../lib/analytics.js'
import { trackFunnelEvent } from '../lib/funnel.js'
import { isUkrainianLocale } from '../lib/locale.js'
import '../styles/dashboard2026.css'

const COPY = {
  en: {
    eyebrow: 'Required profile',
    title: 'First, tell us the basics',
    subtitle: 'These four values are required before VITALOOP can safely personalize lab ranges and symptom questions.',
    privacy: 'Used for clinical context only. We do not infer missing values.',
    age: 'Age', ageHint: 'Adults 18–120',
    sex: 'Sex for lab reference ranges', sexHint: 'Required by laboratory ranges and the symptom engine.',
    select: 'Select an option', female: 'Female', male: 'Male',
    height: 'Height', heightHint: '100–250 cm',
    weight: 'Weight', weightHint: '30–350 kg',
    submit: 'Save and enter dashboard', saving: 'Saving…',
    optionalNext: 'Symptom Check is optional. You can start it later from the dashboard or go directly to Upload Results.',
    invalidAge: 'Enter an age from 18 to 120.',
    invalidSex: 'Select the sex used for laboratory reference ranges.',
    invalidHeight: 'Enter a height from 100 to 250 cm.',
    invalidWeight: 'Enter a weight from 30 to 350 kg.',
    saveError: 'Could not save your profile. Please try again.',
    orgTitle: 'Organization setup',
    orgSubtitle: 'Create your organization to continue to the professional workspace.',
    orgName: 'Organization name', orgPlaceholder: 'e.g. Vitaloop Health Clinic', orgSubmit: 'Create organization',
  },
  uk: {
    eyebrow: 'Обов’язковий профіль',
    title: 'Спочатку вкажіть основні дані',
    subtitle: 'Ці чотири значення потрібні, щоб VITALOOP безпечно персоналізував лабораторні межі та питання про симптоми.',
    privacy: 'Використовуються лише для медичного контексту. Ми не визначаємо відсутні значення самостійно.',
    age: 'Вік', ageHint: 'Дорослі 18–120 років',
    sex: 'Стать для лабораторних референсів', sexHint: 'Потрібна для лабораторних меж і механізму оцінки симптомів.',
    select: 'Оберіть варіант', female: 'Жіноча', male: 'Чоловіча',
    height: 'Зріст', heightHint: '100–250 см',
    weight: 'Вага', weightHint: '30–350 кг',
    submit: 'Зберегти та перейти до кабінету', saving: 'Збереження…',
    optionalNext: 'Перевірка симптомів необов’язкова. Її можна пройти пізніше з дашборда або одразу перейти до завантаження аналізів.',
    invalidAge: 'Вкажіть вік від 18 до 120 років.',
    invalidSex: 'Оберіть стать, що використовується для лабораторних референсів.',
    invalidHeight: 'Вкажіть зріст від 100 до 250 см.',
    invalidWeight: 'Вкажіть вагу від 30 до 350 кг.',
    saveError: 'Не вдалося зберегти профіль. Спробуйте ще раз.',
    orgTitle: 'Налаштування організації',
    orgSubtitle: 'Створіть організацію, щоб перейти до професійного кабінету.',
    orgName: 'Назва організації', orgPlaceholder: 'наприклад, Vitaloop Health Clinic', orgSubmit: 'Створити організацію',
  },
}

const EMPTY_FORM = { age: '', sex: '', height_cm: '', weight_kg: '' }

function numberInRange(value, minimum, maximum) {
  const number = Number(value)
  return value !== '' && Number.isFinite(number) && number >= minimum && number <= maximum
}

function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-slate-800">{label}</span>
      {children}
      <span className={`mt-1.5 block text-xs ${error ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>
        {error || hint}
      </span>
    </label>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const copy = isUkrainianLocale() ? COPY.uk : COPY.en
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [organizationRequired, setOrganizationRequired] = useState(false)
  const [organizationName, setOrganizationName] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [authResponse, profileResponse] = await Promise.all([api.get('/auth/me'), api.get('/profile')])
        if (!active) return

        const authData = authResponse.data || {}
        const role = String(authData?.user?.global_role || authData?.global_role || 'end_user').toLowerCase()
        const memberships = authData?.memberships
        const requiresOrganization = ['org_admin', 'super_admin'].includes(role)
          && (!Array.isArray(memberships) || memberships.length === 0)

        if (requiresOrganization) {
          setOrganizationRequired(true)
          return
        }
        if (role !== 'end_user') {
          navigate(role === 'practitioner' ? '/crm/clients' : '/dashboard', { replace: true })
          return
        }

        const profile = profileResponse.data?.profile || {}
        setForm({
          age: profile.age ?? '',
          sex: ['male', 'female'].includes(String(profile.sex || '').toLowerCase()) ? String(profile.sex).toLowerCase() : '',
          height_cm: profile.height_cm ?? '',
          weight_kg: profile.weight_kg ?? '',
        })
      } catch {
        if (active) toast.error(copy.saveError)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [copy.saveError, navigate])

  const inputClass = useMemo(
    () => 'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100',
    [],
  )

  const validate = () => {
    const nextErrors = {}
    if (!numberInRange(form.age, 18, 120) || !Number.isInteger(Number(form.age))) nextErrors.age = copy.invalidAge
    if (!['male', 'female'].includes(form.sex)) nextErrors.sex = copy.invalidSex
    if (!numberInRange(form.height_cm, 100, 250)) nextErrors.height_cm = copy.invalidHeight
    if (!numberInRange(form.weight_kg, 30, 350)) nextErrors.weight_kg = copy.invalidWeight
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const saveRequiredProfile = async (event) => {
    event.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      await api.patch('/profile', {
        age: Number(form.age), sex: form.sex,
        height_cm: Number(form.height_cm), weight_kg: Number(form.weight_kg),
      })
      await api.post('/auth/onboarding/complete')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
      ])
      gaOnboardingComplete()
      trackFunnelEvent('funnel_required_profile_completed', 'User completed required profile', {
        symptom_check_required: false,
      }, { oncePerSession: true })
      toast.success(isUkrainianLocale() ? 'Профіль збережено' : 'Profile saved')
      // This is a one-time safety boundary. Reload so the route guard reads the
      // just-persisted server state instead of reusing its pre-submit state.
      window.location.replace('/dashboard')
    } catch (error) {
      const detail = error?.response?.data?.detail
      toast.error(typeof detail?.detail === 'string' ? detail.detail : copy.saveError)
    } finally {
      setSaving(false)
    }
  }

  const createOrganization = async (event) => {
    event.preventDefault()
    const name = organizationName.trim()
    if (!name) return
    setSaving(true)
    try {
      await api.post('/auth/onboarding/organization', { name })
      navigate('/admin/dashboard', { replace: true })
    } catch (error) {
      toast.error(error?.response?.data?.detail || copy.saveError)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="mx-auto mt-20 h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" aria-label="Loading" />
  }

  if (organizationRequired) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <CabinetPageHeader eyebrow="SETUP" title={copy.orgTitle} subtitle={copy.orgSubtitle} />
        <form onSubmit={createOrganization} className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <Field label={copy.orgName} hint="">
            <input className={inputClass} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder={copy.orgPlaceholder} required />
          </Field>
          <button type="submit" disabled={saving} className="mt-6 min-h-12 w-full rounded-xl bg-emerald-600 px-5 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60">
            {saving ? copy.saving : copy.orgSubmit}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <CabinetPageHeader eyebrow={copy.eyebrow.toUpperCase()} title={copy.title} subtitle={copy.subtitle} />

      <form onSubmit={saveRequiredProfile} className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-emerald-100 bg-emerald-50/70 px-5 py-4 sm:px-8">
          <p className="flex items-start gap-2 text-sm leading-6 text-emerald-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            {copy.privacy}
          </p>
        </div>

        <div className="grid gap-6 px-5 py-6 sm:grid-cols-2 sm:px-8 sm:py-8">
          <Field label={copy.age} hint={copy.ageHint} error={errors.age}>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" aria-hidden="true" />
              <input className={`${inputClass} pl-11`} type="number" min="18" max="120" step="1" inputMode="numeric" value={form.age} onChange={(event) => updateField('age', event.target.value)} aria-invalid={Boolean(errors.age)} required />
            </div>
          </Field>

          <Field label={copy.sex} hint={copy.sexHint} error={errors.sex}>
            <select className={inputClass} value={form.sex} onChange={(event) => updateField('sex', event.target.value)} aria-invalid={Boolean(errors.sex)} required>
              <option value="">{copy.select}</option>
              <option value="female">{copy.female}</option>
              <option value="male">{copy.male}</option>
            </select>
          </Field>

          <Field label={`${copy.height} (cm)`} hint={copy.heightHint} error={errors.height_cm}>
            <div className="relative">
              <Ruler className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" aria-hidden="true" />
              <input className={`${inputClass} pl-11`} type="number" min="100" max="250" step="0.1" inputMode="decimal" value={form.height_cm} onChange={(event) => updateField('height_cm', event.target.value)} aria-invalid={Boolean(errors.height_cm)} required />
            </div>
          </Field>

          <Field label={`${copy.weight} (kg)`} hint={copy.weightHint} error={errors.weight_kg}>
            <div className="relative">
              <Scale className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" aria-hidden="true" />
              <input className={`${inputClass} pl-11`} type="number" min="30" max="350" step="0.1" inputMode="decimal" value={form.weight_kg} onChange={(event) => updateField('weight_kg', event.target.value)} aria-invalid={Boolean(errors.weight_kg)} required />
            </div>
          </Field>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-5 sm:px-8">
          <button type="submit" disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            {saving ? copy.saving : copy.submit}
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-slate-500">{copy.optionalNext}</p>
        </div>
      </form>
    </div>
  )
}
