import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Avatar',       href: '#avatar' },
  { label: 'Science',      href: '#science' },
  { label: 'Partners',     href: '#partners' },
  { label: 'Pricing',      href: '#pricing' },
]

function LogoIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="13" fill="var(--teal-500)" />
      <path
        d="M4 14h4l2-6 4 12 2-7 2 4h6"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export default function Navbar() {
  const navigate = useNavigate()
  const [scrolled, setScrolled]     = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeSection, setActive]  = useState('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.href.slice(1))
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-40% 0px -55% 0px' }
    )
    ids.forEach((id) => { const el = document.getElementById(id); el && obs.observe(el) })
    return () => obs.disconnect()
  }, [])

  const scrollTo = (href) => {
    setMobileOpen(false)
    const el = document.getElementById(href.slice(1))
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <nav
        role="navigation"
        aria-label="Main navigation"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
          height: 52,
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderBottom: `0.5px solid ${scrolled ? 'rgba(0,0,0,0.08)' : 'transparent'}`,
          transition: 'border-color 300ms ease',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px',
        }}
      >
        {/* Logo */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="VITALOOP home"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <LogoIcon />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--teal-800)', letterSpacing: '-0.01em' }}>
            VITALOOP
          </span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex" style={{ gap: 28, alignItems: 'center' }}>
          {NAV_LINKS.map(({ label, href }) => {
            const isActive = activeSection === href.slice(1)
            return (
              <button
                key={label}
                onClick={() => scrollTo(href)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14,
                  color: isActive ? 'var(--gray-900)' : 'var(--gray-500)',
                  transition: 'color 200ms',
                  position: 'relative', paddingBottom: 4,
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--gray-900)' }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--gray-500)' }}
              >
                {label}
                {isActive && (
                  <span style={{
                    position: 'absolute', bottom: 0, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4, height: 4, borderRadius: '50%',
                    background: 'var(--teal-500)',
                  }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/login')}
            className="hidden md:block"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, color: 'var(--gray-500)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gray-900)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--gray-500)' }}
          >
            Sign in
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'var(--teal-800)', color: 'white',
              border: 'none', borderRadius: 980,
              padding: '8px 20px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', transition: 'background 200ms, transform 200ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--teal-600)'
              e.currentTarget.style.transform = 'scale(1.02)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--teal-800)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            Get started free
          </button>
          <button
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--gray-700)', display: 'flex', alignItems: 'center',
            }}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.96)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 32,
          }}
        >
          {NAV_LINKS.map(({ label, href }, i) => (
            <button
              key={label}
              onClick={() => scrollTo(href)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 28, color: 'white', fontWeight: 600,
                opacity: 0,
                animation: `countUp 0.4s ease forwards`,
                animationDelay: `${i * 60}ms`,
              }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => { setMobileOpen(false); navigate('/login') }}
            style={{
              marginTop: 16,
              background: 'var(--teal-500)', color: 'white',
              border: 'none', borderRadius: 980,
              padding: '14px 40px', fontSize: 18, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Get started free
          </button>
        </div>
      )}
    </>
  )
}
