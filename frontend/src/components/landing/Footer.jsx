import { useNavigate } from 'react-router-dom'

const COL_PRODUCT = [
  { label: 'How it works',      href: '#how-it-works' },
  { label: 'Health Avatar',     href: '#avatar' },
  { label: 'Progress Tracker',  href: '#how-it-works' },
  { label: 'Pricing',           href: '#pricing' },
  { label: 'Partner program',   href: '#partners' },
]
const COL_COMPANY = [
  { label: 'Science',           href: '#science' },
  { label: 'Privacy policy',    href: '/privacy' },
  { label: 'Terms of service',  href: '/terms' },
  { label: 'Contact',           href: 'mailto:hello@vitaloop.com' },
]
const COL_PARTNERS = [
  { label: 'iHerb',    href: 'https://www.iherb.com' },
  { label: 'Amazon',   href: 'https://www.amazon.com' },
  { label: 'Thorne',   href: 'https://www.thorne.com' },
  { label: 'LabCorp',  href: 'https://www.labcorp.com' },
  { label: 'Quest',    href: 'https://www.questdiagnostics.com' },
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

        {/* 4-column grid */}
        <div className="grid md:grid-cols-4 gap-12" style={{ marginBottom: 48 }}>

          {/* Brand column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <LogoIcon />
              <span style={{ fontSize: 18, fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>VITALOOP</span>
            </div>
            <div style={{ fontSize: 13, color: '#6e6e73', marginBottom: 24 }}>Biohacking-as-a-Service</div>
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

          {/* Partners */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 16 }}>Partners</div>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {COL_PARTNERS.map(({ label, href }) => <FooterLink key={label} label={label} href={href} external />)}
            </ul>
            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => document.getElementById('partners')?.scrollIntoView({ behavior: 'smooth' })}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, color: 'var(--teal-500)', padding: 0,
                  transition: 'color 200ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--teal-300)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--teal-500)' }}
              >
                Become a partner →
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: '0.5px solid #222', paddingTop: 24,
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ fontSize: 12, color: '#6e6e73' }}>
            © {new Date().getFullYear()} VITALOOP LLC · Delaware, USA
          </span>
          <span style={{ fontSize: 12, color: '#6e6e73' }}>
            Made with AI · Not medical advice · HIPAA-ready
          </span>
        </div>
      </div>
    </footer>
  )
}
