import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { supabase } from '../lib/supabase.js'
import { navigateToResolvedPath, resolvePostLoginDestination } from '../auth/postLogin.js'
import { notifyRegistrationAlert } from '../auth/registrationAlert.js'
import { trackFunnelEvent } from '../lib/funnel.js'
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

// Abstract particle art panels
function AbstractPanel({ side }) {
  const isLeft = side === 'left'
  const baseColor = isLeft ? '#1D9E75' : '#085041'
  const accent = isLeft ? '#5DCAA5' : '#1D9E75'

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
      background: `linear-gradient(${isLeft ? '135deg' : '225deg'}, #04342C 0%, #085041 40%, #0a0a0a 100%)`,
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
          {isLeft ? 'Your biology,\ndecoded.' : 'HIPAA-ready\narchitecture.'}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)', lineHeight: 1.5 }}>
          {isLeft
            ? 'Upload any lab result - AI extracts every biomarker in 60 seconds.'
            : 'Your PDF never leaves your device. OCR runs 100% client-side.'}
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
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(searchParams.get('signup') === 'true')
  const [isForgot, setIsForgot] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [honeypot, setHoneypot] = useState('')  // bot trap
  const [authAlert, setAuthAlert] = useState(null)
  const [rateLimitedUntil, setRateLimitedUntil] = useState(0)

  useEffect(() => {
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
    console.log('[STEP 0] Form submission started')
    setAuthAlert(null)
    // Honeypot check - bots fill hidden fields
    if (honeypot) return

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
    console.log('[STEP 0B] Calling', isSignUp ? 'signUpWithEmail' : 'signInWithEmail')
    const { data: authData, error } = await fn(normalizedEmail, password)
    setLoading(false)
    console.log('[STEP 0C] Auth response received:', { hasError: !!error, errorMsg: error?.message })
    if (error) {
      const mapped = mapAuthErrorMessage(error.message)
      setAuthAlert(mapped)
      toast.error(mapped.text)
      return
    }

    if (isSignUp) {
      trackFunnelEvent('funnel_signup_completed', 'User completed signup', {
        auth_provider: 'email',
      }, { oncePerSession: true })

      if (authData?.session?.access_token) {
        await notifyRegistrationAlert('email_signup')
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
      console.log('[STEP 1] Login successful, preparing CRM handoff')
      import('./UserDashboard.jsx').catch(() => {})
      const returnUrl = searchParams.get('returnUrl')
      console.log('[STEP 1B] Return URL from search params:', returnUrl)
      
      console.log('[STEP 2] Getting Supabase session')
      const { data: sessionData } = await supabase.auth.getSession()
      console.log('[STEP 2B] Session received:', { hasSession: !!sessionData?.session, hasToken: !!sessionData?.session?.access_token })
      
      console.log('[STEP 2C] Calling resolvePostLoginDestination')
      const destination = await resolvePostLoginDestination(returnUrl)
      console.log('[STEP 2D] resolvePostLoginDestination returned:', { url: destination?.url, method: destination?.method })
      
      console.log('[STEP 2E] Calling navigateToResolvedPath')
      navigateToResolvedPath(navigate, destination)
      console.log('[STEP 2F] navigateToResolvedPath completed - user should be redirected to CRM')
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
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      background: '#050e09',
    }}>
      {/* Left abstract panel - hidden on mobile */}
      <div className="hidden lg:block" style={{ flex: 1, position: 'relative' }}>
        <AbstractPanel side="left"/>
      </div>

      {/* Center form */}
      <div style={{
        width: '100%', maxWidth: 440,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '48px 40px',
        background: '#0a0a0a', position: 'relative', zIndex: 1,
        borderLeft: '0.5px solid rgba(255,255,255,0.05)',
        borderRight: '0.5px solid rgba(255,255,255,0.05)',
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

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
              onClick={signInWithGoogle}
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

            {/* Apple ID placeholder */}
            <button
              onClick={() => toast('Apple ID coming soon')}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                borderRadius: 12, padding: '13px', fontSize: 15,
                color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'background 200ms',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Continue with Apple
            </button>
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
        <AbstractPanel side="right"/>
      </div>
    </div>
  )
}
