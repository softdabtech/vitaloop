import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import BrandMark from './BrandMark.jsx'
import { navigateToApp } from '../../lib/appUrl.js'

const NAV_LINKS = [
  { id: 'how-it-works', label: 'How it works', route: '/#problem' },
  { id: 'example-report', label: 'Example report', route: '/example-report' },
  { id: 'pricing', label: 'Pricing', route: '/#pricing' },
  { id: 'team', label: 'Team', route: '/team/' },
  { id: 'for-nutritionists', label: 'For professionals', route: '/for-nutritionists' },
]

export function PageHeader() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const closeMobileMenu = () => setMobileMenuOpen(false)

  const navAction = (item) => {
    closeMobileMenu()
    if (item.route) {
      navigate(item.route)
      return
    }
    setTimeout(() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }), mobileMenuOpen ? 280 : 0)
  }

  const ctaBase = 'vtl-public-button'
  const navTextClass = 'text-slate-600 hover:text-slate-900'

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center justify-between px-4 sm:px-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 transition hover:opacity-80"
        >
          <BrandMark />
        </button>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((item) => (
            <button
              key={item.id}
              onClick={() => navAction(item)}
              className={`text-sm transition ${navTextClass}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Log in link — only for non-authenticated visitors */}
          <button
            onClick={() => navigateToApp('/login')}
            className="hidden sm:inline-flex vtl-public-button vtl-public-button--secondary px-4"
            style={{ visibility: (!authLoading && user) ? 'hidden' : 'visible' }}
            tabIndex={(!authLoading && user) ? -1 : 0}
            aria-hidden={(!authLoading && user) ? true : undefined}
          >
            Log in
          </button>

          {/* Cabinet / Sign Up button */}
          <button
            onClick={() => navigateToApp(user ? '/dashboard' : '/login?signup=true')}
            className={`hidden sm:inline-flex ${ctaBase} vtl-public-button--primary`}
          >
            {user ? 'Dashboard' : 'Sign Up'}
          </button>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Open navigation menu"
            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="border-t border-slate-200 bg-white md:hidden"
          >
            <div className="mx-auto flex max-w-[1240px] flex-col gap-1 px-4 py-4">
              {NAV_LINKS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navAction(item)}
                  className="rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </button>
              ))}
              <div className="my-2 h-px bg-slate-100" />
              {user ? (
                <button
                  onClick={() => {
                    closeMobileMenu()
                    navigateToApp('/dashboard')
                  }}
                  className="mt-1 w-full vtl-public-button vtl-public-button--primary"
                >
                  Dashboard
                </button>
              ) : (
                <div className="mt-1 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      closeMobileMenu()
                      navigateToApp('/login?signup=true')
                    }}
                    className="w-full vtl-public-button vtl-public-button--primary"
                  >
                    Sign Up — Free
                  </button>
                  <button
                    onClick={() => {
                      closeMobileMenu()
                      navigateToApp('/login')
                    }}
                    className="w-full vtl-public-button vtl-public-button--secondary"
                  >
                    Log in
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
