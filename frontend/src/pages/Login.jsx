import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { supabase } from '../lib/supabase.js'
import { navigateToResolvedPath, resolvePostLoginDestination } from '../auth/postLogin.js'
import { notifyRegistrationAlert, sendWelcomeEmail } from '../auth/registrationAlert.js'
import { trackFunnelEvent } from '../lib/funnel.js'
import { gaSignUp, gaLogin } from '../lib/analytics.js'
import toast from 'react-hot-toast'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import Seo from '../components/Seo.jsx'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value) {
  return EMAIL_RE.test(String(value || '').trim())
}

function hasAnyPasswordSymbol(value) {
  const password = String(value || '')
  // Require minimum baseline for account security in health-data context.
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password)
}

function getBrowserOrigin() {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

function getViewportWidth() {
  if (typeof window === 'undefined') return 1024
  return window.innerWidth
}

function isRecentAccount(createdAt, maxHours = 24) {
  if (!createdAt) return false
  const createdTs = Date.parse(String(createdAt))
  if (Number.isNaN(createdTs)) return false
  return (Date.now() - createdTs) <= (maxHours * 60 * 60 * 1000)
}

function isGoogleAuthUser(user) {
  const provider = String(user?.app_metadata?.provider || '').toLowerCase()
  if (provider === 'google') return true
  const providers = Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers : []
  return providers.some((p) => String(p || '').toLowerCase() === 'google')
}

function readLocalStorageArray(key) {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(window.localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

function writeLocalStorageArray(key, value) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function resolveEmailConfirmationRedirect(returnUrl = null) {
  const configured = import.meta.env.VITE_EMAIL_CONFIRMATION_PATH
  if (configured && /^https?:\/\//i.test(configured)) {
    const confirmationUrl = new URL(configured)
    if (returnUrl) {
      confirmationUrl.searchParams.set('returnUrl', returnUrl)
    }
    return confirmationUrl.toString()
  }
  const origin = getBrowserOrigin()
  if (!origin) {
    return '/auth/confirmation'
  }

  const confirmationUrl = new URL(`${origin}/auth/confirmation`)
  if (returnUrl) {
    confirmationUrl.searchParams.set('returnUrl', returnUrl)
  }
  return confirmationUrl.toString()
}

const AUTH_COPY = {
  en: {
    seoTitle: 'Log In or Sign Up | VITALOOP',
    seoDescription: 'Sign in to your VITALOOP account or create a free account to start interpreting blood test results with AI. No credit card required.',
    backToSite: 'Back to site',
    resetTitle: 'Reset password',
    signupTitle: 'Create account',
    signinTitle: 'Welcome back',
    resetSubtitle: 'Enter your email to receive a reset link.',
    signupSubtitle: 'Start with symptoms, labs, or a health goal.',
    signinSubtitle: 'Sign in to your VITALOOP account.',
    resetSuccess: 'Password reset successfully. Sign in with your new password.',
    emailLabel: 'EMAIL',
    passwordLabel: 'PASSWORD',
    forgotPassword: 'Forgot password?',
    loading: 'Loading…',
    sendReset: 'Send reset link',
    createAccount: 'Create account',
    signIn: 'Sign in',
    or: 'or',
    continueGoogle: 'Continue with Google',
    backToSignIn: '← Back to sign in',
    alreadyHave: 'Already have an account? ',
    noAccount: "Don't have an account? ",
    signUpFree: 'Sign up free',
    securityTitle: 'Your data security',
    securityBody: 'Your health data is protected with privacy-first safeguards and account-level access controls. VITALOOP does not sell your health data.',
    resendLoading: 'Sending…',
    resendConfirmation: 'Resend confirmation email',
    invalidResendEmail: 'Enter a valid email to resend confirmation.',
    confirmationResent: 'Confirmation email sent again. Check your inbox.',
    confirmationResendError: 'Could not send email: ',
    rateLimit: 'Too many attempts. Please wait 1 minute and try again.',
    invalidEmail: 'Enter a valid email.',
    weakPassword: 'Password must be at least 8 characters and include letters and numbers.',
    resetLinkSent: 'Reset link sent - check your email',
    accountCreatedRedirect: 'Account created. Redirecting...',
    accountCreatedOnboarding: 'Account created. Continue with onboarding.',
    accountCreatedConfirm: 'Account created. Confirm your email to continue.',
    sessionFailed: 'Session validation failed. Please sign in again.',
    emailNotConfirmed: 'Email is not confirmed. Confirm it from the email link or resend the confirmation email.',
    invalidCredentials: 'Invalid email or password. Check the details and try again.',
    tooManyRequests: 'Too many sign-in attempts. Wait a minute and try again.',
    defaultAuthError: 'Could not sign in. Try again.',
  },
  uk: {
    seoTitle: 'Увійти або створити акаунт | VITALOOP Ukraine',
    seoDescription: 'Увійдіть у VITALOOP Ukraine або створіть акаунт, щоб почати з симптомів, аналізів і персонального плану дій.',
    backToSite: 'На сайт',
    resetTitle: 'Відновити пароль',
    signupTitle: 'Створити акаунт',
    signinTitle: 'Вхід до акаунта',
    resetSubtitle: 'Введіть email, і ми надішлемо посилання для відновлення.',
    signupSubtitle: 'Почніть із симптомів, аналізів або цілі щодо здоровʼя.',
    signinSubtitle: 'Увійдіть у свій акаунт VITALOOP.',
    resetSuccess: 'Пароль успішно змінено. Увійдіть із новим паролем.',
    emailLabel: 'EMAIL',
    passwordLabel: 'ПАРОЛЬ',
    forgotPassword: 'Забули пароль?',
    loading: 'Завантаження…',
    sendReset: 'Надіслати посилання',
    createAccount: 'Створити акаунт',
    signIn: 'Увійти',
    or: 'або',
    continueGoogle: 'Продовжити з Google',
    backToSignIn: '← Повернутися до входу',
    alreadyHave: 'Вже маєте акаунт? ',
    noAccount: 'Ще немає акаунта? ',
    signUpFree: 'Створити безкоштовно',
    securityTitle: 'Безпека ваших даних',
    securityBody: 'Ваші дані про здоровʼя захищені privacy-first підходом і доступом на рівні акаунта. VITALOOP не продає ваші медичні дані.',
    resendLoading: 'Надсилаємо…',
    resendConfirmation: 'Надіслати підтвердження ще раз',
    invalidResendEmail: 'Введіть коректний email для повторного надсилання.',
    confirmationResent: 'Лист підтвердження надіслано повторно. Перевірте пошту.',
    confirmationResendError: 'Не вдалося надіслати лист: ',
    rateLimit: 'Забагато спроб. Зачекайте 1 хвилину і спробуйте ще раз.',
    invalidEmail: 'Введіть коректний email.',
    weakPassword: 'Пароль має містити щонайменше 8 символів, літери й цифри.',
    resetLinkSent: 'Посилання для відновлення надіслано на email.',
    accountCreatedRedirect: 'Акаунт створено. Переходимо далі...',
    accountCreatedOnboarding: 'Акаунт створено. Продовжте налаштування.',
    accountCreatedConfirm: 'Акаунт створено. Підтвердьте email, щоб продовжити.',
    sessionFailed: 'Не вдалося перевірити сесію. Увійдіть ще раз.',
    emailNotConfirmed: 'Email не підтверджено. Підтвердьте його за посиланням у листі або надішліть лист повторно.',
    invalidCredentials: 'Невірний email або пароль. Перевірте дані й спробуйте ще раз.',
    tooManyRequests: 'Забагато спроб входу. Зачекайте хвилину й повторіть.',
    defaultAuthError: 'Не вдалося увійти. Спробуйте ще раз.',
  },
}

function mapAuthErrorMessage(message, copy = AUTH_COPY.en) {
  const raw = String(message || '')
  const normalized = raw.toLowerCase()

  if (normalized.includes('email not confirmed') || normalized.includes('email_not_confirmed')) {
    return {
      text: copy.emailNotConfirmed,
      canResendConfirmation: true,
    }
  }

  if (normalized.includes('invalid login credentials')) {
    return {
      text: copy.invalidCredentials,
      canResendConfirmation: false,
    }
  }

  if (normalized.includes('too many requests')) {
    return {
      text: copy.tooManyRequests,
      canResendConfirmation: false,
    }
  }

  return {
    text: raw || copy.defaultAuthError,
    canResendConfirmation: false,
  }
}

// Medical hexagon panel for Sign In
function MedicalPanel({ side, signup = false }) {
  const isLeft = side === 'left'

  // Color palette swapped per variant
  const bg = signup
    ? 'linear-gradient(135deg, #0e0820 0%, #1e0d48 30%, #2e1870 55%, #4a2aa8 80%, #c4b5e8 100%)'
    : 'linear-gradient(135deg, #0a2540 0%, #0e3d6b 30%, #0c5a82 55%, #0d8a8a 80%, #b8d8e8 100%)'
  const glow1 = signup ? 'rgba(160,120,255,0.18)' : 'rgba(120,200,255,0.18)'
  const glow2 = signup ? 'rgba(200,180,255,0.12)' : 'rgba(180,230,255,0.12)'
  const stroke = signup ? 'rgba(200,180,255,0.6)' : 'rgba(160,220,255,0.6)'
  const fill8 = signup ? 'rgba(140,100,255,0.08)' : 'rgba(100,180,240,0.08)'
  const nodeStroke = signup ? 'rgba(200,180,255,0.45)' : 'rgba(160,220,255,0.45)'
  const nodeDot = signup ? 'rgba(220,210,255,0.8)' : 'rgba(200,235,255,0.8)'
  const dnaStroke = signup ? 'rgba(200,180,255,0.5)' : 'rgba(160,220,255,0.5)'
  const icon = signup ? 'rgba(220,210,255,0.7)' : 'rgba(200,235,255,0.7)'
  const iconSoft = signup ? 'rgba(220,210,255,0.6)' : 'rgba(200,235,255,0.6)'
  const iconFaint = signup ? 'rgba(220,210,255,0.45)' : 'rgba(200,235,255,0.45)'
  const molFill = signup ? 'rgba(180,160,255,0.4)' : 'rgba(200,235,255,0.4)'
  const molStroke = signup ? 'rgba(160,130,255,0.5)' : 'rgba(160,220,255,0.5)'
  const molLine = signup ? 'rgba(160,130,255,0.35)' : 'rgba(160,220,255,0.35)'

  // Hexagon grid positions
  const hexagons = [
    { x: 15, y: 12, size: 14, op: 0.55 },
    { x: 36, y: 8, size: 10, op: 0.35 },
    { x: 55, y: 18, size: 16, op: 0.45 },
    { x: 75, y: 10, size: 12, op: 0.60 },
    { x: 88, y: 28, size: 18, op: 0.50 },
    { x: 8, y: 35, size: 8, op: 0.30 },
    { x: 28, y: 40, size: 13, op: 0.40 },
    { x: 50, y: 45, size: 10, op: 0.35 },
    { x: 68, y: 38, size: 15, op: 0.55 },
    { x: 82, y: 55, size: 11, op: 0.40 },
    { x: 20, y: 62, size: 12, op: 0.35 },
    { x: 42, y: 68, size: 9, op: 0.30 },
    { x: 62, y: 70, size: 14, op: 0.45 },
    { x: 78, y: 78, size: 10, op: 0.35 },
    { x: 10, y: 80, size: 16, op: 0.45 },
    { x: 35, y: 85, size: 8, op: 0.25 },
    { x: 55, y: 88, size: 12, op: 0.35 },
    { x: 90, y: 68, size: 9, op: 0.30 },
  ]

  // Hexagon path helper (flat-top, centered at cx,cy with given "size" in viewBox units)
  function hexPath(cx, cy, r) {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 180) * (60 * i - 30)
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
    })
    return `M${pts.join('L')}Z`
  }

  // DNA helix — sinusoidal backbone
  const dnaPoints1 = Array.from({ length: 30 }, (_, i) => ({
    x: 5 + i * 3.1,
    y: 72 - Math.sin(i * 0.7) * 8,
  }))
  const dnaPoints2 = Array.from({ length: 30 }, (_, i) => ({
    x: 5 + i * 3.1,
    y: 72 + Math.sin(i * 0.7) * 8,
  }))
  const dna1 = 'M' + dnaPoints1.map(p => `${p.x},${p.y}`).join(' L')
  const dna2 = 'M' + dnaPoints2.map(p => `${p.x},${p.y}`).join(' L')

  // Connector rungs
  const rungs = dnaPoints1.filter((_, i) => i % 3 === 0).map((p, i) => ({
    x1: p.x, y1: p.y,
    x2: dnaPoints2[i * 3].x, y2: dnaPoints2[i * 3].y,
  }))

  // Connection node dots
  const nodes = [
    { x: 45, y: 30 }, { x: 58, y: 22 }, { x: 72, y: 35 }, { x: 65, y: 48 },
    { x: 52, y: 55 }, { x: 40, y: 48 }, { x: 80, y: 22 }, { x: 85, y: 42 },
  ]
  const nodeLines = [
    [0,1],[1,2],[2,3],[3,4],[4,5],[0,5],[1,6],[2,7],[3,7],
  ]

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: bg,
    }}>
      {/* Soft radial glow spots */}
      <div style={{
        position: 'absolute', width: '60%', height: '60%',
        top: '5%', left: '10%',
        background: `radial-gradient(ellipse, ${glow1} 0%, transparent 70%)`,

        borderRadius: '50%',
      }}/>
      <div style={{
        position: 'absolute', width: '40%', height: '50%',
        bottom: '10%', right: '5%',
        background: `radial-gradient(ellipse, ${glow2} 0%, transparent 70%)`,

        borderRadius: '50%',
      }}/>

      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>

        {/* Hexagon grid */}
        {hexagons.map((h, i) => (
          <g key={i}>
            <path d={hexPath(h.x, h.y, h.size / 2)}
              fill="none" stroke={stroke} strokeWidth="0.4" opacity={h.op}/>
            {/* Some hexagons with subtle fill */}
            {i % 3 === 0 && (
              <path d={hexPath(h.x, h.y, h.size / 2)}
                fill={fill8} opacity={h.op * 0.8}/>
            )}
          </g>
        ))}

        {/* Node network lines */}
        {nodeLines.map(([a, b], i) => (
          <line key={i}
            x1={nodes[a].x} y1={nodes[a].y}
            x2={nodes[b].x} y2={nodes[b].y}
            stroke={nodeStroke} strokeWidth="0.3"/>
        ))}
        {/* Node dots */}
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={0.8}
            fill={nodeDot}/>
        ))}

        {/* DNA double helix */}
        <path d={dna1} fill="none" stroke={dnaStroke} strokeWidth="0.5"/>
        <path d={dna2} fill="none" stroke={dnaStroke} strokeWidth="0.5"/>
        {rungs.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
            stroke={dnaStroke} strokeWidth="0.35"/>
        ))}

        {/* Medical cross icon */}
        <g opacity="0.65" transform="translate(60,28)">
          <rect x="-3.5" y="-1.2" width="7" height="2.4" rx="0.5" fill={icon}/>
          <rect x="-1.2" y="-3.5" width="2.4" height="7" rx="0.5" fill={icon}/>
        </g>

        {/* Heart with pulse */}
        <g opacity="0.55" transform="translate(80,18)">
          <path d="M0,-1.5 C-0.8,-2.8 -3,-2.8 -3,-1 C-3,0.5 0,2.5 0,2.5 C0,2.5 3,0.5 3,-1 C3,-2.8 0.8,-2.8 0,-1.5Z"
            fill="none" stroke={icon} strokeWidth="0.4"/>
          {/* Pulse line through heart */}
          <path d="M-5,0 L-3,0 L-2,-1.5 L-1,1.5 L0,-0.5 L1,0 L5,0"
            fill="none" stroke={iconSoft} strokeWidth="0.35"/>
        </g>

        {/* Syringe icon */}
        <g opacity="0.50" transform="translate(32,58) rotate(-45)">
          <rect x="-0.8" y="-3" width="1.6" height="5" rx="0.3" fill="none" stroke={iconSoft} strokeWidth="0.35"/>
          <line x1="0" y1="2" x2="0" y2="4" stroke={iconSoft} strokeWidth="0.4"/>
          <line x1="-1.5" y1="-1" x2="-2.5" y2="-1" stroke={iconFaint} strokeWidth="0.3"/>
          <line x1="-1.5" y1="0.5" x2="-2.5" y2="0.5" stroke={iconFaint} strokeWidth="0.3"/>
        </g>

        {/* Person / doctor icon */}
        <g opacity="0.50" transform="translate(20,80)">
          <circle cx="0" cy="-3" r="1.5" fill="none" stroke={iconSoft} strokeWidth="0.4"/>
          <path d="M-2.5,0 C-2.5,-1.5 2.5,-1.5 2.5,0 L2.5,4 L-2.5,4 Z"
            fill="none" stroke={iconSoft} strokeWidth="0.4"/>
          {/* Tie */}
          <path d="M-0.6,-0.5 L0,1.5 L0.6,-0.5" fill={iconFaint} stroke="none"/>
        </g>

        {/* Flask icon */}
        <g opacity="0.45" transform="translate(50,82)">
          <path d="M-1.5,-3 L-1.5,0 L-3,3.5 L3,3.5 L1.5,0 L1.5,-3"
            fill="none" stroke={iconSoft} strokeWidth="0.4"/>
          <line x1="-1.5" y1="-3" x2="1.5" y2="-3" stroke={iconFaint} strokeWidth="0.4"/>
          <ellipse cx="0" cy="2.5" rx="1.5" ry="0.7" fill={signup ? 'rgba(120,90,220,0.25)' : 'rgba(130,200,255,0.25)'}/>
        </g>

        {/* Clipboard / medical chart */}
        <g opacity="0.45" transform="translate(48,50)">
          <rect x="-2.5" y="-4" width="5" height="6.5" rx="0.5" fill="none" stroke={iconSoft} strokeWidth="0.35"/>
          <rect x="-1" y="-4.8" width="2" height="1.2" rx="0.3" fill={iconFaint}/>
          <line x1="-1.5" y1="-1.5" x2="1.5" y2="-1.5" stroke={iconFaint} strokeWidth="0.3"/>
          <line x1="-1.5" y1="-0.2" x2="1.5" y2="-0.2" stroke={iconFaint} strokeWidth="0.3"/>
          <line x1="-1.5" y1="1.1" x2="0.5" y2="1.1" stroke={iconFaint} strokeWidth="0.3"/>
        </g>

        {/* Lock/shield icon */}
        <g opacity="0.45" transform="translate(36,38)">
          <rect x="-2" y="-1" width="4" height="3.5" rx="0.5" fill="none" stroke={iconSoft} strokeWidth="0.35"/>
          <path d="M-1.2,-1 C-1.2,-2.5 1.2,-2.5 1.2,-1" fill="none" stroke={iconSoft} strokeWidth="0.35"/>
          <circle cx="0" cy="0.8" r="0.5" fill={iconFaint}/>
        </g>

        {/* Molecule dots */}
        {[{x:62,y:58,r:1.2},{x:68,y:62,r:0.8},{x:58,y:64,r:0.9},{x:64,y:68,r:1.0}].map((d,i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r}
            fill={molFill} stroke={molStroke} strokeWidth="0.2"/>
        ))}
        <line x1="62" y1="58" x2="68" y2="62" stroke={molLine} strokeWidth="0.3"/>
        <line x1="62" y1="58" x2="58" y2="64" stroke={molLine} strokeWidth="0.3"/>
        <line x1="68" y1="62" x2="64" y2="68" stroke={molLine} strokeWidth="0.3"/>
        <line x1="58" y1="64" x2="64" y2="68" stroke={molLine} strokeWidth="0.3"/>
      </svg>

      {/* Tagline */}
      <div style={{
        position: 'absolute', bottom: 40,
        left: isLeft ? 32 : 'auto', right: isLeft ? 'auto' : 32,
        maxWidth: 200,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
          color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 6 }}>
          {isLeft ? 'Your biology,\ndecoded.' : 'Privacy-first\narchitecture.'}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', lineHeight: 1.5 }}>
          {isLeft
            ? 'Tell VITALOOP what you feel. Get smart follow-up questions and a practical lab direction plan.'
            : 'Start with symptoms or existing labs, then follow a clear health loop from concern to action.'}
        </div>
      </div>
    </div>
  )
}

