import { useNavigate } from 'react-router-dom'
import { version } from '../../../package.json'

const COL_PRODUCT = [
  { label: 'The problem',      href: '#problem' },
  { label: 'How it works',      href: '#how-it-works' },
  { label: 'Why VITALOOP',      href: '#why-vitaloop' },
  { label: 'Pricing',           href: '#pricing' },
  { label: 'User stories',      href: '#stories' },
]
const COL_COMPANY = [
  { label: 'About product',     href: '#hero' },
  { label: 'Privacy policy',    href: '/privacy' },
  { label: 'Terms of service',  href: '/terms' },
  { label: 'Contact',           href: 'mailto:hello@vitaloop.com' },
]
function LogoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="13" fill="var(--teal-500)"/>
      <path d="M4 14h4l2-6 4 12 2-7 2 4h6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

function FooterLink({ label, href, external = false }) {
  const navigate = useNavigate()
  const handleClick = () => {
    if (href.startsWith('mailto:')) {
      window.location.href = href
      return
    }
    if (external) { window.open(href, '_blank', 'noopener noreferrer'); return }
    if (href.startsWith('#')) {
      const el = document.getElementById(href.slice(1))
      el?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate(href)
    }
  }
  return (
    <li>
      <button
        onClick={handleClick}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 14, color: '#6e6e73', padding: 0,
          transition: 'color 200ms',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'white' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#6e6e73' }}
      >
        {label}
      </button>
    </li>
  )
}

export default function Footer() {
  return (
    <footer style={{ background: '#000', padding: '64px 24px 40px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* 3-column grid */}
        <div className="grid md:grid-cols-3 gap-12" style={{ marginBottom: 48 }}>

          {/* Brand column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <LogoIcon />
              <span style={{ fontSize: 18, fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>VITALOOP</span>
            </div>
            <div style={{ fontSize: 13, color: '#6e6e73', marginBottom: 24 }}>Privacy-first health intelligence</div>
          </div>

          {/* Product */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 16 }}>Product</div>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {COL_PRODUCT.map(({ label, href }) => <FooterLink key={label} label={label} href={href} />)}
            </ul>
          </div>

          {/* Company */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 16 }}>Company</div>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {COL_COMPANY.map(({ label, href }) => <FooterLink key={label} label={label} href={href} />)}
            </ul>
            <div style={{ marginTop: 16, fontSize: 11, color: '#f5a623', fontWeight: 500 }}>Not medical advice</div>
          </div>

        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: '0.5px solid #222', paddingTop: 24,
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ fontSize: 12, color: '#6e6e73' }}>
            VITALOOP © {new Date().getFullYear()} • Privacy-first health intelligence
          </span>
          <span style={{ fontSize: 12, color: '#3d3d3f' }}>
            Secure • Private • Never sells your data · v{version}
          </span>
        </div>
      </div>
    </footer>
  )
}
