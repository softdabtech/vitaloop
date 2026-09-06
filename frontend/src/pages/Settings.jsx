import { useState, useCallback } from 'react'
import { Mail, Lock, LogOut, AlertTriangle, Cookie, UserCircle2, CreditCard, Download } from 'lucide-react'
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
import { CoachButton, CoachCard, CoachInput } from '../components/coach/CoachUI.jsx'
import '../styles/dashboard2026.css'
// coach-shell/coach-card/etc. have no built-in styles of their own — every
// rule lives in this stylesheet. Vite code-splits CSS per lazy route chunk,
// so each page using CoachUI must import it directly or it renders as
// unstyled browser-default HTML, not a build error.
import '../styles/coach-design-system.css'

const COOKIE_STORAGE_KEY = 'vitaloop-cookie-consent'
function resetCookieConsent() {
  try {
    localStorage.removeItem(COOKIE_STORAGE_KEY)
  } catch {
    // Continue to reload so the user can retry consent setup even if storage is blocked.
  }
  window.location.reload()
}

function safeNavigateToLogin() {
  if (typeof window !== 'undefined') {
    window.location.assign('/login')
  }
}

function validatePasswordInput(newPassword, confirmPassword, isUk = false) {
  if (!newPassword.trim()) return isUk ? 'Пароль не може бути порожнім' : 'Password cannot be empty'
  if (newPassword !== confirmPassword) return isUk ? 'Паролі не збігаються' : 'Passwords do not match'
  if (newPassword.length < 8) return isUk ? 'Пароль має містити щонайменше 8 символів' : 'Password must be at least 8 characters'
  return ''
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const { isPremium } = useSubscription()
  const isUk = isUkrainianLocale()
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
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exportingData, setExportingData] = useState(false)

  async function updatePassword() {
    const validationError = validatePasswordInput(newPassword, confirmPassword, isUk)
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

      toast.success(isUk ? 'Пароль оновлено' : 'Password updated successfully!')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      toast.error(error.message || (isUk ? 'Не вдалося оновити пароль' : 'Failed to update password'))
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  async function updateEmail() {
    const trimmedEmail = newEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error(isUk ? 'Вкажіть коректну email адресу' : 'Enter a valid email address')
      return
    }
    if (trimmedEmail.toLowerCase() === String(user?.email || '').toLowerCase()) {
      toast.error(isUk ? 'Це вже поточна email адреса' : 'This is already your current email address')
      return
    }

    setSavingEmail(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmedEmail })
      if (error) throw error
      toast.success(isUk ? 'Ми надіслали підтвердження на нову email адресу' : 'We sent a confirmation link to your new email address')
      setNewEmail('')
    } catch (error) {
      toast.error(error.message || (isUk ? 'Не вдалося оновити email' : 'Failed to update email'))
      console.error(error)
    } finally {
      setSavingEmail(false)
    }
  }

  async function deleteAccount() {
    setDeleting(true)
    try {
      await api.delete('/auth')
      toast.success(isUk ? 'Акаунт видалено. Виходимо...' : 'Account deleted. Signing out...')
      setTimeout(() => {
        safeNavigateToLogin()
      }, 1000)
    } catch (error) {
      toast.error(error.response?.data?.detail || (isUk ? 'Не вдалося видалити акаунт' : 'Failed to delete account'))
      console.error(error)
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  async function exportAccountData() {
    setExportingData(true)
    try {
      const endpoints = [
        ['profile', '/profile'],
        ['lab_results', '/progress'],
        ['timeline', '/timeline'],
        ['insights', '/insights'],
        ['checkins', '/checkins/history'],
      ]
      const entries = await Promise.all(endpoints.map(async ([key, path]) => {
        try {
          const { data } = await api.get(path)
          return [key, data]
        } catch (error) {
          return [key, { unavailable: true, status: error?.response?.status || null }]
        }
      }))
      const payload = {
        exported_at: new Date().toISOString(),
        account_email: user?.email || null,
        data: Object.fromEntries(entries),
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `vitaloop-account-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success(isUk ? 'Експорт даних підготовлено' : 'Data export is ready')
    } catch (error) {
      toast.error(isUk ? 'Не вдалося підготувати експорт' : 'Failed to prepare export')
      console.error(error)
    } finally {
      setExportingData(false)
    }
  }

  return (
    <div className="coach-shell">
      <CabinetPageHeader
        title={ct().settings.title}
        subtitle={ct().settings.subtitle}
      />

      <div className="coach-grid coach-grid--2">

        <CoachCard className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
              <UserCircle2 size={18} color="#0d9488" />
            </span>
            <div>
              <div className="text-sm font-bold text-slate-900">{isUk ? 'Фото профілю' : 'Profile photo'}</div>
              <div className="text-xs text-slate-500">{isUk ? 'Відображається у кабінеті та сайдбарі' : 'Shown in cabinet and sidebar'}</div>
            </div>
          </div>
          <AvatarUpload
            user={user}
            isUk={isUk}
            onUpdate={useCallback(() => {
              supabase.auth.getUser().then(({ data }) => {
                if (data?.user) toast.success(isUk ? 'Аватар оновлено' : 'Avatar updated')
              })
            }, [isUk])}
          />
        </CoachCard>

        <CoachCard className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <Mail size={18} className="text-emerald-600" />
            <div>
              <div className="text-base font-semibold text-slate-900">{isUk ? 'Email адреса' : 'Email address'}</div>
              <div className="text-xs text-slate-500">{isUk ? 'Email для входу в акаунт' : 'Your account login email'}</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900">
            {user?.email || (isUk ? 'Email не вказано' : 'No email')}
          </div>

          <div className="mt-4 grid gap-3">
            <CoachInput label={isUk ? 'Нова email адреса' : 'New email address'}>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </CoachInput>
            <CoachButton onClick={updateEmail} disabled={savingEmail || !newEmail.trim()}>
              {savingEmail ? (isUk ? 'Надсилаємо...' : 'Sending...') : (isUk ? 'Надіслати підтвердження' : 'Send confirmation')}
            </CoachButton>
            <p className="text-xs leading-5 text-slate-500">
              {isUk ? 'Email зміниться після підтвердження за посиланням у новій пошті.' : 'Your email changes after you confirm the link sent to the new address.'}
            </p>
          </div>
        </CoachCard>

        <CoachCard className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <Lock size={18} className="text-emerald-600" />
            <div>
              <div className="text-base font-semibold text-slate-900">{isUk ? 'Пароль' : 'Password'}</div>
              <div className="text-xs text-slate-500">{isUk ? 'Змініть пароль акаунта' : 'Change your account password'}</div>
            </div>
          </div>

          <div className="grid gap-4">
            <CoachInput label={isUk ? 'Новий пароль' : 'New Password'}>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={isUk ? 'Щонайменше 8 символів' : 'At least 8 characters'}
              />
            </CoachInput>

            <CoachInput label={isUk ? 'Підтвердіть пароль' : 'Confirm Password'}>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={isUk ? 'Введіть пароль ще раз' : 'Re-enter your password'}
              />
            </CoachInput>

            <CoachButton onClick={updatePassword} disabled={saving || !newPassword}>
              {saving ? (isUk ? 'Оновлення...' : 'Updating...') : (isUk ? 'Оновити пароль' : 'Update Password')}
            </CoachButton>
          </div>
        </CoachCard>

        <CoachCard className="p-6">
          <NotificationPreferences
            currentPreferences={notifications}
            onSave={(prefs) => {
              setNotifications(prefs)
              toast.success(isUk ? 'Налаштування сповіщень оновлено' : 'Notification preferences updated!')
            }}
          />
        </CoachCard>

        <CoachCard className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
              <Cookie size={18} color="#0d9488" />
            </span>
            <div>
              <div className="text-sm font-bold text-slate-900">{isUk ? 'Налаштування cookie' : 'Cookie Preferences'}</div>
              <div className="text-xs text-slate-500">{isUk ? 'Керуйте даними, які ми можемо збирати' : 'Manage what data we may collect'}</div>
            </div>
          </div>
          <p className="mb-4 text-sm text-slate-600">
            {isUk
              ? 'Перегляньте або оновіть згоду на аналітичні, маркетингові та функціональні cookie. Обовʼязкові cookie для входу та безпеки не можна вимкнути.'
              : 'Review or update your consent for analytics, marketing and functional cookies. Essential cookies required for login and security cannot be disabled.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <CoachButton variant="secondary" size="sm" onClick={resetCookieConsent}>
              {isUk ? 'Оновити налаштування cookie' : 'Update Cookie Settings'}
            </CoachButton>
            <a href="/privacy-policy/#cookies" target="_blank" rel="noreferrer" className="rounded-full px-4 py-2 text-sm font-semibold text-emerald-700 underline underline-offset-4">
              {isUk ? 'Політика cookie ↗' : 'Cookie Policy ↗'}
            </a>
          </div>
        </CoachCard>

        <CoachCard className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
              <Download size={18} color="#2563eb" />
            </span>
            <div>
              <div className="text-sm font-bold text-slate-900">{isUk ? 'Дані та приватність' : 'Data & Privacy'}</div>
              <div className="text-xs text-slate-500">{isUk ? 'Експорт основних даних акаунта' : 'Export core account data'}</div>
            </div>
          </div>
          <p className="mb-4 text-sm leading-6 text-slate-600">
            {isUk
              ? 'Скачайте копію профілю, завантажених результатів, динаміки, інсайтів і чек-інів у JSON форматі.'
              : 'Download a JSON copy of your profile, uploaded result history, progress, insights, and check-ins.'}
          </p>
          <button onClick={exportAccountData} disabled={exportingData} className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60">
            {exportingData ? (isUk ? 'Готуємо експорт...' : 'Preparing export...') : (isUk ? 'Скачати мої дані' : 'Download my data')}
          </button>
        </CoachCard>

        <CoachCard tone="attention" className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <AlertTriangle size={18} className="text-rose-700" />
            <div>
              <div className="text-base font-semibold text-rose-900">{isUk ? 'Небезпечна зона' : 'Danger zone'}</div>
              <div className="text-xs text-rose-700">{isUk ? 'Незворотні дії' : 'Irreversible actions'}</div>
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
                <span className="inline-flex items-center gap-2"><LogOut className="h-4 w-4" /> {isUk ? 'Вийти з усіх пристроїв' : 'Sign Out from All Devices'}</span>
              </button>
              <p className="mt-2 text-xs text-rose-700">
                {isUk ? 'Вийдіть із VITALOOP на всіх пристроях. Потрібно буде увійти знову.' : "Sign out of VITALOOP on all your devices. You'll need to log in again."}
              </p>
            </div>

            {isPremium && (
              <div className="border-t border-rose-300/50 pt-3">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-blue-900">
                    <CreditCard className="h-4 w-4" />
                    {isUk ? 'Оплата Premium' : 'Premium billing'}
                  </div>
                  <p className="text-xs leading-5 text-blue-800">
                    {isUk
                      ? 'Premium доступ активується вручну. Медичні дані не передаються платіжним інструментам.'
                      : 'Premium access is activated manually. Medical data is not shared with billing tools.'}
                  </p>
                  <button type="button" onClick={() => { window.location.href = '/billing-history' }} className="mt-3 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                    {isUk ? 'Переглянути оплату' : 'View billing'}
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-rose-300/50 pt-3">
              {!showDeleteConfirm ? (
                <>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full rounded-2xl border border-red-500 bg-white px-6 py-3 text-center font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    {isUk ? 'Видалити акаунт назавжди' : 'Delete Account Permanently'}
                  </button>
                  <p className="mt-2 text-xs text-rose-700">
                    {isUk ? 'Назавжди видалити акаунт і всі повʼязані дані. Цю дію не можна скасувати.' : 'Permanently delete your account and all associated data. This cannot be undone.'}
                  </p>
                </>
              ) : (
                <div className="rounded-xl border-l-4 border-rose-800 bg-red-100/80 px-3 py-3">
                  <p className="mb-2 text-sm font-bold text-rose-900">
                    {isUk ? 'УВАГА: акаунт і всі дані буде видалено назавжди. Цю дію неможливо скасувати.' : 'WARNING: This will permanently delete your account and all data. This action cannot be reversed!'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={deleteAccount}
                      disabled={deleting}
                      className="flex-1 rounded-lg bg-red-700 px-4 py-2 font-semibold text-white transition hover:bg-red-800 disabled:opacity-60"
                    >
                      {deleting ? (isUk ? 'Видалення...' : 'Deleting...') : (isUk ? 'Так, видалити все' : 'Yes, Delete Everything')}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="flex-1 rounded-lg border border-rose-400 bg-white px-4 py-2 font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                    >
                      {isUk ? 'Скасувати' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CoachCard>
      </div>
    </div>
  )
}
