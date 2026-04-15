import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function EmailConfirmation() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking') // checking | success | error | expired
  const [errorMsg, setErrorMsg] = useState('')
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    const handleConfirmation = async () => {
      try {
        // Supabase automatically processes confirmation hash from URL
        // getSession() will return the user if hash is valid
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          setStatus('error')
          setErrorMsg('Session error: ' + sessionError.message)
          return
        }

        if (!session || !session.user) {
          setStatus('error')
          setErrorMsg('No valid session. Confirmation link may have expired.')
          return
        }

        if (session.user.email_confirmed_at) {
          setStatus('success')
          toast.success('✅ Email confirmed! Redirecting to dashboard...')
          setRedirecting(true)
          
          // Give user time to see success message
          setTimeout(() => {
            navigate('/dashboard', { replace: true })
          }, 1500)
        } else {
          setStatus('error')
          setErrorMsg('Email confirmation failed. The link may have expired.')
        }
      } catch (err) {
        console.error('Email confirmation error:', err)
        setStatus('error')
        setErrorMsg(err.message || 'An unexpected error occurred')
      }
    }

    handleConfirmation()
  }, [navigate])

  const handleResend = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) {
        throw new Error('Unable to determine email address')
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: session.user.email,
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
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
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
                onClick={() => navigate('/dashboard')}
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

        {status === 'expired' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏰</div>
            <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>Link Expired</h1>
            <p style={{ color: '#666', marginBottom: '24px' }}>
              Your confirmation link has expired. Request a new one to continue.
            </p>
            <button
              onClick={handleResend}
              style={{
                width: '100%',
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
              Resend Confirmation Email
            </button>
          </>
        )}
      </div>
    </div>
  )
}
