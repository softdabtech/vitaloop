export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  return false
}

export function sendNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted') {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        options,
      })
    } else {
      new Notification(title, options)
    }
  }
}

export function scheduleNotification(delayMs: number, title: string, options?: NotificationOptions) {
  setTimeout(() => sendNotification(title, options), delayMs)
}

export const reminders = {
  weeklyCheckIn: async () => {
    const allowed = await requestNotificationPermission()
    if (allowed) {
      sendNotification('Time for your weekly check-in', {
        body: 'How are you feeling this week?',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge.png',
        tag: 'weekly-checkin',
        requireInteraction: true,
      })
    }
  },

  labUploadReminder: async () => {
    const allowed = await requestNotificationPermission()
    if (allowed) {
      sendNotification('Upload your lab results', {
        body: 'Get personalized insights from your latest biomarkers',
        icon: '/icons/icon-192.png',
        tag: 'lab-upload',
      })
    }
  },

  protocolAdherence: async (protocol: string) => {
    const allowed = await requestNotificationPermission()
    if (allowed) {
      sendNotification('Protocol reminder', {
        body: `Don't forget: ${protocol}`,
        icon: '/icons/icon-192.png',
        tag: 'protocol-reminder',
      })
    }
  },
}
