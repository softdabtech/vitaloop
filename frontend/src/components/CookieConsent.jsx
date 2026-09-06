import { useState, useEffect, useCallback } from 'react'
import { isUkrainianLocale } from '../lib/locale.js'

const STORAGE_KEY = 'vitaloop-cookie-consent'
const CONSENT_VERSION = '1'

const T = {
  en: {
    bannerTitle: 'We use cookies',
    bannerText:
      'We use essential cookies to keep the service running, and optional analytics and marketing cookies to improve your experience and measure campaign performance. You can change your preferences at any time in Settings.',
    acceptAll: 'Accept All',
    rejectOptional: 'Reject Non-Essential',
    manageSettings: 'Manage Settings',
    privacyLink: 'Privacy Policy',
    cookiePolicyLink: 'Cookie Policy',

    settingsTitle: 'Cookie Preferences',
    settingsSubtitle: 'Choose which cookies you allow us to use. You can update this at any time.',
    savePrefs: 'Save Preferences',
    acceptAllBtn: 'Accept All',

    essential: 'Essential',
    essentialDesc:
      'Required for authentication, security and core functionality. Cannot be disabled.',
    analytics: 'Analytics',
    analyticsDesc:
      'Help us understand how visitors use the site (Google Analytics, ContentSquare). No personal data is sold.',
    marketing: 'Marketing',
    marketingDesc:
      'Used to measure the effectiveness of ads and retargeting campaigns (Meta Pixel). Your data is used only for conversion reporting.',
    functional: 'Functional',
    functionalDesc:
      'Remember your preferences such as language, region and display settings across sessions.',

    always: 'Always on',
    on: 'On',
    off: 'Off',
    back: '← Back',
  },
  uk: {
    bannerTitle: 'Ми використовуємо cookie',
    bannerText:
      'Ми використовуємо необхідні файли cookie для роботи сервісу та додаткові — для аналітики та маркетингу. Ви можете змінити налаштування будь-коли у розділі Налаштування.',
    acceptAll: 'Прийняти всі',
    rejectOptional: 'Відхилити необов\'язкові',
    manageSettings: 'Налаштування',
    privacyLink: 'Політика конфіденційності',
    cookiePolicyLink: 'Політика Cookie',

    settingsTitle: 'Налаштування Cookie',
    settingsSubtitle:
      'Оберіть, які файли cookie ви дозволяєте використовувати. Ви можете змінити це будь-коли.',
    savePrefs: 'Зберегти налаштування',
    acceptAllBtn: 'Прийняти всі',

    essential: 'Необхідні',
    essentialDesc:
      'Потрібні для авторизації, безпеки та основних функцій сервісу. Неможливо вимкнути.',
    analytics: 'Аналітика',
    analyticsDesc:
      'Допомагають розуміти, як відвідувачі використовують сайт (Google Analytics, ContentSquare). Персональні дані не продаються.',
    marketing: 'Маркетинг',
    marketingDesc:
      'Вимірюють ефективність реклами та ретаргетингу (Meta Pixel). Дані використовуються лише для звіту про конверсії.',
    functional: 'Функціональні',
    functionalDesc:
      "Запам'ятовують ваші вподобання: мову, регіон та параметри відображення між сесіями.",

    always: 'Завжди увімк.',
    on: 'Увімк.',
    off: 'Вимк.',
    back: '← Назад',
  },
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.version !== CONSENT_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

function saveConsent(prefs) {
  const record = { ...prefs, version: CONSENT_VERSION, timestamp: new Date().toISOString() }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {}
  // Notify analytics loader
  if (typeof window.loadVitaloopAnalytics === 'function') {
    window.loadVitaloopAnalytics(record)
  }
  return record
}

// Toggle switch
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? '#9ca3af' : checked ? '#0d9488' : '#d1d5db',
        transition: 'background 0.2s',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: checked ? 23 : 3,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        transition: 'left 0.18s',
      }} />
    </button>
  )
}

// Settings panel (full preferences)
function SettingsPanel({ t, prefs, setPrefs, onSave, onAcceptAll, onBack }) {
  const cats = [
    { key: 'essential', label: t.essential, desc: t.essentialDesc, locked: true },
    { key: 'analytics', label: t.analytics, desc: t.analyticsDesc },
    { key: 'marketing', label: t.marketing, desc: t.marketingDesc },
    { key: 'functional', label: t.functional, desc: t.functionalDesc },
  ]

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <button onClick={onBack} style={backBtnStyle}>{t.back}</button>
      </div>
      <h2 style={titleStyle}>{t.settingsTitle}</h2>
      <p style={subtitleStyle}>{t.settingsSubtitle}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '18px 0' }}>
        {cats.map(({ key, label, desc, locked }) => (
          <div key={key} style={rowStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{label}</span>
                {locked && (
                  <span style={chipStyle}>{t.always}</span>
                )}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b', lineHeight: 1.5 }}>{desc}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {!locked && (
                <span style={{ fontSize: 12, color: prefs[key] ? '#0d9488' : '#9ca3af', fontWeight: 600 }}>
                  {prefs[key] ? t.on : t.off}
                </span>
              )}
              <Toggle
                checked={locked ? true : prefs[key]}
                onChange={(v) => setPrefs(p => ({ ...p, [key]: v }))}
                disabled={locked}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={onSave} style={primaryBtnStyle}>{t.savePrefs}</button>
        <button onClick={onAcceptAll} style={secondaryBtnStyle}>{t.acceptAllBtn}</button>
      </div>
    </div>
  )
}

