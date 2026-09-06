import toast from 'react-hot-toast'

const SUPPORT_EMAIL = 'info@softdab.tech'

export function openPremiumAccessEmail(userEmail, source = 'cabinet') {
  if (typeof window === 'undefined') return

  const subject = 'VITALOOP Premium access request'
  const body = [
    'Hi VITALOOP team,',
    '',
    'I would like to request Premium access.',
    '',
    `Account email: ${userEmail || ''}`,
    `Source: ${source}`,
    '',
    'Thank you.',
  ].join('\n')

  window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export async function requestPremiumAccess({ userEmail, source = 'cabinet', successMessage } = {}) {
  openPremiumAccessEmail(userEmail, source)
  toast.success(successMessage || 'Email us to activate Premium access')
}

export function getPremiumAccessEmail() {
  return SUPPORT_EMAIL
}
