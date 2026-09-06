import { Mail, Zap, Calendar, AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../lib/api.js'
import { CoachButton, CoachCard } from './coach/CoachUI.jsx'
import { isUkrainianLocale } from '../lib/locale.js'
import {
  getPushStatus,
  isPushSupported,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
} from '../lib/notifications.ts'
// coach-shell/coach-card/etc. have no built-in styles of their own — every
// rule lives in this stylesheet. Belt-and-suspenders here since the parent
// (Settings.jsx) already imports it and Vite bundles CSS per route chunk,
// not per component — but this component could be reused elsewhere later.
import '../styles/coach-design-system.css'

const NOTIFICATION_COPY = {
  en: {
    title: 'Notification Preferences',
    subtitle: 'Choose which notifications keep you engaged and motivated',
    pushTitle: 'Browser & Mobile Push',
    pushEnabled: (count) => `Enabled on ${count} device(s)`,
    pushDisabled: 'Disabled on this device',
    pushUnsupported: 'Push is not supported in this browser',
    enablePush: 'Enable Push',
    sendTest: 'Send Test',
    disablePush: 'Disable Push',
    on: 'ON',
    save: 'Save Notification Preferences',
    saving: 'Saving...',
    savedToast: 'Notification preferences saved!',
    saveFailedToast: 'Failed to save preferences',
    pushGrantFailedToast: 'Push permission not granted or VAPID key is missing',
    pushEnabledToast: 'Push notifications enabled for this device',
    pushEnableFailedToast: 'Failed to enable push notifications',
    pushDisabledToast: 'Push notifications disabled on this device',
    pushDisableFailedToast: 'Failed to disable push notifications',
    testSentToast: 'Test push sent',
    testNoSubscriptionToast: 'No active push subscription for this device',
    testFailedToast: 'Failed to send test push',
    howWeNotify: 'HOW WE NOTIFY:',
    howList: [
      'In-app notifications appear while you use the app',
      'Browser/mobile push works after you enable permission on this device',
      'Email reminders sent to your registered email',
      'No spam - we respect your time',
      'You control everything here',
    ],
    types: {
      weekly_checkin: { label: 'Weekly Check-in Reminder', description: 'Friday 6pm - Remind me to complete weekly symptom check-in' },
      assignment_due: { label: 'Upcoming Assignment', description: 'Nudge when active tasks stay pending' },
      retest_reminder: { label: 'Lab Retest Reminder', description: 'After ~10 weeks from last lab upload' },
      streak_reminder: { label: 'Streak Reminder', description: 'Keep your streak alive - daily nudge at preferred time' },
      weekly_digest: { label: 'Weekly Digest', description: 'Sunday evening - Summary of your week' },
      achievement_unlock: { label: 'Achievement Unlocked', description: 'Celebrate when you unlock new badges' },
      biomarker_alert: { label: 'Biomarker Alerts', description: 'Important marker shifts or safety-related context changes' },
      insight_published: { label: 'New Next-step Insight', description: 'Notify when a new next-step recommendation appears' },
    },
  },
  uk: {
    title: 'Налаштування сповіщень',
    subtitle: 'Оберіть, які сповіщення підтримують вашу залученість',
    pushTitle: 'Push у браузері та на мобільному',
    pushEnabled: (count) => `Увімкнено на ${count} пристроях`,
    pushDisabled: 'Вимкнено на цьому пристрої',
    pushUnsupported: 'Push не підтримується в цьому браузері',
    enablePush: 'Увімкнути push',
    sendTest: 'Надіслати тест',
    disablePush: 'Вимкнути push',
    on: 'УВІМК',
    save: 'Зберегти налаштування сповіщень',
    saving: 'Зберігаємо...',
    savedToast: 'Налаштування сповіщень збережено!',
    saveFailedToast: 'Не вдалося зберегти налаштування',
    pushGrantFailedToast: 'Дозвіл на push не надано або відсутній VAPID-ключ',
    pushEnabledToast: 'Push-сповіщення увімкнено для цього пристрою',
    pushEnableFailedToast: 'Не вдалося увімкнути push-сповіщення',
    pushDisabledToast: 'Push-сповіщення вимкнено на цьому пристрої',
    pushDisableFailedToast: 'Не вдалося вимкнути push-сповіщення',
    testSentToast: 'Тестове сповіщення надіслано',
    testNoSubscriptionToast: 'Немає активної push-підписки для цього пристрою',
    testFailedToast: 'Не вдалося надіслати тестове сповіщення',
    howWeNotify: 'ЯК МИ СПОВІЩАЄМО:',
    howList: [
      'Сповіщення в застосунку зʼявляються під час використання',
      'Push у браузері/на мобільному працює після надання дозволу на цьому пристрої',
      'Нагадування на вашу зареєстровану пошту',
      'Без спаму — ми цінуємо ваш час',
      'Ви керуєте всім тут',
    ],
    types: {
      weekly_checkin: { label: 'Нагадування про щотижневий чек-ін', description: 'Пʼятниця 18:00 — нагадати пройти щотижневий чек-ін симптомів' },
      assignment_due: { label: 'Найближче завдання', description: 'Нагадування, коли активні завдання залишаються невиконаними' },
      retest_reminder: { label: 'Нагадування про повторний аналіз', description: 'Через ~10 тижнів після останнього завантаження' },
      streak_reminder: { label: 'Нагадування про серію', description: 'Підтримуйте серію — щоденне нагадування у зручний час' },
      weekly_digest: { label: 'Щотижневий дайджест', description: 'Неділя ввечері — підсумок вашого тижня' },
      achievement_unlock: { label: 'Досягнення розблоковано', description: 'Святкуйте нові значки' },
      biomarker_alert: { label: 'Сповіщення про біомаркери', description: 'Важливі зміни показників або контексту безпеки' },
      insight_published: { label: 'Нова підказка наступного кроку', description: 'Сповіщення про нову рекомендацію наступного кроку' },
    },
  },
}

const NOTIFICATION_ICONS = {
  weekly_checkin: { icon: Calendar, color: 'purple', default: true },
  assignment_due: { icon: AlertCircle, color: 'orange', default: true },
  retest_reminder: { icon: Calendar, color: 'blue', default: true },
  streak_reminder: { icon: Zap, color: 'red', default: true },
  weekly_digest: { icon: Mail, color: 'blue', default: true },
  achievement_unlock: { icon: Zap, color: 'yellow', default: true },
  biomarker_alert: { icon: AlertCircle, color: 'red', default: true },
  insight_published: { icon: Zap, color: 'purple', default: true },
}

export default function NotificationPreferences({ currentPreferences = {}, onSave }) {
  const isUk = isUkrainianLocale()
  const copy = isUk ? NOTIFICATION_COPY.uk : NOTIFICATION_COPY.en
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
      toast.success(copy.savedToast)
    } catch (error) {
      toast.error(copy.saveFailedToast)
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
        toast.error(copy.pushGrantFailedToast)
        return
      }

      setPushEnabled(true)
      const status = await getPushStatus()
      setPushCount(Number(status.count || 0))
      await sendTestPush()
      toast.success(copy.pushEnabledToast)
    } catch (error) {
      toast.error(copy.pushEnableFailedToast)
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
      toast.success(copy.pushDisabledToast)
    } catch (error) {
      toast.error(copy.pushDisableFailedToast)
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
        toast.success(copy.testSentToast)
      } else {
        toast.error(copy.testNoSubscriptionToast)
      }
    } catch (error) {
      toast.error(copy.testFailedToast)
      console.error(error)
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="coach-title-lg">{copy.title}</h3>
        <p className="coach-body mt-1">{copy.subtitle}</p>
      </div>

      <CoachCard className="p-4" tone="soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">{copy.pushTitle}</p>
            <p className="mt-1 text-xs text-slate-600">
              {isPushSupported()
                ? (pushEnabled ? copy.pushEnabled(pushCount) : copy.pushDisabled)
                : copy.pushUnsupported}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!pushEnabled ? (
              <CoachButton size="sm" onClick={enablePush} disabled={pushBusy || !isPushSupported()}>
                {copy.enablePush}
              </CoachButton>
            ) : (
              <>
                <CoachButton size="sm" variant="secondary" onClick={triggerTestPush} disabled={pushBusy}>
                  {copy.sendTest}
                </CoachButton>
                <button
                  onClick={disablePush}
                  disabled={pushBusy}
                  className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  {copy.disablePush}
                </button>
              </>
            )}
          </div>
        </div>
      </CoachCard>

      {/* Notifications List */}
      <div className="space-y-3">
        {Object.entries(NOTIFICATION_ICONS).map(([key, meta]) => {
          const Icon = meta.icon
          const colorClasses = {
            purple: 'border-purple-200 bg-purple-50',
            orange: 'border-orange-200 bg-orange-50',
            red: 'border-red-200 bg-red-50',
            blue: 'border-blue-200 bg-blue-50',
            yellow: 'border-yellow-200 bg-yellow-50',
          }

          const isEnabled = preferences[key] ?? meta.default
          const notificationCopy = copy.types[key]

          return (
            <div
              key={key}
              className={`flex items-start gap-4 rounded-2xl border-2 p-4 transition ${
                isEnabled
                  ? colorClasses[meta.color]
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="pt-1">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => handleToggle(key)}
                  className="h-5 w-5 cursor-pointer rounded"
                />
              </div>

              <div className="min-w-0 flex-1">
                <label className="flex cursor-pointer items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{notificationCopy.label}</p>
                    <p className="mt-1 text-xs text-slate-600">{notificationCopy.description}</p>
                  </div>
                </label>
              </div>

              {isEnabled && (
                <div className="whitespace-nowrap text-sm font-semibold text-slate-600">
                  {copy.on}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <CoachButton className="w-full justify-center" onClick={handleSave} disabled={saving}>
        {saving ? copy.saving : copy.save}
      </CoachButton>

      <CoachCard className="p-4" tone="soft">
        <p className="mb-2 text-xs font-semibold text-slate-600">💡 {copy.howWeNotify}</p>
        <ul className="space-y-1 text-xs text-slate-600">
          {copy.howList.map((item) => <li key={item}>✓ {item}</li>)}
        </ul>
      </CoachCard>
    </div>
  )
}
