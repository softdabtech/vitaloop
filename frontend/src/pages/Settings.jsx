import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock3, Link2, LogOut, ShieldCheck, Target, User } from 'lucide-react'
import toast from 'react-hot-toast'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import { useAuth } from '../hooks/useAuth.js'
import api from '../lib/api.js'
import { supabase } from '../lib/supabase.js'
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
  fontSize: 15,
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
    warm: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.18)', title: '#b45309', value: '#92400e' },
  }
  const theme = themes[tone] || themes.default

  return (
    <div style={{ borderRadius: 18, padding: '16px 18px', background: theme.bg, border: `1px solid ${theme.border}` }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.title, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: theme.value }}>{value}</div>
    </div>
  )
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [account, setAccount] = useState({ full_name: '', age: '', sex: '', timezone: 'America/New_York' })
  const [medical, setMedical] = useState({ height_cm: '', weight_kg: '', goals: [] })
  const [extras, setExtras] = useState({
    telegram: '',
    instagram: '',
    linkedin: '',
    language: 'en',
    weekly_digest: true,
    checkin_reminders: true,
    product_updates: false,
  })
  const [saving, setSaving] = useState(false)

  const meta = user?.user_metadata || {}
  const app = user?.app_metadata || {}
  const isSuperAdmin = meta.is_super_admin || app.is_super_admin

  const initials = (account.full_name || user?.email || 'U')
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const profileCompletion = useMemo(() => {
    const checks = [
      Boolean(account.full_name),
      Boolean(account.timezone),
      Boolean(medical.height_cm),
      Boolean(medical.weight_kg),
      Array.isArray(medical.goals) && medical.goals.length > 0,
    ]

    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [account.full_name, account.timezone, medical.height_cm, medical.weight_kg, medical.goals])

  const activeChannels = [extras.telegram, extras.instagram, extras.linkedin].filter(Boolean).length
  const enabledReminders = [extras.weekly_digest, extras.checkin_reminders, extras.product_updates].filter(Boolean).length

  useEffect(() => {
    if (!user) return

    Promise.allSettled([
      supabase.from('users').select('full_name,age,sex,timezone').eq('id', user.id).single(),
      api.get('/profile'),
    ]).then(([accountResult, profileResult]) => {
      if (accountResult.status === 'fulfilled' && accountResult.value?.data) {
        const data = accountResult.value.data
        setAccount({
          full_name: data.full_name || '',
          age: data.age ?? '',
          sex: data.sex || '',
          timezone: data.timezone || 'America/New_York',
        })
      }

      if (profileResult.status === 'fulfilled') {
        const profile = profileResult.value?.data?.profile || {}
        setMedical({
          height_cm: profile.height_cm || '',
          weight_kg: profile.weight_kg || '',
          goals: Array.isArray(profile.goals) ? profile.goals : [],
        })
      }

      setExtras((prev) => ({
        ...prev,
        telegram: meta.telegram || '',
        instagram: meta.instagram || '',
        linkedin: meta.linkedin || '',
        language: meta.language || 'en',
        weekly_digest: meta.weekly_digest !== false,
        checkin_reminders: meta.checkin_reminders !== false,
        product_updates: Boolean(meta.product_updates),
      }))
    })
  }, [meta, user])

  function focusStyle(event) {
    event.target.style.borderColor = 'rgba(29,158,117,0.72)'
    event.target.style.boxShadow = '0 0 0 3px rgba(29,158,117,0.16)'
  }

  function blurStyle(event) {
    event.target.style.borderColor = 'rgba(15,23,42,0.12)'
    event.target.style.boxShadow = 'none'
  }

  function toggleGoal(goal) {
    setMedical((prev) => {
      const goals = Array.isArray(prev.goals) ? prev.goals : []
      return goals.includes(goal)
        ? { ...prev, goals: goals.filter((item) => item !== goal) }
        : { ...prev, goals: [...goals, goal] }
    })
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)

    const [accountSave, medicalSave, metadataSave] = await Promise.all([
      supabase.from('users').update({
        full_name: account.full_name.trim() || null,
        age: account.age ? Number(account.age) : null,
        sex: account.sex || null,
        timezone: account.timezone,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id),
      api.patch('/profile', {
        height_cm: medical.height_cm ? Number(medical.height_cm) : null,
        weight_kg: medical.weight_kg ? Number(medical.weight_kg) : null,
        goals: medical.goals,
      }).catch((error) => ({ error })),
      supabase.auth.updateUser({
        data: {
          ...meta,
          avatar_url: null,
          telegram: extras.telegram || null,
          instagram: extras.instagram || null,
          linkedin: extras.linkedin || null,
          language: extras.language,
          weekly_digest: extras.weekly_digest,
          checkin_reminders: extras.checkin_reminders,
          product_updates: extras.product_updates,
        },
      }),
    ])

    setSaving(false)
    const failed = accountSave.error || medicalSave.error || metadataSave.error
    if (failed) {
      toast.error('Save failed — please try again.')
      return
    }

    toast.success('Profile updated')
  }

  async function handleSignOut() {
    await signOut()
    window.location.assign('/login')
  }

  return (
    <div className="vtl-page" style={{ minHeight: '100svh' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <CabinetPageHeader
          title="Settings"
          subtitle="Profile, reminders, goals, and identity in one place."
          helper="Compact account controls for daily use."
          className="mb-4"
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="vtl-light-card p-5 sm:p-6" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,1), rgba(240,253,247,0.92))' }}>
              <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: 84,
                      height: 84,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      background: 'linear-gradient(135deg, var(--vtl-accent), #059669)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      fontWeight: 700,
                      color: '#052e16',
                      boxShadow: '0 12px 30px rgba(29,158,117,0.18)',
                    }}>
                      {initials}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: '#0f172a' }}>{account.full_name || 'Your Profile'}</div>
                    <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>{user?.email}</div>
                    <div style={{ marginTop: 10, display: 'inline-flex', borderRadius: 999, background: 'rgba(29,158,117,0.1)', color: '#047857', padding: '7px 12px', fontSize: 12, fontWeight: 700 }}>
                      Profile completion {profileCompletion}%
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:self-start">
                  <MetricTile label="Profile" value={`${profileCompletion}%`} tone={profileCompletion >= 70 ? 'success' : 'warm'} />
                  <MetricTile label="Channels" value={String(activeChannels)} />
                  <MetricTile label="Reminders on" value={`${enabledReminders}/3`} />
                </div>
              </div>
            </div>

            <div className="vtl-light-card p-5 sm:p-6">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                <User size={18} style={{ color: '#1d9e75' }} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Identity and baseline</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Core data that shapes reminders, assignments, and interpretation quality.</div>
                </div>
              </div>

              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field label="Full Name">
                  <input value={account.full_name} onChange={(event) => setAccount({ ...account, full_name: event.target.value })} placeholder="Your name" style={fieldStyle} onFocus={focusStyle} onBlur={blurStyle} />
                </Field>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Age">
                    <input type="number" min="1" max="120" value={account.age} onChange={(event) => setAccount({ ...account, age: event.target.value })} placeholder="—" style={fieldStyle} onFocus={focusStyle} onBlur={blurStyle} />
                  </Field>
                  <Field label="Biological Sex">
                    <select value={account.sex} onChange={(event) => setAccount({ ...account, sex: event.target.value })} style={{ ...fieldStyle, cursor: 'pointer' }} onFocus={focusStyle} onBlur={blurStyle}>
                      <option value="">Prefer not to say</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Height (cm)">
                    <input value={medical.height_cm} onChange={(event) => setMedical((prev) => ({ ...prev, height_cm: event.target.value }))} placeholder="175" style={fieldStyle} onFocus={focusStyle} onBlur={blurStyle} />
                  </Field>
                  <Field label="Weight (kg)">
                    <input value={medical.weight_kg} onChange={(event) => setMedical((prev) => ({ ...prev, weight_kg: event.target.value }))} placeholder="72" style={fieldStyle} onFocus={focusStyle} onBlur={blurStyle} />
                  </Field>
                </div>

                <Field label="Timezone">
                  <select value={account.timezone} onChange={(event) => setAccount({ ...account, timezone: event.target.value })} style={{ ...fieldStyle, cursor: 'pointer' }} onFocus={focusStyle} onBlur={blurStyle}>
                    {TIMEZONES.map((timezone) => <option key={timezone} value={timezone}>{timezone.replace('_', ' ')}</option>)}
                  </select>
                </Field>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 10 }}>Primary goals</div>
                  <div className="flex flex-wrap gap-2">
                    {GOAL_OPTIONS.map((goal) => {
                      const active = medical.goals.includes(goal)
                      return (
                        <button
                          key={goal}
                          type="button"
                          onClick={() => toggleGoal(goal)}
                          className="vtl-focus-ring"
                          style={{
                            borderRadius: 999,
                            border: `1px solid ${active ? 'rgba(29,158,117,0.28)' : 'rgba(15,23,42,0.08)'}`,
                            background: active ? 'rgba(29,158,117,0.1)' : '#f8fafc',
                            color: active ? '#047857' : '#334155',
                            padding: '10px 14px',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {goal}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>Goals improve recommendations and insights.</div>
                </div>

                <button type="submit" disabled={saving} className="vtl-button-primary vtl-focus-ring" style={{ width: '100%', fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.65 : 1 }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </form>
            </div>
          </div>

          <div className="xl:sticky xl:top-[96px] xl:self-start" style={{ display: 'grid', gap: 16 }}>
            <div className="vtl-light-card p-5 sm:p-6">
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link2 size={16} style={{ color: '#1d9e75' }} /> Connected presence
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <Field label="Telegram">
                  <input value={extras.telegram} onChange={(event) => setExtras((prev) => ({ ...prev, telegram: event.target.value }))} placeholder="@username" style={fieldStyle} onFocus={focusStyle} onBlur={blurStyle} />
                </Field>
                <Field label="Instagram">
                  <input value={extras.instagram} onChange={(event) => setExtras((prev) => ({ ...prev, instagram: event.target.value }))} placeholder="instagram.com/yourname" style={fieldStyle} onFocus={focusStyle} onBlur={blurStyle} />
                </Field>
                <Field label="LinkedIn">
                  <input value={extras.linkedin} onChange={(event) => setExtras((prev) => ({ ...prev, linkedin: event.target.value }))} placeholder="linkedin.com/in/yourname" style={fieldStyle} onFocus={focusStyle} onBlur={blurStyle} />
                </Field>
              </div>
            </div>

            <div className="vtl-light-card p-5 sm:p-6">
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock3 size={16} style={{ color: '#1d9e75' }} /> Reminders
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  { key: 'weekly_digest', label: 'Weekly digest' },
                  { key: 'checkin_reminders', label: 'Check-in email' },
                  { key: 'product_updates', label: 'Product updates' },
                ].map((item) => (
                  <label key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <span style={{ fontSize: 13, color: '#334155', fontWeight: 600, lineHeight: 1.35 }}>{item.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(extras[item.key])}
                      onChange={(event) => setExtras((prev) => ({ ...prev, [item.key]: event.target.checked }))}
                      style={{ width: 16, height: 16, flexShrink: 0 }}
                    />
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 14 }}>
                <Field label="Preferred language">
                  <select value={extras.language} onChange={(event) => setExtras((prev) => ({ ...prev, language: event.target.value }))} style={{ ...fieldStyle, cursor: 'pointer' }} onFocus={focusStyle} onBlur={blurStyle}>
                    <option value="en">English</option>
                    <option value="uk">Ukrainian</option>
                    <option value="ru">Russian</option>
                  </select>
                </Field>
              </div>
            </div>

            <div className="vtl-light-card p-5 sm:p-6">
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={16} style={{ color: '#1d9e75' }} /> Completion checklist
              </div>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.45, marginBottom: 12 }}>
                Complete these for better analysis quality.
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { label: 'Name + timezone', done: Boolean(account.full_name && account.timezone) },
                  { label: 'Height + weight', done: Boolean(medical.height_cm && medical.weight_kg) },
                  { label: 'One health goal', done: medical.goals.length > 0 },
                  { label: 'One contact channel', done: Boolean(extras.telegram || extras.instagram || extras.linkedin) },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)', padding: '11px 12px', gap: 12 }}>
                    <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.35 }}>{item.label}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: item.done ? '#059669' : '#94a3b8' }}>
                      {item.done && <CheckCircle2 size={14} />}
                      {item.done ? 'Done' : 'Missing'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="vtl-light-card p-5 sm:p-6" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Account actions</div>
              {isSuperAdmin && (
                <button
                  onClick={() => navigate('/ops')}
                  className="vtl-focus-ring"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'rgba(234,179,8,0.08)',
                    border: '1px solid rgba(234,179,8,0.3)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    color: '#f59e0b',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  <ShieldCheck size={16} /> Ops Console
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="vtl-focus-ring"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(239,68,68,0.07)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 12,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  color: '#ef4444',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