// Abstract particle art panels (used for Sign Up)
function AbstractPanel({ side, variant = 'signin' }) {
  const signup = variant === 'signup'

  if (!signup) {
    return <MedicalPanel side={side} />
  }
  return <MedicalPanel side={side} signup={true} />
}

// UA hero image panel — left side for Ukrainian login
function UaHeroPanel({ isSignUp }) {
  const taglines = isSignUp
    ? {
        badge: '🇺🇦 Vitaloop Ukraine',
        title: 'Ваше здоров\'я — ваш пріоритет',
        sub: 'Завантажте аналізи або почніть із симптомів. Отримайте персональний план дій.',
        stats: [
          { n: '95+', label: 'біомаркерів' },
          { n: '110', label: 'правил аналізу' },
          { n: '100%', label: 'конфіденційно' },
        ],
      }
    : {
        badge: '🇺🇦 Vitaloop Ukraine',
        title: 'Розумійте своє здоров\'я глибше',
        sub: 'AI-аналіз аналізів крові, симптомів і персональний план дій українською.',
        stats: [
          { n: '95+', label: 'біомаркерів' },
          { n: '110', label: 'правил аналізу' },
          { n: '100%', label: 'конфіденційно' },
        ],
      }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Hero image */}
      <img
        src="/images/ua-health-hero-dashboard-ua-20260606.jpg"
        alt=""
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: '60% center',
        }}
      />
      {/* Multi-layer overlay for readability */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(10,40,30,0.72) 0%, rgba(15,118,110,0.48) 45%, rgba(10,30,50,0.65) 100%)',
      }}/>
      {/* Bottom fade for text area */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%',
        background: 'linear-gradient(to top, rgba(8,25,20,0.90) 0%, transparent 100%)',
      }}/>

      {/* Content */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '40px 40px 44px',
      }}>
        {/* Top: logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.20)',
            borderRadius: 100, padding: '8px 14px',
          }}>
            <span style={{ fontSize: 14 }}>🇺🇦</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Vitaloop Ukraine
            </span>
          </div>
        </div>

        {/* Bottom: tagline + stats */}
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(20,184,166,0.20)', backdropFilter: 'blur(6px)',
            border: '1px solid rgba(20,184,166,0.40)',
            borderRadius: 100, padding: '5px 14px', marginBottom: 20,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}/>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#a7f3d0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              AI аналіз · персональний план
            </span>
          </div>

          <h2 style={{
            margin: '0 0 12px',
            fontSize: 'clamp(22px, 2.8vw, 32px)',
            fontWeight: 900, color: '#fff',
            letterSpacing: '-0.02em', lineHeight: 1.15,
          }}>
            {taglines.title}
          </h2>
          <p style={{
            margin: '0 0 28px', fontSize: 15, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6,
            maxWidth: 340,
          }}>
            {taglines.sub}
          </p>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 20 }}>
            {taglines.stats.map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#5eead4', lineHeight: 1 }}>{s.n}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Login() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isUaAuth =
    searchParams.get('lang') === 'uk' ||
    searchParams.get('locale') === 'uk' ||
    (typeof window !== 'undefined' && window.location.hostname.toLowerCase() === 'ua.vitaloop.today')
  const copy = isUaAuth ? AUTH_COPY.uk : AUTH_COPY.en
  const siteHomePath = isUaAuth && typeof window !== 'undefined' && window.location.hostname.toLowerCase() !== 'ua.vitaloop.today'
    ? '/ua'
    : '/'
  const [email, setEmail] = useState('')
  const [showResetInfo, setShowResetInfo] = useState(false)
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(searchParams.get('signup') === 'true')
  const [isForgot, setIsForgot] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [honeypot, setHoneypot] = useState('')  // bot trap
  const [authAlert, setAuthAlert] = useState(null)
  const [rateLimitedUntil, setRateLimitedUntil] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(getViewportWidth)

  const authTheme = isSignUp
    ? {
      appBg: '#0b0618',
      centerBg: 'linear-gradient(180deg, #150930 0%, #0e0624 55%, #080312 100%)',
      borderColor: 'rgba(160,120,255,0.22)',
    }
    : {
      appBg: '#071c33',
      centerBg: 'linear-gradient(180deg, #0c2d4a 0%, #091e33 55%, #050e1a 100%)',
      borderColor: 'rgba(100,180,240,0.22)',
    }

  const rootClassName = isUaAuth ? 'ua-auth-root' : ''
  const panelClassName = isUaAuth ? 'ua-auth-center' : ''

  useEffect(() => {
    // Show info if user comes from reset password link
    if (searchParams.get('reset') === 'true') {
      setShowResetInfo(true)
    }
    let active = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active || !session?.user || !session?.access_token) {
        return
      }

      try {
        if (isGoogleAuthUser(session.user) && isRecentAccount(session.user?.created_at)) {
          await notifyRegistrationAlert('google_oauth')
          await sendWelcomeEmail()
        }

        const destination = await resolvePostLoginDestination(searchParams.get('returnUrl'))
        if (!active) return
        navigateToResolvedPath(navigate, destination)
      } catch {
        // Stay on /login when destination can't be resolved.
        // This avoids false-positive redirects for stale/incomplete sessions.
      }
    })

    return () => {
      active = false
    }
  }, [navigate, searchParams])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const ATTEMPT_KEY = 'vo:auth-attempts'
  const ATTEMPT_WINDOW_MS = 10 * 60 * 1000
  const ATTEMPT_LIMIT = 8

  function registerAttempt() {
    const now = Date.now()
    const attempts = readLocalStorageArray(ATTEMPT_KEY)
    const recent = attempts.filter((t) => Number.isFinite(t) && (now - t) < ATTEMPT_WINDOW_MS)
    recent.push(now)
    writeLocalStorageArray(ATTEMPT_KEY, recent)

    if (recent.length > ATTEMPT_LIMIT) {
      const blockUntil = now + 60 * 1000
      setRateLimitedUntil(blockUntil)
      return false
    }
    return true
  }

  async function handleResendConfirmation(emailToUse) {
    const targetEmail = String(emailToUse || '').trim()
    if (!isValidEmail(targetEmail)) {
      toast.error(copy.invalidResendEmail)
      return
    }

    setResendLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: {
          emailRedirectTo: resolveEmailConfirmationRedirect(),
        },
      })
      if (error) throw error
      toast.success(copy.confirmationResent)
      navigate(`/auth/confirmation?pending=1&email=${encodeURIComponent(targetEmail)}`, { replace: true })
    } catch (err) {
      toast.error(copy.confirmationResendError + (err?.message || 'Unknown error'))
    } finally {
      setResendLoading(false)
    }
  }

  // Validate submission form inputs
  function validateSubmission() {
    if (rateLimitedUntil > Date.now()) {
      toast.error(copy.rateLimit)
      return null
    }

    if (!registerAttempt()) {
      toast.error(copy.rateLimit)
      return null
    }

    const normalizedEmail = email.trim()
    if (!isValidEmail(normalizedEmail)) {
      toast.error(copy.invalidEmail)
      return null
    }

    if (!isForgot && !hasAnyPasswordSymbol(password)) {
      toast.error(copy.weakPassword)
      return null
    }

    return normalizedEmail
  }

  // Handle password reset flow
  async function handleResetFlow(normalizedEmail) {
    const { error } = await resetPassword(normalizedEmail)
    if (error) toast.error(error.message)
    else {
      toast.success(copy.resetLinkSent)
      setIsForgot(false)
    }
  }

  // Handle sign-up completion and navigation
  async function handleSignUpSuccess(authData, normalizedEmail) {
    gaSignUp('email')
    trackFunnelEvent('funnel_signup_completed', 'User completed signup', {
      auth_provider: 'email',
    }, { oncePerSession: true })

    const returnUrl = searchParams.get('returnUrl')

    if (authData?.session?.access_token) {
      await notifyRegistrationAlert('email_signup')
      await sendWelcomeEmail()
      import('./UserDashboard.jsx').catch(() => {})
      if (returnUrl) {
        toast.success(copy.accountCreatedRedirect)
        const destination = await resolvePostLoginDestination(returnUrl)
        navigateToResolvedPath(navigate, destination)
        return
      }

      toast.success(copy.accountCreatedOnboarding)
      navigate('/onboarding', { replace: true })
      return
    }

    toast.success(copy.accountCreatedConfirm)
    const confirmationParams = new URLSearchParams({ pending: '1', email: normalizedEmail })
    if (returnUrl) {
      confirmationParams.set('returnUrl', returnUrl)
    }
    navigate(`/auth/confirmation?${confirmationParams.toString()}`, { replace: true })
  }

  // Handle sign-in completion and navigation
  async function handleSignInSuccess() {
    try {
      gaLogin('email')
      import('./UserDashboard.jsx').catch(() => {})
      const returnUrl = searchParams.get('returnUrl')
      const destination = await resolvePostLoginDestination(returnUrl)
      navigateToResolvedPath(navigate, destination)
    } catch (err) {
      console.error('[ERROR] Exception caught in login flow:', err)
      await signOut()
      toast.error(copy.sessionFailed)
      navigate('/login', { replace: true })
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setAuthAlert(null)
    // Honeypot check - bots fill hidden fields
    if (honeypot) return

    const normalizedEmail = validateSubmission()
    if (!normalizedEmail) return

    setLoading(true)

    if (isForgot) {
      await handleResetFlow(normalizedEmail)
      setLoading(false)
      return
    }

    const returnUrl = searchParams.get('returnUrl')
    const fn = isSignUp ? signUpWithEmail : signInWithEmail
    const { data: authData, error } = await (isSignUp
      ? fn(normalizedEmail, password, { emailRedirectTo: resolveEmailConfirmationRedirect(returnUrl) })
      : fn(normalizedEmail, password))
    setLoading(false)

    if (error) {
      const mapped = mapAuthErrorMessage(error.message, copy)
      setAuthAlert(mapped)
      toast.error(mapped.text)
      return
    }

    if (isSignUp) {
      await handleSignUpSuccess(authData, normalizedEmail)
    } else {
      await handleSignInSuccess()
    }
  }

  return (
    <>
      {isUaAuth && (
        <style>{`
          .ua-auth-root {
            position: relative;
            overflow: hidden;
            background:
              radial-gradient(circle at 18% 14%, rgba(20,184,166,0.16), transparent 34%),
              radial-gradient(circle at 88% 6%, rgba(212,180,131,0.18), transparent 30%),
              linear-gradient(180deg, #fbfaf7 0%, #f8f5f0 54%, #efebe5 100%) !important;
            color: #0f172a;
          }
          .ua-auth-root::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background-image:
              linear-gradient(rgba(15,118,110,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(15,118,110,0.06) 1px, transparent 1px);
            background-size: 44px 44px;
            mask-image: linear-gradient(180deg, rgba(0,0,0,0.7), transparent 72%);
          }
          /* ── UA auth card ── */
          .ua-auth-center {
            max-width: 460px !important;
            margin: 0 !important;
            justify-content: center !important;
            background: #ffffff !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            border-left: 1px solid #e5dfd6 !important;
          }

          /* Text overrides — light theme */
          .ua-auth-center h1 { color: #0f172a !important; }
          .ua-auth-center p  { color: #475569 !important; }
          .ua-auth-center label { color: #0f766e !important; font-size: 11px !important; }

          /* Back-to-site button */
          .ua-auth-center > button:first-of-type {
            color: #64748b !important;
          }

          /* Input fields */
          .ua-auth-center input[type="email"],
          .ua-auth-center input[type="password"],
          .ua-auth-center input[type="text"] {
            background: #f8fafc !important;
            border: 1.5px solid #e2e8f0 !important;
            color: #0f172a !important;
            border-radius: 14px !important;
            box-shadow: none !important;
          }
          .ua-auth-center input::placeholder { color: #94a3b8 !important; }
          .ua-auth-center input:focus {
            border-color: #0d9488 !important;
            outline: none !important;
            box-shadow: 0 0 0 3px rgba(13,148,136,0.10) !important;
          }

          /* Eye toggle in password */
          .ua-auth-center form div > button[type="button"] {
            color: #94a3b8 !important;
          }

          /* Forgot password link */
          .ua-auth-center form button[type="button"] {
            color: #0f766e !important;
          }

          /* Submit button */
          .ua-auth-center button[type="submit"] {
            border-radius: 14px !important;
            background: linear-gradient(135deg, #0f766e 0%, #14b8a6 60%, #d4b483 140%) !important;
            box-shadow: 0 10px 30px rgba(15,118,110,0.28) !important;
            font-weight: 700 !important;
            font-size: 16px !important;
            padding: 15px !important;
          }

          /* Divider */
          .ua-auth-center .ua-divider-line { background: #e2e8f0 !important; }
          .ua-auth-center .ua-divider-text { color: #94a3b8 !important; }

          /* Google button */
          .ua-auth-center .ua-google-btn {
            background: #fff !important;
            border: 1.5px solid #e2e8f0 !important;
            color: #0f172a !important;
            border-radius: 14px !important;
          }
          .ua-auth-center .ua-google-btn:hover {
            border-color: #cbd5e1 !important;
            background: #f8fafc !important;
          }

          /* Toggle sign-in/up text */
          .ua-auth-center .ua-toggle-text { color: #64748b !important; }
          .ua-auth-center .ua-toggle-btn  { color: #0f766e !important; font-weight: 700 !important; }

          /* Security note */
          .ua-auth-center .ua-security-box {
            background: #f8f5f0 !important;
            border: 1px solid #e5dfd6 !important;
            border-radius: 16px !important;
          }
          .ua-auth-center .ua-security-title { color: #0f766e !important; }
          .ua-auth-center .ua-security-body  { color: #64748b !important; }

          /* Auth alert */
          .ua-auth-center .ua-alert {
            background: #fff1f2 !important;
            border: 1px solid #fecdd3 !important;
            color: #be123c !important;
            border-radius: 12px !important;
          }

          /* UA badge */
          .ua-auth-badge {
            display: inline-flex; align-items: center; gap: 8px;
            border: 1px solid #e5dfd6;
            background: #f0fdfa;
            border-radius: 999px; padding: 7px 14px;
            color: #0f766e; font-size: 11px; font-weight: 900;
            letter-spacing: 0.12em; text-transform: uppercase;
          }
        `}</style>
      )}
      <Seo
        title={copy.seoTitle}
        description={copy.seoDescription}
        path="/login"
        locale={isUaAuth ? 'uk_UA' : 'en_US'}
        noindex
      />
      <div className={rootClassName} style={{
        minHeight: '100svh', display: 'flex',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Premium Display", sans-serif',
        background: authTheme.appBg,
      }}>
        {/* Left panel: hero image for UA, abstract for EN */}
        {isUaAuth ? (
          <div className="hidden lg:block" style={{ flex: 1, position: 'relative', minHeight: '100svh' }}>
            <UaHeroPanel isSignUp={isSignUp} />
          </div>
        ) : (
          <div className="hidden lg:block" style={{ flex: 1, position: 'relative' }}>
            <AbstractPanel side="left" variant={isSignUp ? 'signup' : 'signin'} />
          </div>
        )}

        {/* Center form */}
        <div className={panelClassName} style={{
          width: '100%', maxWidth: 440,
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center',
          padding: viewportWidth < 600 ? '32px 16px' : '48px 40px',
          background: authTheme.centerBg, position: 'relative', zIndex: 1,
          borderLeft: `0.5px solid ${authTheme.borderColor}`,
          borderRight: `0.5px solid ${authTheme.borderColor}`,
          '@media (max-width: 600px)': {
            padding: '32px 16px',
          }
        }}>

          {/* Back to site */}
          <button
            onClick={() => navigate(siteHomePath)}
            style={{
              position: 'absolute', top: 24, left: 24,
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13,
              color: isUaAuth ? '#64748b' : 'rgba(255,255,255,0.4)',
              transition: 'color 200ms',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = isUaAuth ? '#0f172a' : 'rgba(255,255,255,0.8)'}
            onMouseLeave={(e) => e.currentTarget.style.color = isUaAuth ? '#64748b' : 'rgba(255,255,255,0.4)'}
          >
            <ArrowLeft size={14}/> {copy.backToSite}
          </button>

          {/* Logo */}
          <div style={{ marginBottom: 40, marginTop: 8 }}>
            {isUaAuth && (
              <div className="ua-auth-badge" style={{ marginBottom: 18 }}>
                <span aria-hidden="true">🇺🇦</span>
                Vitaloop Ukraine
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" fill="var(--teal-500,#1D9E75)"/>
                <path d="M4 14h4l2-6 4 12 2-7 2 4h6" stroke="white"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              <span style={{ fontSize: 16, fontWeight: 700, color: isUaAuth ? '#0f172a' : 'white', letterSpacing: '-0.01em' }}>
                VITALOOP
              </span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: isUaAuth ? '#0f172a' : 'white', margin: '16px 0 4px', letterSpacing: '-0.02em' }}>
              {isForgot ? copy.resetTitle : isSignUp ? copy.signupTitle : copy.signinTitle}
            </h1>
            <p style={{ fontSize: 14, color: isUaAuth ? '#64748b' : 'rgba(255,255,255,0.4)', margin: 0 }}>
              {isForgot
                ? copy.resetSubtitle
                : isSignUp
                  ? copy.signupSubtitle
                  : copy.signinSubtitle}
            </p>
          </div>

          {showResetInfo && (
            <div style={{
              background: 'rgba(16,185,129,0.10)',
              border: '1px solid #10b981',
              color: '#166534',
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 14,
              marginBottom: 16,
            }}>
              {copy.resetSuccess}
            </div>
          )}
          <form
            onSubmit={handleSubmit}
            data-testid="auth-form"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            {/* Google reCAPTCHA (only for sign up) — удалено */}

            {authAlert && (
              <div className="ua-alert" data-testid="auth-alert" style={{
                background: 'rgba(255,99,71,0.12)',
                border: '0.5px solid rgba(255,99,71,0.35)',
                borderRadius: 12,
                padding: '12px 14px',
                color: 'rgba(255,255,255,0.9)',
                fontSize: 13,
                lineHeight: 1.45,
              }}>
                <div>{authAlert.text}</div>
                {authAlert.canResendConfirmation && (
                  <button
                    type="button"
                    disabled={resendLoading}
                    onClick={() => handleResendConfirmation(email)}
                    style={{
                      marginTop: 10,
                      background: 'rgba(29,158,117,0.15)',
                      border: '0.5px solid rgba(29,158,117,0.45)',
                      color: '#5DCAA5',
                      borderRadius: 10,
                      padding: '8px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: resendLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {resendLoading ? copy.resendLoading : copy.resendConfirmation}
                  </button>
                )}
              </div>
            )}

            {/* Honeypot - invisible to users, visible to bots */}
            <input
              type="text"
              name="company"
              data-testid="auth-honeypot"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            {/* Email */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                {copy.emailLabel}
              </label>
              <input
                type="email"
                required
                name="email"
                data-testid="auth-email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)',
                  border: '0.5px solid rgba(255,255,255,0.12)',
                  borderRadius: 12, padding: '13px 16px',
                  color: 'white', fontSize: 16,
                  outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 200ms',
                }}
                onFocus={(e) => e.target.style.borderColor = '#1D9E75'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>

            {/* Password */}
            {!isForgot && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                  letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                  {copy.passwordLabel}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={8}
                    name="password"
                    data-testid="auth-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.05)',
                      border: '0.5px solid rgba(255,255,255,0.12)',
                      borderRadius: 12, padding: '13px 44px 13px 16px',
                      color: 'white', fontSize: 16,
                      outline: 'none', boxSizing: 'border-box',
                      transition: 'border-color 200ms',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#1D9E75'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    style={{
                      position: 'absolute', right: 12, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.3)',
                    }}
                  >
                    {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
                {/* Forgot link */}
                {!isSignUp && (
                  <div style={{ textAlign: 'right', marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={() => setIsForgot(true)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 12, color: '#1D9E75',
                      }}
                    >
                      {copy.forgotPassword}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              data-testid="auth-submit"
              disabled={loading}
              style={{
                width: '100%', background: loading ? '#085041' : '#1D9E75',
                color: 'white', border: 'none', borderRadius: 12,
                padding: '14px', fontSize: 16, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 200ms, transform 200ms',
                marginTop: 4,
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#0F6E56' }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#1D9E75' }}
            >
              {loading ? copy.loading
                : isForgot ? copy.sendReset
                  : isSignUp ? copy.createAccount
                    : copy.signIn}
            </button>
          </form>

          {/* Divider */}
          {!isForgot && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0',
              }}>
                <div className="ua-divider-line" style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.08)' }}/>
                <span className="ua-divider-text" style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>{copy.or}</span>
                <div className="ua-divider-line" style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.08)' }}/>
              </div>

              {/* Google */}
              <button
                className="ua-google-btn"
                onClick={() => { gaLogin('google'); signInWithGoogle() }}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)',
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, padding: '13px', fontSize: 15,
                  color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  transition: 'background 200ms, border-color 200ms',
                  marginBottom: 10,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {copy.continueGoogle}
              </button>

              {/* Apple ID button hidden until provider is enabled */}
            </>
          )}

          {/* Toggle sign in / sign up */}
          <p className="ua-toggle-text" style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            {isForgot ? (
              <button onClick={() => setIsForgot(false)}
                className="ua-toggle-btn"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1D9E75', fontSize: 13 }}>
                {copy.backToSignIn}
              </button>
            ) : (
              <>
                {isSignUp ? copy.alreadyHave : copy.noAccount}
                <button onClick={() => setIsSignUp((v) => !v)}
                  className="ua-toggle-btn"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1D9E75', fontSize: 13 }}>
                  {isSignUp ? copy.signIn : copy.signUpFree}
                </button>
              </>
            )}
          </p>

          {/* Security note */}
          <div className="ua-security-box" style={{
            marginTop: 32, padding: '14px 16px',
            background: 'rgba(255,255,255,0.02)',
            border: '0.5px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
          }}>
            <div className="ua-security-title" style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              {copy.securityTitle}
            </div>
            <p className="ua-security-body" style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6, margin: 0 }}>
              {copy.securityBody}
            </p>
          </div>
        </div>

        {/* Right abstract panel — hidden for UA (hero is on the left) */}
        {!isUaAuth && (
          <div className="hidden lg:block" style={{ flex: 1, position: 'relative' }}>
            <AbstractPanel side="right" variant={isSignUp ? 'signup' : 'signin'} />
          </div>
        )}
      </div>
    </>
  )
}
