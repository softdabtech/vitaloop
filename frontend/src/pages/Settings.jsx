import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { supabase } from '../lib/supabase.js'
import { ArrowLeft, User, LogOut, ShieldCheck } from 'lucide-react'
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
  width: '100%', padding: '10px 14px',
  background: 'rgba(15,23,42,0.6)',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 12, color: 'var(--vtl-text-primary-dark)',
  fontSize: 15, outline: 'none',
  transition: 'border-color 200ms, box-shadow 200ms',
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--vtl-text-secondary-dark)', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState({ full_name: '', age: '', sex: '', timezone: 'America/New_York' })
  const [saving, setSaving] = useState(false)

  const meta = user?.user_metadata || {}
  const app = user?.app_metadata || {}
  const isSuperAdmin = meta.is_super_admin || app.is_super_admin
  const initials = (profile.full_name || user?.email || 'U')
    .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  useEffect(() => {
    if (!user) return
    supabase.from('users').select('full_name,age,sex,timezone').eq('id', user.id).single().then(({ data }) => {
      if (data) setProfile({
        full_name: data.full_name || '',
        age: data.age ?? '',
        sex: data.sex || '',
        timezone: data.timezone || 'America/New_York',
      })
    })
  }, [user])

  const focusStyle = (e) => {
    e.target.style.borderColor = 'var(--vtl-accent)'
    e.target.style.boxShadow = 'var(--vtl-emerald-glow)'
  }
  const blurStyle = (e) => {
    e.target.style.borderColor = 'rgba(148,163,184,0.2)'
    e.target.style.boxShadow = 'none'
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('users').update({
      full_name: profile.full_name.trim() || null,
      age: profile.age ? Number(profile.age) : null,
      sex: profile.sex || null,
      timezone: profile.timezone,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)
    setSaving(false)
    if (error) toast.error('Save failed — please try again.')
    else toast.success('Profile updated')
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="vtl-shell" style={{ minHeight: '100svh', padding: '24px 16px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>

        {/* Back nav */}
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--vtl-text-secondary-dark)', fontSize: 14, marginBottom: 28,
            padding: 0,
          }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        {/* Avatar + name header */}
        <div className="vtl-card" style={{ padding: '28px 28px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--vtl-accent), #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, color: '#052e16', flexShrink: 0,
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--vtl-text-primary-dark)' }}>
                {profile.full_name || 'Your Profile'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--vtl-text-secondary-dark)', marginTop: 2 }}>
                {user?.email}
              </div>
            </div>
            <User size={18} style={{ marginLeft: 'auto', color: 'var(--vtl-text-secondary-dark)', opacity: 0.5 }} />
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Full Name">
              <input
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Your name"
                style={fieldStyle}
                onFocus={focusStyle} onBlur={blurStyle}
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Age">
                <input
                  type="number" min="1" max="120"
                  value={profile.age}
                  onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                  placeholder="—"
                  style={fieldStyle}
                  onFocus={focusStyle} onBlur={blurStyle}
                />
              </Field>
              <Field label="Biological Sex">
                <select
                  value={profile.sex}
                  onChange={(e) => setProfile({ ...profile, sex: e.target.value })}
                  style={{ ...fieldStyle, cursor: 'pointer' }}
                  onFocus={focusStyle} onBlur={blurStyle}
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
            </div>

            <Field label="Timezone">
              <select
                value={profile.timezone}
                onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                style={{ ...fieldStyle, cursor: 'pointer' }}
                onFocus={focusStyle} onBlur={blurStyle}
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
              </select>
            </Field>

            <button
              type="submit"
              disabled={saving}
              className="vtl-button-primary vtl-focus-ring"
              style={{ width: '100%', fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.65 : 1 }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Danger / navigation zone */}
        <div className="vtl-card" style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isSuperAdmin && (
            <button
              onClick={() => navigate('/ops')}
              className="vtl-focus-ring"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)',
                borderRadius: 12, padding: '12px 16px', cursor: 'pointer',
                color: '#fbbf24', fontSize: 14, fontWeight: 600,
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
              color: '#f87171', fontSize: 14, fontWeight: 600,
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>

      </div>
    </div>
  )
}
