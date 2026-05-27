import { Mail, Zap, Calendar, AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../lib/api.js'
import {
  getPushStatus,
  isPushSupported,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
} from '../lib/notifications.ts'

const NOTIFICATION_TYPES = {
  weekly_checkin: {
    label: 'Symptom Check-in Reminder',
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
    label: 'Biomarker / Safety Alerts',
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

export default function NotificationPreferences({ currentPreferences = {}, onSave }) {
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
      toast.success('Notification preferences saved!')
    } catch (error) {
      toast.error('Failed to save preferences')
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
        toast.error('Push permission not granted or VAPID key is missing')
        return
      }

      setPushEnabled(true)
      const status = await getPushStatus()
      setPushCount(Number(status.count || 0))
      await sendTestPush()
      toast.success('Push notifications enabled for this device')
    } catch (error) {
      toast.error('Failed to enable push notifications')
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
      toast.success('Push notifications disabled on this device')
    } catch (error) {
      toast.error('Failed to disable push notifications')
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
        toast.success('Test push sent')
      } else {
        toast.error('No active push subscription for this device')
      }
    } catch (error) {
      toast.error('Failed to send test push')
      console.error(error)
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Notification Preferences</h3>
        <p className="text-sm text-slate-600">
          Choose which notifications keep you engaged and motivated
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Browser & Mobile Push</p>
            <p className="text-xs text-slate-600 mt-1">
              {isPushSupported()
                ? (pushEnabled ? `Enabled on ${pushCount} device(s)` : 'Disabled on this device')
                : 'Push is not supported in this browser'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!pushEnabled ? (
              <button
                onClick={enablePush}
                disabled={pushBusy || !isPushSupported()}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                Enable Push
              </button>
            ) : (
              <>
                <button
                  onClick={triggerTestPush}
                  disabled={pushBusy}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Send Test
                </button>
                <button
                  onClick={disablePush}
                  disabled={pushBusy}
                  className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  Disable Push
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {Object.entries(NOTIFICATION_TYPES).map(([key, notification]) => {
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
              className={`rounded-2xl border-2 p-4 flex items-start gap-4 transition ${
                isEnabled
                  ? colorClasses[notification.color]
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="pt-1">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => handleToggle(key)}
                  className="w-5 h-5 rounded cursor-pointer"
                />
              </div>

              <div className="flex-1 min-w-0">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{notification.label}</p>
                    <p className="text-xs text-slate-600 mt-1">{notification.description}</p>
                  </div>
                </label>
              </div>

              {isEnabled && (
                <div className="text-sm font-semibold text-slate-600 whitespace-nowrap">
                  ON
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
        className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 transition disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Notification Preferences'}
      </button>

      {/* Info */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold text-slate-600 mb-2">💡 HOW WE NOTIFY:</p>
        <ul className="text-xs text-slate-600 space-y-1">
          <li>✓ In-app notifications appear while you use the app</li>
          <li>✓ Browser/mobile push works after you enable permission on this device</li>
          <li>✓ Email reminders sent to your registered email</li>
          <li>✓ No spam - we respect your time</li>
          <li>✓ You control everything here</li>
        </ul>
      </div>
    </div>
  )
}
