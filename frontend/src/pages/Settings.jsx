import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Clock3, Globe2, Link2, LogOut, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { supabase } from '../lib/supabase.js'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import api from '../lib/api.js'
import toast from 'react-hot-toast'
import '../styles/dashboard2026.css'

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'America/Honolulu', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Europe/Helsinki', 'Europe/Moscow', 'Asia/Dubai',
  'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Tokyo', 'Asia/Shanghai',
  'Australia/Sydney', 'Pacific/Auckland',
]

const fieldStyle = {
  width: '100%',
  padding: '10px 14px',
  background: '#f8fafc',
  border: '1px solid rgba(15,23,42,0.12)',
  borderRadius: 12,
  color: '#0f172a',
  fontSize: 15,
  outline: 'none',
  transition: 'border-color 200ms, box-shadow 200ms',
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [account, setAccount] = useState({ full_name: '', age: '', sex: '', timezone: 'America/New_York' })
  const [medical, setMedical] = useState({ height_cm: '', weight_kg: '', goals: [] })
  const [extras, setExtras] = useState({
    avatar_url: '',
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
  const avatarUrl = extras.avatar_url || ''
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
      Boolean(avatarUrl),
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [account.full_name, account.timezone, medical.height_cm, medical.weight_kg, medical.goals, avatarUrl])

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
        avatar_url: meta.avatar_url || '',
        telegram: meta.telegram || '',
        instagram: meta.instagram || '',
        linkedin: meta.linkedin || '',
        language: meta.language || 'en',
        weekly_digest: meta.weekly_digest !== false,
        checkin_reminders: meta.checkin_reminders !== false,
        product_updates: Boolean(meta.product_updates),
      }))
    })
  }, [user])

  function focusStyle(event) {
    event.target.style.borderColor = '#10b981'
    event.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.15)'
  }

  function blurStyle(event) {
    event.target.style.borderColor = 'rgba(15,23,42,0.12)'
    event.target.style.boxShadow = 'none'
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
          avatar_url: extras.avatar_url || null,
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

  function handleAvatarUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 160
        canvas.width = size
        canvas.height = size
        const context = canvas.getContext('2d')
        if (!context) {
          toast.error('Could not process image.')
          return
        }
        context.drawImage(image, 0, 0, size, size)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78)
        setExtras((prev) => ({ ...prev, avatar_url: dataUrl }))
        toast.success('Photo added. Save changes to keep it.')
      }
      image.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  }

  async function handleSignOut() {
    await signOut()
    window.location.assign('/login')
  }

  return (
    <div className="vtl-page" style={{ minHeight: '100svh' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <CabinetPageHeader
          title="Settings"
          subtitle="Manage profile, account preferences, connected identities, and profile completeness."
          helper="This area now acts as your account center: photo, social links, reminder toggles, and baseline health context."
        />

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="vtl-light-card" style={{ padding: '28px 28px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, var(--vtl-accent), #059669)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#052e16',
                }}>
                  {avatarUrl ? <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                </div>
                <label style={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: '50%', background: '#ffffff', border: '1px solid rgba(15,23,42,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Camera size={14} style={{ color: '#10b981' }} />
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                </label>
              </div>

              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{account.full_name || 'Your Profile'}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{user?.email}</div>
                <div style={{ marginTop: 8, display: 'inline-flex', borderRadius: 999, background: 'rgba(16,185,129,0.1)', color: '#047857', padding: '6px 10px', fontSize: 12, fontWeight: 700 }}>
                  Profile completion {profileCompletion}%
                </div>
              </div>

              <User size={18} style={{ marginLeft: 'auto', color: '#94a3b8', opacity: 0.7 }} />
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Full Name">
                <input value={account.full_name} onChange={(event) => setAccount({ ...account, full_name: event.target.value })} placeholder="Your name" style={fieldStyle} onFocus={focusStyle} onBlur={blurStyle} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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

              <button type="submit" disabled={saving} className="vtl-button-primary vtl-focus-ring" style={{ width: '100%', fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.65 : 1 }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <div className="vtl-light-card" style={{ padding: '24px 28px' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link2 size={16} style={{ color: '#10b981' }} /> Connected presence
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

            <div className="vtl-light-card" style={{ padding: '24px 28px' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock3 size={16} style={{ color: '#10b981' }} /> Reminder preferences
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  { key: 'weekly_digest', label: 'Weekly dashboard digest' },
                  { key: 'checkin_reminders', label: 'Check-in reminder email' },
                  { key: 'product_updates', label: 'Product and feature updates' },
                ].map((item) => (
                  <label key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 14, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <span style={{ fontSize: 14, color: '#334155', fontWeight: 500 }}>{item.label}</span>
                    <input type="checkbox" checked={Boolean(extras[item.key])} onChange={(event) => setExtras((prev) => ({ ...prev, [item.key]: event.target.checked }))} />
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

            <div className="vtl-light-card" style={{ padding: '24px 28px' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Globe2 size={16} style={{ color: '#10b981' }} /> Complete your health profile
              </div>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 14 }}>
                After registration, the product should keep nudging the user to finish this data because it directly improves assignments, insights, protocol quality, and reminders.
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  { label: 'Name and timezone', done: Boolean(account.full_name && account.timezone) },
                  { label: 'Height and weight', done: Boolean(medical.height_cm && medical.weight_kg) },
                  { label: 'Profile photo', done: Boolean(avatarUrl) },
                  { label: 'At least one communication channel', done: Boolean(extras.telegram || extras.instagram || extras.linkedin) },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)', padding: '10px 12px' }}>
                    <span style={{ fontSize: 14, color: '#334155' }}>{item.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: item.done ? '#059669' : '#94a3b8' }}>{item.done ? 'Done' : 'Missing'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="vtl-light-card" style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {isSuperAdmin && (
                <button
                  onClick={() => navigate('/ops')}
                  className="vtl-focus-ring"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)',
                    borderRadius: 12, padding: '12px 16px', cursor: 'pointer',
                    color: '#f59e0b', fontSize: 14, fontWeight: 600,
                  }}
                >
                  <ShieldCheck size={16} /> Ops Console
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="vtl-focus-ring"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 12, padding: '12px 16px', cursor: 'pointer',
                  color: '#ef4444', fontSize: 14, fontWeight: 600,
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
