import { Mail, Zap, Calendar, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../lib/api.js'

const NOTIFICATION_TYPES = {
  weekly_checkin: {
    label: 'Weekly Check-in Reminder',
    description: 'Friday 6pm - Remind me to complete my weekly check-in',
    icon: Calendar,
    color: 'purple',
    default: true,
  },
  assignment_due: {
    label: 'Upcoming Assignment',
    description: 'Notify when assignments are due today',
    icon: AlertCircle,
    color: 'orange',
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
    description: 'Important changes in your biomarkers',
    icon: AlertCircle,
    color: 'red',
    default: true,
  },
}

export default function NotificationPreferences({ currentPreferences = {}, onSave }) {
  const [preferences, setPreferences] = useState(currentPreferences)
  const [saving, setSaving] = useState(false)

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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Notification Preferences</h3>
        <p className="text-sm text-slate-600">
          Choose which notifications keep you engaged and motivated
        </p>
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
          <li>✓ Email reminders sent to your registered email</li>
          <li>✓ No spam - we respect your time</li>
          <li>✓ You control everything here</li>
        </ul>
      </div>
    </div>
  )
}
