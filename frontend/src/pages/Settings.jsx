import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, LogOut, AlertTriangle, Cookie, UserCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import CabinetPageHeader from '../components/dashboard/CabinetPageHeader.jsx'
import NotificationPreferences from '../components/NotificationPreferences.jsx'
import AvatarUpload from '../components/AvatarUpload.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useSubscription } from '../hooks/useSubscription.js'
import { supabase } from '../lib/supabase.js'
import api from '../lib/api.js'
import { isUkrainianLocale } from '../lib/locale.js'
import { ct } from '../lib/cabinetI18n.js'
import '../styles/dashboard2026.css'

const COOKIE_STORAGE_KEY = 'vitaloop-cookie-consent'
function resetCookieConsent() {
  try { localStorage.removeItem(COOKIE_STORAGE_KEY) } catch {}
  window.location.reload()
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
    <div className="space-y-6">
      <CabinetPageHeader
        title={ct().settings.title}
        subtitle={ct().settings.subtitle}
      />

      <div className="grid gap-6 lg:grid-cols-2">

        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }} className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
              <UserCircle2 size={18} color="#0d9488" />
            </span>
            <div>
              <div className="text-sm font-bold text-slate-900">{isUkrainianLocale() ? 'Фото профілю' : 'Profile photo'}</div>
              <div className="text-xs text-slate-500">{isUkrainianLocale() ? 'Відображається у кабінеті та сайдбарі' : 'Shown in cabinet and sidebar'}</div>
            </div>
          </div>
          <AvatarUpload
            user={user}
            isUk={isUkrainianLocale()}
            onUpdate={useCallback(() => {
              supabase.auth.getUser().then(({ data }) => {
                if (data?.user) toast.success(isUkrainianLocale() ? 'Аватар оновлено' : 'Avatar updated')
              })
            }, [])}
          />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-6"
        >
          <div className="mb-5 flex items-center gap-3">
            <Mail size={18} className="text-emerald-600" />
            <div>
              <div className="text-base font-semibold text-slate-900">Email address</div>
              <div className="text-xs text-slate-500">Your account login email</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900">
            {user?.email || 'No email'}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Contact support@vitaloop.today to change your email address.
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl border border-slate-200 bg-white p-6"
        >
          <div className="mb-5 flex items-center gap-3">
            <Lock size={18} className="text-emerald-600" />
            <div>
              <div className="text-base font-semibold text-slate-900">Password</div>
              <div className="text-xs text-slate-500">Change your account password</div>
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
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2"
        >
          <NotificationPreferences
            currentPreferences={notifications}
            onSave={(prefs) => {
              setNotifications(prefs)
              toast.success('Notification preferences updated!')
            }}
          />
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
              <Cookie size={18} color="#0d9488" />
            </span>
            <div>
              <div className="text-sm font-bold text-slate-900">Cookie Preferences</div>
              <div className="text-xs text-slate-500">Manage what data we may collect</div>
            </div>
          </div>
          <p className="mb-4 text-sm text-slate-600">
            Review or update your consent for analytics, marketing and functional cookies. Essential cookies required for login and security cannot be disabled.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={resetCookieConsent} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Update Cookie Settings
            </button>
            <a href="/privacy-policy/#cookies" target="_blank" rel="noreferrer" className="rounded-full px-4 py-2 text-sm font-semibold text-emerald-700 underline underline-offset-4">
              Cookie Policy ↗
            </a>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="rounded-2xl border border-rose-200 bg-rose-50 p-6 lg:col-span-2"
        >
          <div className="mb-4 flex items-center gap-3">
            <AlertTriangle size={18} className="text-rose-700" />
            <div>
              <div className="text-base font-semibold text-rose-900">Danger zone</div>
              <div className="text-xs text-rose-700">Irreversible actions</div>
            </div>
          </div>

          <div className="grid gap-3">
            <div>
              <button
                onClick={async () => {
                  await signOut()
                  safeNavigateToLogin()
                }}
                className="w-full rounded-2xl border border-rose-300 bg-white px-6 py-3 text-center font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                <span className="inline-flex items-center gap-2"><LogOut className="h-4 w-4" /> Sign Out from All Devices</span>
              </button>
              <p className="mt-2 text-xs text-rose-700">
                Sign out of VITALOOP on all your devices. You'll need to log in again.
              </p>
            </div>

            {isPremium && (
              <div className="border-t border-rose-300/50 pt-3">
                {!showCancelConfirm ? (
                  <>
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="w-full rounded-2xl border border-red-400 bg-white px-6 py-3 text-center font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Cancel Subscription
                    </button>
                    <p className="mt-2 text-xs text-rose-700">
                      Cancel your premium subscription. You'll revert to the free plan.
                    </p>
                  </>
                ) : (
                  <div className="rounded-xl border-l-4 border-red-600 bg-red-100/70 px-3 py-3">
                    <p className="mb-2 text-sm font-medium text-red-900">
                      ⚠️ Are you sure? You'll lose access to premium features and revert to the free plan.
                    </p>
                    <div className="flex gap-2">
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

            <div className="border-t border-rose-300/50 pt-3">
              {!showDeleteConfirm ? (
                <>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full rounded-2xl border border-red-500 bg-white px-6 py-3 text-center font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    Delete Account Permanently
                  </button>
                  <p className="mt-2 text-xs text-rose-700">
                    Permanently delete your account and all associated data. This cannot be undone.
                  </p>
                </>
              ) : (
                <div className="rounded-xl border-l-4 border-rose-800 bg-red-100/80 px-3 py-3">
                  <p className="mb-2 text-sm font-bold text-rose-900">
                    🚨 WARNING: This will permanently delete your account and all data. This action cannot be reversed!
                  </p>
                  <div className="flex gap-2">
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
        </motion.section>
      </div>
    </div>
  )
}
