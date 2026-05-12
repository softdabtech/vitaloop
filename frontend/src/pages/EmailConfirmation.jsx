import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { resolvePostLoginDestination, navigateToResolvedPath } from '../auth/postLogin'
import { notifyRegistrationAlert } from '../auth/registrationAlert'

function getBrowserOrigin() {
  if (typeof window === 'undefined') {
    return ''
  }
  return window.location.origin
}

function resolveEmailConfirmationRedirect() {
  const configured = import.meta.env.VITE_EMAIL_CONFIRMATION_PATH
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured
  }
  const origin = getBrowserOrigin()
  return origin ? `${origin}/auth/confirmation` : '/auth/confirmation'
}

function getCurrentBrowserUrl() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return new URL(window.location.href)
  } catch {
    return null
  }
}

function getConfirmationParams() {
  const currentUrl = getCurrentBrowserUrl()
  if (!currentUrl) {
    return null
  }
  const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ''))
  return {
    code: currentUrl.searchParams.get('code'),
    tokenHash: currentUrl.searchParams.get('token_hash'),
    type: currentUrl.searchParams.get('type'),
    hasAccessToken: Boolean(hashParams.get('access_token')),
  }
}

async function applyConfirmationParams(params) {
  if (!params) {
    throw new Error('Не удалось прочитать параметры подтверждения.')
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code)
    if (error) throw error
    return
  }

  if (params.tokenHash && params.type) {
    const { error } = await supabase.auth.verifyOtp({
      type: params.type,
      token_hash: params.tokenHash,
    })
    if (error) throw error
    return
  }

  if (params.hasAccessToken) {
    await supabase.auth.getSession()
  }
}

function waitForSessionThenNavigate(navigate) {
  let attempts = 0

  const poll = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      navigate('/onboarding', { replace: true })
      return
    }

    attempts += 1
    if (attempts < 15) {
      setTimeout(poll, 200)
    } else {
      navigate('/login', { replace: true })
    }
  }

  setTimeout(poll, 300)
}

export default function EmailConfirmation() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('checking') // pending | checking | success | error
  const [errorMsg, setErrorMsg] = useState('')
  const [redirecting, setRedirecting] = useState(false)
  const [resendEmail, setResendEmail] = useState(searchParams.get('email') || '')

  const isPendingMode = searchParams.get('pending') === '1'

  useEffect(() => {
    if (!isPendingMode) {
      return
    }

    // Pending confirmation page should still fast-forward if a session already exists.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await notifyRegistrationAlert('email_confirmation_existing_session')
        navigate('/onboarding', { replace: true })
      }
    })
  }, [isPendingMode, navigate])

  useEffect(() => {
    const handleConfirmation = async () => {
      if (isPendingMode) {
        setStatus('pending')
        return
      }

      try {
        await applyConfirmationParams(getConfirmationParams())

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) {
          throw userError
        }

        if (!user) {
          setStatus('error')
          setErrorMsg('Не удалось подтвердить email. Ссылка может быть недействительна или истекла.')
          return
        }

        if (user.email_confirmed_at) {
          await notifyRegistrationAlert('email_confirmation')
          setStatus('success')
          toast.success('✅ Email confirmed! Redirecting...')
          setRedirecting(true)
          waitForSessionThenNavigate(navigate)
        } else {
          setStatus('error')
          setErrorMsg('Email пока не подтвержден. Проверьте, что открыта актуальная ссылка из письма.')
        }
      } catch (err) {
        console.error('Email confirmation error:', err)
        setStatus('error')
        setErrorMsg(err.message || 'Произошла ошибка при подтверждении email.')
      }
    }

    handleConfirmation()
  }, [isPendingMode, navigate])

  const handleResend = async () => {
    try {
      const manualEmail = String(resendEmail || '').trim()
      let targetEmail = manualEmail

      if (!targetEmail) {
        const { data: { session } } = await supabase.auth.getSession()
        targetEmail = session?.user?.email || ''
      }

      if (!targetEmail) {
        throw new Error('Введите email для повторной отправки')
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: {
          emailRedirectTo: resolveEmailConfirmationRedirect(),
        },
      })

      if (error) throw error
      toast.success('Confirmation email resent! Check your inbox.')
    } catch (err) {
      toast.error('Error resending email: ' + err.message)
    }
  }

  return (
    <div
      style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Premium Display", sans-serif',
        backgroundColor: '#f5f5f5',
      }}
    >
      <div
        style={{
          padding: '40px',
          borderRadius: '12px',
          backgroundColor: 'white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%',
        }}
      >
        {status === 'pending' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
            <h1 style={{ fontSize: '22px', marginBottom: '8px' }}>Confirm Your Email</h1>
            <p style={{ color: '#666', marginBottom: '16px' }}>
              Мы отправили письмо для подтверждения. Откройте ссылку из письма, затем вернитесь сюда.
            </p>
            <input
              type="email"
              placeholder="you@example.com"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              style={{
                width: '100%',
                marginBottom: '12px',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleResend}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  backgroundColor: '#007AFF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Resend Email
              </button>
              <button
                onClick={() => navigate('/login')}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  backgroundColor: '#f0f0f0',
                  color: '#333',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Back to Login
              </button>
            </div>
          </>
        )}

        {status === 'checking' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>Verifying Email</h1>
            <p style={{ color: '#666', marginBottom: '24px' }}>
              Please wait while we confirm your email address...
            </p>
            <div
              style={{
                width: '40px',
                height: '40px',
                border: '4px solid #e0e0e0',
                borderTop: '4px solid #007AFF',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto',
              }}
            />
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h1 style={{ fontSize: '24px', marginBottom: '8px', color: '#34C759' }}>
              Email Confirmed!
            </h1>
            <p style={{ color: '#666', marginBottom: '24px' }}>
              {redirecting
                ? 'Redirecting to dashboard...'
                : 'Your email has been verified successfully.'}
            </p>
            {!redirecting && (
              <button
                onClick={async () => {
                  try {
                    const destination = await resolvePostLoginDestination()
                    navigateToResolvedPath(navigate, destination)
                  } catch {
                    navigate('/dashboard')
                  }
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#007AFF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Go to Dashboard
              </button>
            )}
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
            <h1 style={{ fontSize: '20px', marginBottom: '8px', color: '#FF3B30' }}>
              Confirmation Failed
            </h1>
            <p style={{ color: '#666', marginBottom: '16px' }}>{errorMsg}</p>
            <p style={{ color: '#999', fontSize: '14px', marginBottom: '24px' }}>
              The confirmation link may have expired. You can request a new one below.
            </p>
            <input
              type="email"
              placeholder="you@example.com"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              style={{
                width: '100%',
                marginBottom: '12px',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleResend}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  backgroundColor: '#007AFF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Resend Email
              </button>
              <button
                onClick={() => navigate('/login')}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  backgroundColor: '#f0f0f0',
                  color: '#333',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Back to Login
              </button>
            </div>
          </>
        )}

        {/* expired state is folded into generic error flow */}
      </div>
    </div>
  )
}
