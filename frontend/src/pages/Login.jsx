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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value) {
  return EMAIL_RE.test(String(value || '').trim())
}

function hasAnyPasswordSymbol(value) {
  return String(value || '').trim().length >= 1
}

function resolveEmailConfirmationRedirect() {
  const configured = import.meta.env.VITE_EMAIL_CONFIRMATION_PATH
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured
  }
  return `${window.location.origin}/auth/confirmation`
}

function mapAuthErrorMessage(message) {
  const raw = String(message || '')
  const normalized = raw.toLowerCase()

  if (normalized.includes('email not confirmed') || normalized.includes('email_not_confirmed')) {
    return {
      text: 'Email не подтвержден. Подтвердите email по ссылке из письма или отправьте письмо повторно.',
      canResendConfirmation: true,
    }
  }

  if (normalized.includes('invalid login credentials')) {
    return {
      text: 'Неверный email или пароль. Проверьте данные и попробуйте снова.',
      canResendConfirmation: false,
    }
  }

  if (normalized.includes('too many requests')) {
    return {
      text: 'Слишком много попыток входа. Подождите минуту и повторите.',
      canResendConfirmation: false,
    }
  }

  return {
    text: raw || 'Не удалось выполнить вход. Попробуйте еще раз.',
    canResendConfirmation: false,
  }
}

