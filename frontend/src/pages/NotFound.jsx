import { Link } from 'react-router-dom'
import Seo from '../components/Seo.jsx'

export default function NotFound() {
  return (
    <>
      <Seo
        title="404 Not Found"
        description="The page you are looking for does not exist. Return to VITALOOP home."
        path="/404.html"
      />
      <main
        style={{
          minHeight: '100svh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--white)',
          padding: '48px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 560,
            width: '100%',
            textAlign: 'center',
            padding: '48px 32px',
            borderRadius: 24,
            border: '0.5px solid var(--gray-100)',
            background: 'var(--gray-50)',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--teal-500)',
              marginBottom: 12,
            }}
          >
            Error 404
          </div>
          <h1
            style={{
              fontSize: 'clamp(36px, 6vw, 56px)',
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              color: 'var(--gray-900)',
              marginBottom: 16,
              fontWeight: 700,
            }}
          >
            Page not found.
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.65,
              color: 'var(--gray-500)',
              marginBottom: 28,
            }}
          >
            The page you requested does not exist or has been moved. Go back to the main VITALOOP experience.
          </p>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 28px',
              borderRadius: 999,
              background: 'var(--teal-500)',
              color: 'white',
              textDecoration: 'none',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            Back to home
          </Link>
        </div>
      </main>
    </>
  )
}