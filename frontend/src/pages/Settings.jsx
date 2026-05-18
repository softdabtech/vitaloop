import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Bell, Lock, LogOut, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import NotificationPreferences from '../components/NotificationPreferences.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useSubscription } from '../hooks/useSubscription.js'
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
  fontSize: 16,
  outline: 'none',
  transition: 'border-color 200ms, box-shadow 200ms',
}

function safeNavigateToLogin() {
  if (typeof window !== 'undefined') {
    window.location.assign('/login')
  }
}

function safeReloadPage() {
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
}

function validatePasswordInput(newPassword, confirmPassword) {
  if (!newPassword.trim()) return 'Password cannot be empty'
  if (newPassword !== confirmPassword) return 'Passwords do not match'
  if (newPassword.length < 8) return 'Password must be at least 8 characters'
  return ''
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
  const { isPremium } = useSubscription()
  const [notifications, setNotifications] = useState({
    weekly_checkin: user?.user_metadata?.weekly_checkin !== false,
    assignment_due: user?.user_metadata?.assignment_due !== false,
    retest_reminder: user?.user_metadata?.retest_reminder !== false,
    streak_reminder: user?.user_metadata?.streak_reminder !== false,
    insight_published: user?.user_metadata?.insight_published !== false,
    weekly_digest: user?.user_metadata?.weekly_digest !== false,
    achievement_unlock: user?.user_metadata?.achievement_unlock !== false,
    biomarker_alert: user?.user_metadata?.biomarker_alert !== false,
    push_enabled: user?.user_metadata?.push_enabled !== false,
  })
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [canceling, setCanceling] = useState(false)

  function focusStyle(event) {
    event.target.style.borderColor = 'rgba(29,158,117,0.72)'
    event.target.style.boxShadow = '0 0 0 3px rgba(29,158,117,0.16)'
  }

  function blurStyle(event) {
    event.target.style.borderColor = 'rgba(15,23,42,0.12)'
    event.target.style.boxShadow = 'none'
  }


  async function updatePassword() {
    const validationError = validatePasswordInput(newPassword, confirmPassword)
    if (validationError) {
      toast.error(validationError)
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

  async function deleteAccount() {
    setDeleting(true)
    try {
      await api.delete('/auth')
      toast.success('Account deleted. Signing out...')
      setTimeout(() => {
        safeNavigateToLogin()
      }, 1000)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete account')
      console.error(error)
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  async function cancelSubscription() {
    setCanceling(true)
    try {
      await api.post('/stripe/cancel')
      toast.success('Subscription cancelled successfully')
      setShowCancelConfirm(false)
      setTimeout(() => {
        safeReloadPage()
      }, 1000)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel subscription')
      console.error(error)
    } finally {
      setCanceling(false)
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
        >
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
        </motion.div>

        {/* Password */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
        >
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
        </motion.div>

        {/* Notifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
        >
          <NotificationPreferences
            currentPreferences={notifications}
            onSave={(prefs) => {
              setNotifications(prefs)
              toast.success('Notification preferences updated!')
            }}
          />
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-2xl border border-rose-200 bg-rose-50 p-6 sm:p-8"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <AlertTriangle size={18} style={{ color: '#dc2626' }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#991b1b' }}>Danger Zone</div>
              <div style={{ fontSize: 13, color: '#7f1d1d', marginTop: 2 }}>Irreversible actions</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <button
                onClick={async () => {
                  await signOut()
                  safeNavigateToLogin()
                }}
                className="w-full rounded-2xl border border-rose-300 bg-white px-6 py-3 text-center font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                Sign Out from All Devices
              </button>
              <p style={{ fontSize: 12, color: '#7f1d1d', marginTop: 8 }}>
                Sign out of VITALOOP on all your devices. You'll need to log in again.
              </p>
            </div>

            {isPremium && (
              <div style={{ borderTop: '1px solid rgba(220, 38, 38, 0.2)', paddingTop: 12 }}>
                {!showCancelConfirm ? (
                  <>
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="w-full rounded-2xl border border-red-400 bg-white px-6 py-3 text-center font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Cancel Subscription
                    </button>
                    <p style={{ fontSize: 12, color: '#7f1d1d', marginTop: 8 }}>
                      Cancel your premium subscription. You'll revert to the free plan.
                    </p>
                  </>
                ) : (
                  <div style={{ padding: '12px 14px', background: 'rgba(220, 38, 38, 0.1)', borderRadius: 12, borderLeft: '4px solid #dc2626' }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#991b1b', marginBottom: 10 }}>
                      ⚠️ Are you sure? You'll lose access to premium features and revert to the free plan.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={cancelSubscription}
                        disabled={canceling}
                        className="flex-1 rounded-lg bg-red-600 text-white px-4 py-2 font-semibold hover:bg-red-700 transition disabled:opacity-60"
                      >
                        {canceling ? 'Canceling...' : 'Yes, Cancel'}
                      </button>
                      <button
                        onClick={() => setShowCancelConfirm(false)}
                        disabled={canceling}
                        className="flex-1 rounded-lg border border-rose-300 bg-white text-rose-600 px-4 py-2 font-semibold hover:bg-rose-50 transition disabled:opacity-60"
                      >
                        Keep It
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ borderTop: '1px solid rgba(220, 38, 38, 0.2)', paddingTop: 12 }}>
              {!showDeleteConfirm ? (
                <>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full rounded-2xl border border-red-500 bg-white px-6 py-3 text-center font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    Delete Account Permanently
                  </button>
                  <p style={{ fontSize: 12, color: '#7f1d1d', marginTop: 8 }}>
                    Permanently delete your account and all associated data. This cannot be undone.
                  </p>
                </>
              ) : (
                <div style={{ padding: '12px 14px', background: 'rgba(220, 38, 38, 0.1)', borderRadius: 12, borderLeft: '4px solid #991b1b' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 10 }}>
                    🚨 WARNING: This will permanently delete your account and all data. This action cannot be reversed!
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={deleteAccount}
                      disabled={deleting}
                      className="flex-1 rounded-lg bg-red-700 text-white px-4 py-2 font-semibold hover:bg-red-800 transition disabled:opacity-60"
                    >
                      {deleting ? 'Deleting...' : 'Yes, Delete Everything'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="flex-1 rounded-lg border border-rose-400 bg-white text-rose-700 px-4 py-2 font-semibold hover:bg-rose-50 transition disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </>
  )
}