// Medical hexagon panel for Sign In
function MedicalPanel({ side }) {
  const isLeft = side === 'left'

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
      background: 'linear-gradient(135deg, #0a2540 0%, #0e3d6b 30%, #0c5a82 55%, #0d8a8a 80%, #b8d8e8 100%)',
    }}>
      {/* Soft radial glow spots */}
      <div style={{
        position: 'absolute', width: '60%', height: '60%',
        top: '5%', left: '10%',
        background: 'radial-gradient(ellipse, rgba(120,200,255,0.18) 0%, transparent 70%)',
        borderRadius: '50%',
      }}/>
      <div style={{
        position: 'absolute', width: '40%', height: '50%',
        bottom: '10%', right: '5%',
        background: 'radial-gradient(ellipse, rgba(180,230,255,0.12) 0%, transparent 70%)',
        borderRadius: '50%',
      }}/>

      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>

        {/* Hexagon grid */}
        {hexagons.map((h, i) => (
          <g key={i}>
            <path d={hexPath(h.x, h.y, h.size / 2)}
              fill="none" stroke="rgba(160,220,255,0.6)" strokeWidth="0.4" opacity={h.op}/>
            {/* Some hexagons with subtle fill */}
            {i % 3 === 0 && (
              <path d={hexPath(h.x, h.y, h.size / 2)}
                fill="rgba(100,180,240,0.08)" opacity={h.op * 0.8}/>
            )}
          </g>
        ))}

        {/* Node network lines */}
        {nodeLines.map(([a, b], i) => (
          <line key={i}
            x1={nodes[a].x} y1={nodes[a].y}
            x2={nodes[b].x} y2={nodes[b].y}
            stroke="rgba(160,220,255,0.45)" strokeWidth="0.3"/>
        ))}
        {/* Node dots */}
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={0.8}
            fill="rgba(200,235,255,0.8)"/>
        ))}

        {/* DNA double helix */}
        <path d={dna1} fill="none" stroke="rgba(160,220,255,0.5)" strokeWidth="0.5"/>
        <path d={dna2} fill="none" stroke="rgba(160,220,255,0.5)" strokeWidth="0.5"/>
        {rungs.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
            stroke="rgba(180,230,255,0.35)" strokeWidth="0.35"/>
        ))}

        {/* Medical cross icon */}
        <g opacity="0.65" transform="translate(60,28)">
          <rect x="-3.5" y="-1.2" width="7" height="2.4" rx="0.5" fill="rgba(200,235,255,0.7)"/>
          <rect x="-1.2" y="-3.5" width="2.4" height="7" rx="0.5" fill="rgba(200,235,255,0.7)"/>
        </g>

        {/* Heart with pulse */}
        <g opacity="0.55" transform="translate(80,18)">
          <path d="M0,-1.5 C-0.8,-2.8 -3,-2.8 -3,-1 C-3,0.5 0,2.5 0,2.5 C0,2.5 3,0.5 3,-1 C3,-2.8 0.8,-2.8 0,-1.5Z"
            fill="none" stroke="rgba(200,235,255,0.7)" strokeWidth="0.4"/>
          {/* Pulse line through heart */}
          <path d="M-5,0 L-3,0 L-2,-1.5 L-1,1.5 L0,-0.5 L1,0 L5,0"
            fill="none" stroke="rgba(200,235,255,0.6)" strokeWidth="0.35"/>
        </g>

        {/* Syringe icon */}
        <g opacity="0.50" transform="translate(32,58) rotate(-45)">
          <rect x="-0.8" y="-3" width="1.6" height="5" rx="0.3" fill="none" stroke="rgba(200,235,255,0.6)" strokeWidth="0.35"/>
          <line x1="0" y1="2" x2="0" y2="4" stroke="rgba(200,235,255,0.6)" strokeWidth="0.4"/>
          <line x1="-1.5" y1="-1" x2="-2.5" y2="-1" stroke="rgba(200,235,255,0.5)" strokeWidth="0.3"/>
          <line x1="-1.5" y1="0.5" x2="-2.5" y2="0.5" stroke="rgba(200,235,255,0.5)" strokeWidth="0.3"/>
        </g>

        {/* Person / doctor icon */}
        <g opacity="0.50" transform="translate(20,80)">
          <circle cx="0" cy="-3" r="1.5" fill="none" stroke="rgba(200,235,255,0.6)" strokeWidth="0.4"/>
          <path d="M-2.5,0 C-2.5,-1.5 2.5,-1.5 2.5,0 L2.5,4 L-2.5,4 Z"
            fill="none" stroke="rgba(200,235,255,0.6)" strokeWidth="0.4"/>
          {/* Tie */}
          <path d="M-0.6,-0.5 L0,1.5 L0.6,-0.5" fill="rgba(200,235,255,0.4)" stroke="none"/>
        </g>

        {/* Flask icon */}
        <g opacity="0.45" transform="translate(50,82)">
          <path d="M-1.5,-3 L-1.5,0 L-3,3.5 L3,3.5 L1.5,0 L1.5,-3"
            fill="none" stroke="rgba(200,235,255,0.6)" strokeWidth="0.4"/>
          <line x1="-1.5" y1="-3" x2="1.5" y2="-3" stroke="rgba(200,235,255,0.5)" strokeWidth="0.4"/>
          <ellipse cx="0" cy="2.5" rx="1.5" ry="0.7" fill="rgba(130,200,255,0.25)"/>
        </g>

        {/* Clipboard / medical chart */}
        <g opacity="0.45" transform="translate(48,50)">
          <rect x="-2.5" y="-4" width="5" height="6.5" rx="0.5" fill="none" stroke="rgba(200,235,255,0.6)" strokeWidth="0.35"/>
          <rect x="-1" y="-4.8" width="2" height="1.2" rx="0.3" fill="rgba(200,235,255,0.5)"/>
          <line x1="-1.5" y1="-1.5" x2="1.5" y2="-1.5" stroke="rgba(200,235,255,0.45)" strokeWidth="0.3"/>
          <line x1="-1.5" y1="-0.2" x2="1.5" y2="-0.2" stroke="rgba(200,235,255,0.45)" strokeWidth="0.3"/>
          <line x1="-1.5" y1="1.1" x2="0.5" y2="1.1" stroke="rgba(200,235,255,0.45)" strokeWidth="0.3"/>
        </g>

        {/* Lock/shield icon */}
        <g opacity="0.45" transform="translate(36,38)">
          <rect x="-2" y="-1" width="4" height="3.5" rx="0.5" fill="none" stroke="rgba(200,235,255,0.6)" strokeWidth="0.35"/>
          <path d="M-1.2,-1 C-1.2,-2.5 1.2,-2.5 1.2,-1" fill="none" stroke="rgba(200,235,255,0.6)" strokeWidth="0.35"/>
          <circle cx="0" cy="0.8" r="0.5" fill="rgba(200,235,255,0.5)"/>
        </g>

        {/* Molecule dots */}
        {[{x:62,y:58,r:1.2},{x:68,y:62,r:0.8},{x:58,y:64,r:0.9},{x:64,y:68,r:1.0}].map((d,i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r}
            fill="rgba(200,235,255,0.4)" stroke="rgba(160,220,255,0.5)" strokeWidth="0.2"/>
        ))}
        <line x1="62" y1="58" x2="68" y2="62" stroke="rgba(160,220,255,0.35)" strokeWidth="0.3"/>
        <line x1="62" y1="58" x2="58" y2="64" stroke="rgba(160,220,255,0.35)" strokeWidth="0.3"/>
        <line x1="68" y1="62" x2="64" y2="68" stroke="rgba(160,220,255,0.35)" strokeWidth="0.3"/>
        <line x1="58" y1="64" x2="64" y2="68" stroke="rgba(160,220,255,0.35)" strokeWidth="0.3"/>
      </svg>

      {/* Tagline */}
      <div style={{
        position: 'absolute', bottom: 40,
        left: isLeft ? 32 : 'auto', right: isLeft ? 'auto' : 32,
        maxWidth: 200,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
          color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 6 }}>
          {isLeft ? 'Your biology,\ndecoded.' : 'HIPAA-ready\narchitecture.'}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', lineHeight: 1.5 }}>
          {isLeft
            ? 'Upload any lab result — AI extracts every biomarker in 60 seconds.'
            : 'Your PDF never leaves your device. OCR runs 100% client-side.'}
        </div>
      </div>
    </div>
  )
}

