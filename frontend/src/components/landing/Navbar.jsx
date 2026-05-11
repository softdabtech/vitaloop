import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { EASE } from '../../lib/motion.js'
import { useAuth } from '../../hooks/useAuth.js'

const NAV_LINKS = [
  { label: 'Product', href: '#how-it-works' },
  { label: 'Features', href: '#why-vitaloop' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Stories', href: '#testimonials' },
  { label: 'FAQ', href: '#faq' },
  { label: 'For Nutritionists', href: '/for-nutritionists', page: true },
  { label: 'Help', href: '/help', page: true },
]

const BRAND_LOGO_SRC = '/images/vitaloop-logo-wordmark.svg'

export default function Navbar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const reduced = useReducedMotion()
  const [scrolled, setScrolled]     = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeSection, setActive]  = useState('')
  const displayName = (user?.user_metadata?.full_name || user?.email || '').split('@')[0]

  // Lock body scroll when mobile menu is open (iOS fix)
  useEffect(() => {
    if (mobileOpen) {
      const y = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${y}px`
      document.body.style.width = '100%'
    } else {
      const y = parseInt(document.body.style.top || '0', 10)
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      if (y) window.scrollTo(0, -y)
    }
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
    }
  }, [mobileOpen])

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

  const scrollTo = (href, page = false) => {
    setMobileOpen(false)
    if (page) { navigate(href); return }
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
            display: 'flex', alignItems: 'center',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <img
            src={BRAND_LOGO_SRC}
            alt="VITALOOP"
            style={{ width: 132, height: 28, objectFit: 'contain' }}
          />
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex" style={{ gap: 28, alignItems: 'center' }}>
          {NAV_LINKS.map(({ label, href, page }) => {
            const isActive = !page && activeSection === href.slice(1)
            return (
              <button
                key={label}
                onClick={() => scrollTo(href, page)}
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
                    position: 'absolute', bottom: -2, left: '50%',
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
          {user ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="hidden md:block"
              style={{
                background: 'var(--teal-800)', color: 'white',
                border: 'none', borderRadius: 980,
                padding: '8px 20px', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', transition: 'background 200ms, transform 200ms',
                maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                touchAction: 'manipulation',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--teal-600)'
                e.currentTarget.style.transform = 'scale(1.02)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--teal-800)'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              title={displayName}
            >
              {displayName || 'My account'}
            </button>
          ) : (
            <>
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
                onClick={() => navigate('/login?signup=true')}
                className="hidden md:block"
                style={{
                  background: 'var(--teal-800)', color: 'white',
                  border: 'none', borderRadius: 980,
                  padding: '8px 20px', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', transition: 'background 200ms, transform 200ms',
                  touchAction: 'manipulation',
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
            </>
          )}
          {/* Hamburger — animated bars → X */}
          <button
            className="md:hidden hamburger-btn"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--gray-700)',
              display: 'flex', flexDirection: 'column',
              gap: 5, alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44,
              touchAction: 'manipulation',
            }}
          >
            <motion.span
              animate={mobileOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              style={{ display: 'block', width: 20, height: 2, background: 'currentColor', borderRadius: 2, transformOrigin: 'center' }}
            />
            <motion.span
              animate={mobileOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.18 }}
              style={{ display: 'block', width: 20, height: 2, background: 'currentColor', borderRadius: 2 }}
            />
            <motion.span
              animate={mobileOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              style={{ display: 'block', width: 20, height: 2, background: 'currentColor', borderRadius: 2, transformOrigin: 'center' }}
            />
          </button>
        </div>
      </nav>

      {/* Mobile overlay — animated */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            initial={reduced ? { opacity: 1 } : { opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 999,
              background: 'rgba(10,10,10,0.97)',
              backdropFilter: 'blur(20px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 8,
            }}
          >
            {/* Close button top-right */}
            <button
              onClick={(e) => { e.stopPropagation(); setMobileOpen(false) }}
              aria-label="Close menu"
              style={{
                position: 'absolute', top: 16, right: 20,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.5)', fontSize: 28, lineHeight: 1,
                padding: 8, width: 44, height: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                touchAction: 'manipulation',
              }}
            >
              ×
            </button>

            {NAV_LINKS.map(({ label, href, page }, i) => (
              <motion.button
                key={label}
                onClick={(e) => { e.stopPropagation(); scrollTo(href, page) }}
                initial={reduced ? {} : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.32, ease: EASE }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 'clamp(24px, 7vw, 32px)', color: 'white', fontWeight: 600,
                  padding: '12px 0', letterSpacing: '-0.01em',
                  minHeight: 56, touchAction: 'manipulation',
                }}
                whileHover={{ color: 'var(--teal-400)', x: 4 }}
                whileTap={{ scale: 0.97 }}
              >
                {label}
              </motion.button>
            ))}

            <motion.button
              onClick={(e) => {
                e.stopPropagation()
                setMobileOpen(false)
                navigate(user ? '/dashboard' : '/login?signup=true')
              }}
              initial={reduced ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: NAV_LINKS.length * 0.07 + 0.06, duration: 0.32, ease: EASE }}
              whileTap={{ scale: 0.97 }}
              style={{
                marginTop: 24,
                background: 'var(--teal-500)', color: 'white',
                border: 'none', borderRadius: 980,
                padding: '16px 48px', fontSize: 18, fontWeight: 600, cursor: 'pointer',
                minHeight: 56, touchAction: 'manipulation',
              }}
            >
              {user ? (displayName || 'My account') : 'Get started free'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
