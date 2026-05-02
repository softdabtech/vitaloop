import { useState } from 'react'
import { Mail, Bell, Lock, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import NotificationPreferences from '../components/NotificationPreferences.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { supabase } from '../lib/supabase.js'
import api from '../lib/api.js'
import '../styles/dashboard2026.css'

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

export default function Settings() {
  const { user, signOut } = useAuth()
  const [notifications, setNotifications] = useState({
    weekly_checkin: user?.user_metadata?.weekly_checkin !== false,
    assignment_due: user?.user_metadata?.assignment_due !== false,
    streak_reminder: user?.user_metadata?.streak_reminder !== false,
    weekly_digest: user?.user_metadata?.weekly_digest !== false,
    achievement_unlock: user?.user_metadata?.achievement_unlock !== false,
    biomarker_alert: user?.user_metadata?.biomarker_alert !== false,
  })
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  function focusStyle(event) {
    event.target.style.borderColor = 'rgba(29,158,117,0.72)'
    event.target.style.boxShadow = '0 0 0 3px rgba(29,158,117,0.16)'
  }

  function blurStyle(event) {
    event.target.style.borderColor = 'rgba(15,23,42,0.12)'
    event.target.style.boxShadow = 'none'
  }


  async function updatePassword() {
    if (!newPassword.trim()) {
      toast.error('Password cannot be empty')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      toast.success('Password updated successfully!')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      toast.error(error.message || 'Failed to update password')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <CabinetPageHeader
        title="Account Settings"
        subtitle="Manage your account, password, and notification preferences"
        helper="These settings are technical and personal to your account."
      />

      <div className="grid gap-6 max-w-2xl">
        {/* Account Info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <Mail size={18} style={{ color: '#1d9e75' }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Email Address</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Your account login email</div>
            </div>
          </div>

          <div style={{
            padding: '12px 14px',
            background: '#f8fafc',
            border: '1px solid rgba(15,23,42,0.12)',
            borderRadius: 14,
            color: '#0f172a',
            fontSize: 15,
          }}>
            {user?.email || 'No email'}
          </div>

          <p style={{ fontSize: 12, color: '#64748b', marginTop: 10 }}>
            Contact support@vitaloop.today to change your email address.
          </p>
        </div>

        {/* Password */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <Lock size={18} style={{ color: '#1d9e75' }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Password</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Change your account password</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <Field label="New Password">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                style={fieldStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            <Field label="Confirm Password">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                style={fieldStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </Field>

            <button
              onClick={updatePassword}
              disabled={saving || !newPassword}
              className="rounded-2xl bg-emerald-600 px-6 py-3 text-center font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <NotificationPreferences
            currentPreferences={notifications}
            onSave={(prefs) => {
              setNotifications(prefs)
              toast.success('Notification preferences updated!')
            }}
          />
        </div>

        {/* Danger Zone */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 sm:p-8">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <LogOut size={18} style={{ color: '#dc2626' }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#991b1b' }}>Danger Zone</div>
              <div style={{ fontSize: 13, color: '#7f1d1d', marginTop: 2 }}>Irreversible actions</div>
            </div>
          </div>

          <button
            onClick={async () => {
              await signOut()
              window.location.assign('/login')
            }}
            className="w-full rounded-2xl border border-rose-300 bg-white px-6 py-3 text-center font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            Sign Out from All Devices
          </button>

          <p style={{ fontSize: 12, color: '#7f1d1d', marginTop: 12 }}>
            This will sign you out of VITALOOP on all your devices and browsers. You'll need to log in again.
          </p>
        </div>
      </div>
    </>
  )
}