// Abstract particle art panels (used for Sign Up)
function AbstractPanel({ side, variant = 'signin' }) {
  const isLeft = side === 'left'
  const signup = variant === 'signup'

  if (!signup) {
    return <MedicalPanel side={side} />
  }

  const baseColor = isLeft ? '#1e3a8a' : '#1e40af'
  const accent = isLeft ? '#60a5fa' : '#93c5fd'
  const gradient = `linear-gradient(${isLeft ? '135deg' : '225deg'}, #0b173f 0%, #1e3a8a 45%, #020617 100%)`

  // Deterministic particles based on side
  const particles = Array.from({ length: 60 }, (_, i) => ({
    x: isLeft
      ? 20 + ((i * 137.5) % 80)
      : 5 + ((i * 97.3) % 88),
    y: 2 + ((i * 73.1) % 96),
    r: 0.8 + (i % 5) * 0.9,
    op: 0.15 + (i % 7) * 0.08,
  }))

  const lines = Array.from({ length: 18 }, (_, i) => ({
    x1: (i * 31) % 100,
    y1: (i * 17) % 100,
    x2: ((i * 31 + 40) % 100),
    y2: ((i * 17 + 30) % 100),
    op: 0.04 + (i % 4) * 0.03,
  }))

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: gradient,
      overflow: 'hidden',
    }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {/* Connection lines */}
        {lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke={accent} strokeWidth="0.15" opacity={l.op}/>
        ))}
        {/* Particles */}
        {particles.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r}
            fill={i % 3 === 0 ? accent : baseColor} opacity={p.op}/>
        ))}
        {/* Large decorative rings */}
        <circle cx={isLeft ? 20 : 80} cy="50" r="35"
          fill="none" stroke={baseColor} strokeWidth="0.3" opacity="0.15"/>
        <circle cx={isLeft ? 20 : 80} cy="50" r="22"
          fill="none" stroke={accent} strokeWidth="0.2" opacity="0.1"/>
        <circle cx={isLeft ? 80 : 20} cy="20" r="18"
          fill="none" stroke={accent} strokeWidth="0.2" opacity="0.08"/>
        {/* ECG-like line */}
        <path d={isLeft
          ? 'M0,50 L15,50 L20,35 L25,65 L30,42 L35,50 L100,50'
          : 'M0,50 L65,50 L70,35 L75,65 L80,42 L85,50 L100,50'}
        fill="none" stroke={accent} strokeWidth="0.4" opacity="0.25"/>
      </svg>

      {/* Tagline overlay */}
      <div style={{
        position: 'absolute', bottom: 40,
        left: isLeft ? 32 : 'auto', right: isLeft ? 'auto' : 32,
        maxWidth: 200,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
          color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: 6,
        }}>
          {signup
            ? (isLeft ? 'Create your\nhealth baseline.' : 'Secure\nmember onboarding.')
            : (isLeft ? 'Your biology,\ndecoded.' : 'HIPAA-ready\narchitecture.')}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', lineHeight: 1.5 }}>
          {signup
            ? (isLeft
              ? 'Set up your profile and unlock a personalized health cabinet.'
              : 'Protected onboarding flow with verified session and secure storage.')
            : (isLeft
              ? 'Upload any lab result - AI extracts every biomarker in 60 seconds.'
              : 'Your PDF never leaves your device. OCR runs 100% client-side.')}
        </div>
      </div>
    </div>
  )
}

