import { Mail, Zap, Calendar, AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../lib/api.js'
import { isUkrainianLocale } from '../lib/locale.js'
import {
  getPushStatus,
  isPushSupported,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
} from '../lib/notifications.ts'

const NOTIFICATION_TYPES = {
  weekly_checkin: {
    label: 'Weekly Check-in Reminder',
    description: 'Friday 6pm - Remind me to complete weekly symptom check-in',
    icon: Calendar,
    color: 'purple',
    default: true,
  },
  assignment_due: {
    label: 'Upcoming Assignment',
    description: 'Nudge when active tasks stay pending',
    icon: AlertCircle,
    color: 'orange',
    default: true,
  },
  retest_reminder: {
    label: 'Lab Retest Reminder',
    description: 'After ~10 weeks from last lab upload',
    icon: Calendar,
    color: 'blue',
    default: true,
  },
  streak_reminder: {
    label: 'Streak Reminder',
    description: 'Keep your streak alive - daily nudge at preferred time',
    icon: Zap,
    color: 'red',
    default: true,
  },
  weekly_digest: {
    label: 'Weekly Digest',
    description: 'Sunday evening - Summary of your week',
    icon: Mail,
    color: 'blue',
    default: true,
  },
  achievement_unlock: {
    label: 'Achievement Unlocked',
    description: 'Celebrate when you unlock new badges',
    icon: Zap,
    color: 'yellow',
    default: true,
  },
  biomarker_alert: {
    label: 'Biomarker Alerts',
    description: 'Important marker shifts or safety-related context changes',
    icon: AlertCircle,
    color: 'red',
    default: true,
  },
  insight_published: {
    label: 'New Next-step Insight',
    description: 'Notify when a new next-step recommendation appears',
    icon: Zap,
    color: 'purple',
    default: true,
  },
}

const NOTIFICATION_TYPES_UK = {
  weekly_checkin: {
    label: 'Щотижневий чек-ін',
    description: 'Пʼятниця 18:00 - нагадати пройти перевірку симптомів',
  },
  assignment_due: {
    label: 'Активне завдання',
    description: 'Нагадування, коли завдання довго залишаються невиконаними',
  },
  retest_reminder: {
    label: 'Нагадування про повторні аналізи',
    description: 'Приблизно через 10 тижнів після останнього аналізу',
  },
  streak_reminder: {
    label: 'Нагадування про серію',
    description: 'Щоденний поштовх у вибраний час, щоб не втрачати ритм',
  },
  weekly_digest: {
    label: 'Щотижневий дайджест',
    description: 'Неділя ввечері - підсумок вашого тижня',
  },
  achievement_unlock: {
    label: 'Нове досягнення',
    description: 'Сповіщення, коли відкриваєте нові бейджі',
  },
  biomarker_alert: {
    label: 'Важливі маркери',
    description: 'Суттєві зміни показників або контекст безпеки',
  },
  insight_published: {
    label: 'Нова рекомендація',
    description: 'Сповіщення, коли зʼявляється наступний крок',
  },
}

export default function NotificationPreferences({ currentPreferences = {}, onSave }) {
  const isUk = isUkrainianLocale()
  const [preferences, setPreferences] = useState(currentPreferences)
  const [saving, setSaving] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushCount, setPushCount] = useState(0)

  useEffect(() => {
    let mounted = true

    async function loadPushStatus() {
      if (!isPushSupported()) {
        if (mounted) {
          setPushEnabled(false)
          setPushCount(0)
        }
        return
      }

      try {
        const status = await getPushStatus()
        if (mounted) {
          setPushEnabled(Boolean(status.enabled))
          setPushCount(Number(status.count || 0))
        }
      } catch {
        if (mounted) {
          setPushEnabled(false)
          setPushCount(0)
        }
      }
    }

    loadPushStatus()
    return () => { mounted = false }
  }, [])

  const handleToggle = (type) => {
    setPreferences({
      ...preferences,
      [type]: !preferences[type],
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch('/settings/notifications', preferences)
      if (onSave) onSave(preferences)
      toast.success(isUk ? 'Налаштування сповіщень збережено' : 'Notification preferences saved!')
    } catch (error) {
      toast.error(isUk ? 'Не вдалося зберегти налаштування' : 'Failed to save preferences')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const enablePush = async () => {
    setPushBusy(true)
    try {
      const ok = await subscribeToPush()
      if (!ok) {
        toast.error(isUk ? 'Дозвіл на push не надано або VAPID-ключ відсутній' : 'Push permission not granted or VAPID key is missing')
        return
      }

      setPushEnabled(true)
      const status = await getPushStatus()
      setPushCount(Number(status.count || 0))
      await sendTestPush()
      toast.success(isUk ? 'Push-сповіщення ввімкнено для цього пристрою' : 'Push notifications enabled for this device')
    } catch (error) {
      toast.error(isUk ? 'Не вдалося ввімкнути push-сповіщення' : 'Failed to enable push notifications')
      console.error(error)
    } finally {
      setPushBusy(false)
    }
  }

  const disablePush = async () => {
    setPushBusy(true)
    try {
      await unsubscribeFromPush()
      setPushEnabled(false)
      setPushCount(0)
      toast.success(isUk ? 'Push-сповіщення вимкнено на цьому пристрої' : 'Push notifications disabled on this device')
    } catch (error) {
      toast.error(isUk ? 'Не вдалося вимкнути push-сповіщення' : 'Failed to disable push notifications')
      console.error(error)
    } finally {
      setPushBusy(false)
    }
  }

  const triggerTestPush = async () => {
    setPushBusy(true)
    try {
      const sent = await sendTestPush()
      if (sent > 0) {
        toast.success(isUk ? 'Тестове push-сповіщення надіслано' : 'Test push sent')
      } else {
        toast.error(isUk ? 'На цьому пристрої немає активної push-підписки' : 'No active push subscription for this device')
      }
    } catch (error) {
      toast.error(isUk ? 'Не вдалося надіслати тестове push-сповіщення' : 'Failed to send test push')
      console.error(error)
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-slate-900 mb-1">{isUk ? 'Налаштування сповіщень' : 'Notification Preferences'}</h3>
        <p className="text-xs text-slate-600">
          {isUk ? 'Оберіть, які сповіщення допомагатимуть тримати ритм' : 'Choose which notifications keep you engaged and motivated'}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">{isUk ? 'Push у браузері та на мобільному' : 'Browser & Mobile Push'}</p>
            <p className="text-xs text-slate-600 mt-1">
              {isPushSupported()
                ? (pushEnabled
                  ? (isUk ? `Увімкнено на ${pushCount} пристрої(ях)` : `Enabled on ${pushCount} device(s)`)
                  : (isUk ? 'Вимкнено на цьому пристрої' : 'Disabled on this device'))
                : (isUk ? 'Цей браузер не підтримує push' : 'Push is not supported in this browser')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!pushEnabled ? (
              <button
                onClick={enablePush}
                disabled={pushBusy || !isPushSupported()}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {isUk ? 'Увімкнути push' : 'Enable Push'}
              </button>
            ) : (
              <>
                <button
                  onClick={triggerTestPush}
                  disabled={pushBusy}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  {isUk ? 'Надіслати тест' : 'Send Test'}
                </button>
                <button
                  onClick={disablePush}
                  disabled={pushBusy}
                  className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  {isUk ? 'Вимкнути push' : 'Disable Push'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="grid gap-2 md:grid-cols-2">
        {Object.entries(NOTIFICATION_TYPES).map(([key, notification]) => {
          const localized = isUk ? { ...notification, ...(NOTIFICATION_TYPES_UK[key] || {}) } : notification
          const Icon = notification.icon
          const colorClasses = {
            purple: 'border-purple-200 bg-purple-50',
            orange: 'border-orange-200 bg-orange-50',
            red: 'border-red-200 bg-red-50',
            blue: 'border-blue-200 bg-blue-50',
            yellow: 'border-yellow-200 bg-yellow-50',
          }

          const isEnabled = preferences[key] ?? notification.default

          return (
            <div
              key={key}
              className={`rounded-xl border p-3 transition ${
                isEnabled
                  ? colorClasses[notification.color]
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => handleToggle(key)}
                  className="h-4 w-4 rounded cursor-pointer"
                />
                </div>

                <div className="flex-1 min-w-0">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{localized.label}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{localized.description}</p>
                  </div>
                </label>
              </div>
              </div>

              {isEnabled && (
                <div className="mt-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                  {isUk ? 'УВІМКНЕНО' : 'ON'}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        {saving ? (isUk ? 'Збереження...' : 'Saving...') : (isUk ? 'Зберегти налаштування сповіщень' : 'Save Notification Preferences')}
      </button>

      {/* Info */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-600 mb-2">{isUk ? 'ЯК МИ СПОВІЩАЄМО:' : 'HOW WE NOTIFY:'}</p>
        <ul className="text-xs text-slate-600 space-y-1">
          <li>{isUk ? 'Сповіщення в кабінеті зʼявляються під час користування сервісом' : 'In-app notifications appear while you use the app'}</li>
          <li>{isUk ? 'Push у браузері або на мобільному працює після дозволу на цьому пристрої' : 'Browser/mobile push works after you enable permission on this device'}</li>
          <li>{isUk ? 'Email-нагадування надсилаються на зареєстровану адресу' : 'Email reminders sent to your registered email'}</li>
          <li>{isUk ? 'Без спаму - ми поважаємо ваш час' : 'No spam - we respect your time'}</li>
          <li>{isUk ? 'Усі налаштування під вашим контролем' : 'You control everything here'}</li>
        </ul>
      </div>
    </div>
  )
}
