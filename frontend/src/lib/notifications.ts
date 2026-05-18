import api from '../api/client.ts'

type PushStatus = {
  ok: boolean
  enabled: boolean
  count: number
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

function detectPlatform(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop'
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent)
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches
  return mobileUa || coarse ? 'mobile' : 'desktop'
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isPushSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export async function getPushStatus(): Promise<PushStatus> {
  const { data } = await api.get('/notifications/push/status')
  return data as PushStatus
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false

  const granted = await requestNotificationPermission()
  if (!granted) return false

  const { data: keyData } = await api.get('/notifications/push/public-key')
  if (!keyData?.configured || !keyData?.public_key) return false

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(String(keyData.public_key)),
    })
  }

  const payload = subscription.toJSON()
  await api.post('/notifications/push/subscribe', {
    endpoint: payload.endpoint,
    keys: payload.keys,
    platform: detectPlatform(),
    user_agent: navigator.userAgent,
  })

  return true
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return true

  const endpoint = subscription.endpoint
  await api.post('/notifications/push/unsubscribe', { endpoint })
  await subscription.unsubscribe()
  return true
}

export async function sendTestPush(): Promise<number> {
  const { data } = await api.post('/notifications/push/test')
  return Number(data?.sent || 0)
}