export default function Login() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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

  const authTheme = isSignUp
    ? {
      appBg: '#08102e',
      centerBg: 'linear-gradient(180deg, #0f1f52 0%, #0b173f 60%, #080e2a 100%)',
      borderColor: 'rgba(96,165,250,0.22)',
    }
    : {
      appBg: '#071c33',
      centerBg: 'linear-gradient(180deg, #0c2d4a 0%, #091e33 55%, #050e1a 100%)',
      borderColor: 'rgba(100,180,240,0.22)',
    }

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

  const ATTEMPT_KEY = 'vo:auth-attempts'
  const ATTEMPT_WINDOW_MS = 10 * 60 * 1000
  const ATTEMPT_LIMIT = 8

  function registerAttempt() {
    const now = Date.now()
    let attempts = []
    try {
      attempts = JSON.parse(window.localStorage.getItem(ATTEMPT_KEY) || '[]')
    } catch {
      attempts = []
    }
    const recent = attempts.filter((t) => Number.isFinite(t) && (now - t) < ATTEMPT_WINDOW_MS)
    recent.push(now)
    window.localStorage.setItem(ATTEMPT_KEY, JSON.stringify(recent))

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
      toast.error('Введите корректный email для повторной отправки.')
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
      toast.success('Письмо подтверждения отправлено повторно. Проверьте почту.')
      navigate(`/auth/confirmation?pending=1&email=${encodeURIComponent(targetEmail)}`, { replace: true })
    } catch (err) {
      toast.error('Не удалось отправить письмо: ' + (err?.message || 'Unknown error'))
    } finally {
      setResendLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setAuthAlert(null)
    // Honeypot check - bots fill hidden fields
    if (honeypot) return

    // reCAPTCHA check (only for sign up) — удалено

    const now = Date.now()
    if (rateLimitedUntil > now) {
      toast.error('Too many attempts. Please wait 1 minute and try again.')
      return
    }

    if (!registerAttempt()) {
      toast.error('Too many attempts. Please wait 1 minute and try again.')
      return
    }

    const normalizedEmail = email.trim()
    if (!isValidEmail(normalizedEmail)) {
      toast.error('Введите корректный email.')
      return
    }

    if (!isForgot && !hasAnyPasswordSymbol(password)) {
      toast.error('Пароль должен содержать минимум 1 символ.')
      return
    }

    setLoading(true)

    if (isForgot) {
      const { error } = await resetPassword(normalizedEmail)
      setLoading(false)
      if (error) toast.error(error.message)
      else { toast.success('Reset link sent - check your email'); setIsForgot(false) }
      return
    }

    const fn = isSignUp ? signUpWithEmail : signInWithEmail
    const { data: authData, error } = await fn(normalizedEmail, password)
    setLoading(false)
    if (error) {
      const mapped = mapAuthErrorMessage(error.message)
      setAuthAlert(mapped)
      toast.error(mapped.text)
      return
    }

    if (isSignUp) {
      gaSignUp('email')
      trackFunnelEvent('funnel_signup_completed', 'User completed signup', {
        auth_provider: 'email',
      }, { oncePerSession: true })

      if (authData?.session?.access_token) {
        await notifyRegistrationAlert('email_signup')
        await sendWelcomeEmail()
        import('./UserDashboard.jsx').catch(() => {})
        toast.success('Account created. Continue with onboarding.')
        navigate('/onboarding', { replace: true })
        return
      }

      toast.success('Account created. Confirm your email to continue.')
      navigate(`/auth/confirmation?pending=1&email=${encodeURIComponent(normalizedEmail)}`, { replace: true })
      return
    }

    try {
      gaLogin('email')
      import('./UserDashboard.jsx').catch(() => {})
      const returnUrl = searchParams.get('returnUrl')
      const { data: sessionData } = await supabase.auth.getSession()
      const destination = await resolvePostLoginDestination(returnUrl)
      navigateToResolvedPath(navigate, destination)
    } catch (err) {
      console.error('[ERROR] Exception caught in login flow:', err)
      await signOut()
      toast.error('Session validation failed. Please sign in again.')
      navigate('/login', { replace: true })
    }
  }

  return (
    <div style={{
      minHeight: '100svh', display: 'flex',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Premium Display", sans-serif',
      background: authTheme.appBg,
    }}>
      {/* Left abstract panel - hidden on mobile */}
      <div className="hidden lg:block" style={{ flex: 1, position: 'relative' }}>
        <AbstractPanel side="left" variant={isSignUp ? 'signup' : 'signin'} />
      </div>

      {/* Center form */}
      <div style={{
        width: '100%', maxWidth: 440,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center',
        padding: window.innerWidth < 600 ? '32px 16px' : '48px 40px',
        background: authTheme.centerBg, position: 'relative', zIndex: 1,
        borderLeft: `0.5px solid ${authTheme.borderColor}`,
        borderRight: `0.5px solid ${authTheme.borderColor}`,
        '@media (max-width: 600px)': {
          padding: '32px 16px',
        }
      }}>

        {/* Back to site */}
        <button
          onClick={() => navigate('/')}
          style={{
            position: 'absolute', top: 24, left: 24,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: 'rgba(255,255,255,0.4)',
            transition: 'color 200ms',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
        >
          <ArrowLeft size={14}/> Back to site
        </button>

        {/* Logo */}
        <div style={{ marginBottom: 40, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" fill="var(--teal-500,#1D9E75)"/>
              <path d="M4 14h4l2-6 4 12 2-7 2 4h6" stroke="white"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>
              VITALOOP
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white', margin: '16px 0 4px' }}>
            {isForgot ? 'Reset password' : isSignUp ? 'Create account' : 'Welcome back'}
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            {isForgot
              ? 'Enter your email to receive a reset link.'
              : isSignUp
                ? 'Start your health optimization journey.'
                : 'Sign in to your VITALOOP account.'}
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
            Пароль успешно сброшен. Войдите с новым паролем.
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Google reCAPTCHA (only for sign up) — удалено */}

          {authAlert && (
            <div style={{
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
                  {resendLoading ? 'Sending…' : 'Resend confirmation email'}
                </button>
              )}
            </div>
          )}

          {/* Honeypot - invisible to users, visible to bots */}
          <input
            type="text"
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
              EMAIL
            </label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)',
                border: '0.5px solid rgba(255,255,255,0.12)',
                borderRadius: 12, padding: '13px 16px',
                color: 'white', fontSize: 15,
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
                PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={1}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.05)',
                    border: '0.5px solid rgba(255,255,255,0.12)',
                    borderRadius: 12, padding: '13px 44px 13px 16px',
                    color: 'white', fontSize: 15,
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
                    Forgot password?
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
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
            {loading ? 'Loading…'
              : isForgot ? 'Send reset link'
                : isSignUp ? 'Create account'
                  : 'Sign in'}
          </button>
        </form>

        {/* Divider */}
        {!isForgot && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0',
            }}>
              <div style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.08)' }}/>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>or</span>
              <div style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.08)' }}/>
            </div>

            {/* Google */}
            <button
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
              Continue with Google
            </button>

            {/* Apple ID button hidden until provider is enabled */}
          </>
        )}

        {/* Toggle sign in / sign up */}
        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          {isForgot ? (
            <button onClick={() => setIsForgot(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1D9E75', fontSize: 13 }}>
              ← Back to sign in
            </button>
          ) : (
            <>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <button onClick={() => setIsSignUp((v) => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1D9E75', fontSize: 13 }}>
                {isSignUp ? 'Sign in' : 'Sign up free'}
              </button>
            </>
          )}
        </p>

        {/* Security note */}
        <div style={{
          marginTop: 32, padding: '14px 16px',
          background: 'rgba(255,255,255,0.02)',
          border: '0.5px solid rgba(255,255,255,0.06)',
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Your data security
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6, margin: 0 }}>
            Your lab PDFs are processed entirely in your browser - never uploaded to our servers.
            All stored data is encrypted at rest in SOC2-compliant infrastructure.
            Row-level security ensures only you can access your records.
          </p>
        </div>
      </div>

      {/* Right abstract panel - hidden on mobile */}
      <div className="hidden lg:block" style={{ flex: 1, position: 'relative' }}>
        <AbstractPanel side="right" variant={isSignUp ? 'signup' : 'signin'} />
      </div>
    </div>
  )
}
