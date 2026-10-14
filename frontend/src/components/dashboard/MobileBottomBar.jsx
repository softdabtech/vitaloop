import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ActivitySquare, CalendarDays, CreditCard, FileText, HelpCircle, Home, Receipt, Route, Settings, Upload, UserRound } from 'lucide-react'
import { isUkrainianLocale } from '../../lib/locale.js'
import { normalizePath } from '../../lib/pathUtils.js'

export const MOBILE_NAV_ITEMS = [
  { key: 'home', path: '/dashboard', label: 'Home', ukLabel: 'Головна', icon: Home },
  { key: 'results', path: '/lab-results', label: 'Results', ukLabel: 'Результати', icon: ActivitySquare },
  { key: 'upload', path: '/upload', label: 'Upload', ukLabel: 'Завантажити', icon: Upload },
  { key: 'plan', label: 'My Plan', ukLabel: 'Мій план', icon: Route, submenu: 'plan' },
  { key: 'account', label: 'Account', ukLabel: 'Акаунт', icon: UserRound, submenu: 'account' },
]

export const MOBILE_SUBNAV = {
  plan: [
    { path: '/lab-results', label: 'Action Plan / Protocol', ukLabel: 'План дій / Протокол', icon: FileText },
    { path: '/lab-plan', label: 'Lab Plan', ukLabel: 'План аналізів', icon: Route },
  ],
  account: [
    { path: '/account', label: 'Account Settings', ukLabel: 'Налаштування', icon: Settings },
    { path: '/health-profile', label: 'Profile & Safety', ukLabel: 'Профіль і безпека', icon: Settings },
    { path: '/subscription', label: 'Subscription', ukLabel: 'Підписка', icon: CreditCard },
    { path: '/billing-history', label: 'Billing History', ukLabel: 'Історія платежів', icon: Receipt },
    { path: '/check-ins', label: 'Check-in History', ukLabel: 'Історія чек-інів', icon: CalendarDays },
    { path: '/help-center', label: 'Help', ukLabel: 'Допомога', icon: HelpCircle },
  ],
}

function isActive(current, item) {
  const normalized = normalizePath(current)
  if (item.key === 'results') {
    return normalized === '/lab-results' || normalized === '/progress' || normalized.startsWith('/results/') || normalized.startsWith('/protocol/')
  }
  if (item.key === 'plan') return normalized === '/lab-plan'
  if (item.key === 'account') return ['/account', '/health-profile', '/subscription', '/billing-history', '/check-ins', '/help-center'].includes(normalized)
  return normalized === item.path || normalized.startsWith(`${item.path}/`)
}

export default function MobileBottomBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [openSubnav, setOpenSubnav] = useState(null)
  const isUk = isUkrainianLocale()

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('vtl-mobile-subnav-change', {
      detail: { openSubnav },
    }))
    if (openSubnav) {
      document.body.dataset.vtlMobileSubnav = openSubnav
    } else {
      delete document.body.dataset.vtlMobileSubnav
    }
    return () => {
      delete document.body.dataset.vtlMobileSubnav
    }
  }, [openSubnav])

  function toggleSubnav(key) {
    setOpenSubnav((current) => (current === key ? null : key))
  }

  return (
    <>
      {openSubnav && (
        <div className="vtl-mobile-subnav fixed inset-x-3 bottom-[calc(var(--vtl-bottom-bar-height)+env(safe-area-inset-bottom)+12px)] z-50 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur md:hidden">
          <div className="grid gap-1" role="menu" aria-label={`${openSubnav === 'plan' ? 'My Plan' : 'Account'} menu`}>
            {MOBILE_SUBNAV[openSubnav].map((item) => {
              const Icon = item.icon
              const label = isUk ? item.ukLabel : item.label
              return (
                <button
                  key={item.path}
                  type="button"
                  role="menuitem"
                  className="vtl-focus-ring flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
                  onClick={() => {
                    navigate(item.path)
                    setOpenSubnav(null)
                  }}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <nav
        className="vtl-mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/97 backdrop-blur-xl md:hidden"
        aria-label="Main navigation"
      >
        <div className="grid grid-cols-5 gap-1 px-2 pt-2">
          {MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isActive(location.pathname, item)
            const expanded = openSubnav === item.submenu
            const label = isUk ? item.ukLabel : item.label
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.submenu) {
                    toggleSubnav(item.submenu)
                  } else {
                    navigate(item.path)
                    setOpenSubnav(null)
                  }
                }}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                aria-expanded={item.submenu ? expanded : undefined}
                className={`vtl-focus-ring flex min-h-11 min-w-0 flex-col items-center justify-start gap-1 rounded-xl px-1 pb-2 pt-1 text-center transition ${
                  active || expanded ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="max-w-full break-words text-[11px] font-semibold leading-tight">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