export default function CookieConsent() {
  // Vanilla JS in index.html handles consent before React loads.
  // Avoid double banner: if the vanilla script is active, return null.
  if (typeof window !== 'undefined' && window.__vlCookieHandledByVanilla) return null
  const [visible, setVisible] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [prefs, setPrefs] = useState({ analytics: true, marketing: true, functional: true })
  const isUk = isUkrainianLocale()
  const t = isUk ? T.uk : T.en

  useEffect(() => {
    const stored = loadStored()
    if (!stored || !stored.decided) {
      // Small delay so the page renders first
      const timer = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  const acceptAll = useCallback(() => {
    saveConsent({ decided: true, essential: true, analytics: true, marketing: true, functional: true })
    setVisible(false)
    setShowSettings(false)
  }, [])

  const rejectOptional = useCallback(() => {
    saveConsent({ decided: true, essential: true, analytics: false, marketing: false, functional: false })
    setVisible(false)
    setShowSettings(false)
  }, [])

  const savePreferences = useCallback(() => {
    saveConsent({ decided: true, essential: true, ...prefs })
    setVisible(false)
    setShowSettings(false)
  }, [prefs])

  if (!visible) return null

  const privacyHref = isUk ? '/privacy-policy/' : '/privacy-policy/'
  const cookieSection = `${privacyHref}#cookies`

  if (showSettings) {
    return (
      <div style={backdropStyle}>
        <SettingsPanel
          t={t}
          prefs={prefs}
          setPrefs={setPrefs}
          onSave={savePreferences}
          onAcceptAll={acceptAll}
          onBack={() => setShowSettings(false)}
        />
      </div>
    )
  }

  return (
    <div style={bannerWrapStyle} role="dialog" aria-modal="true" aria-label={t.bannerTitle}>
      <div style={bannerInnerStyle}>
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>🍪</span>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
              {t.bannerTitle}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#475569', lineHeight: 1.55, maxWidth: 520 }}>
              {t.bannerText}{' '}
              <a href={privacyHref} style={linkStyle} target="_blank" rel="noreferrer">{t.privacyLink}</a>
              {' · '}
              <a href={cookieSection} style={linkStyle} target="_blank" rel="noreferrer">{t.cookiePolicyLink}</a>
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div style={btnGroupStyle}>
          <button onClick={acceptAll} style={primaryBtnStyle}>{t.acceptAll}</button>
          <button onClick={rejectOptional} style={outlineBtnStyle}>{t.rejectOptional}</button>
          <button onClick={() => setShowSettings(true)} style={ghostBtnStyle}>{t.manageSettings}</button>
        </div>
      </div>
    </div>
  )
}

// ── Style constants ──────────────────────────────────────────────────────────

const backdropStyle = {
  position: 'fixed', inset: 0, zIndex: 10000,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)',
  padding: '0 16px 24px',
}

const bannerWrapStyle = {
  position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10000,
  padding: '0 16px 20px',
  display: 'flex', justifyContent: 'center',
  pointerEvents: 'none',
}

const bannerInnerStyle = {
  pointerEvents: 'auto',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 20,
  boxShadow: '0 -4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(15,23,42,0.18)',
  padding: '20px 24px',
  width: '100%',
  maxWidth: 740,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const panelStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 20,
  boxShadow: '0 20px 60px rgba(15,23,42,0.22)',
  padding: '24px',
  width: '100%',
  maxWidth: 520,
  maxHeight: '90vh',
  overflowY: 'auto',
}

const titleStyle = { margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }
const subtitleStyle = { margin: '6px 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.5 }

const rowStyle = {
  display: 'flex', alignItems: 'flex-start', gap: 16,
  padding: '14px 16px', borderRadius: 12,
  background: '#f8fafc', border: '1px solid #e2e8f0',
}

const chipStyle = {
  fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
  color: '#0d9488', background: '#f0fdfa', border: '1px solid #99f6e4',
  borderRadius: 100, padding: '2px 8px',
}

const btnGroupStyle = {
  display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
}

const primaryBtnStyle = {
  padding: '10px 22px', borderRadius: 100, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
  color: '#fff', fontWeight: 700, fontSize: 13.5,
  boxShadow: '0 4px 14px rgba(15,118,110,0.30)',
  transition: 'opacity 0.15s',
  whiteSpace: 'nowrap',
}

const secondaryBtnStyle = {
  ...primaryBtnStyle,
  background: '#0f172a',
  boxShadow: '0 4px 14px rgba(15,23,42,0.20)',
}

const outlineBtnStyle = {
  padding: '10px 22px', borderRadius: 100, cursor: 'pointer',
  background: 'transparent',
  border: '1.5px solid #cbd5e1',
  color: '#475569', fontWeight: 700, fontSize: 13.5,
  transition: 'border-color 0.15s',
  whiteSpace: 'nowrap',
}

const ghostBtnStyle = {
  padding: '10px 16px', borderRadius: 100, border: 'none', cursor: 'pointer',
  background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 13,
  textDecoration: 'underline', textUnderlineOffset: 3, whiteSpace: 'nowrap',
}

const backBtnStyle = {
  padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
  background: 'transparent', cursor: 'pointer',
  color: '#64748b', fontSize: 13, fontWeight: 600,
}

const linkStyle = { color: '#0d9488', textDecoration: 'underline', textUnderlineOffset: 2 }
