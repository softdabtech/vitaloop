import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Shield, Activity, Zap, FlaskConical, BarChart2, Heart, Droplets, ScanLine, ClipboardList } from 'lucide-react'

function ParticleCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const isMobile = window.matchMedia('(pointer: coarse)').matches

    const COUNT = 80
    const RGB = '67, 147, 115'   // #439373
    const LINK_DIST = 130
    const REPEL_R = 130
    const REPEL_F = 0.02

    let raf
    const mouse = { x: -9999, y: -9999 }
    let particles = []

    function resize() {
      const w = canvas.offsetWidth || window.innerWidth
      const h = canvas.offsetHeight || 600
      canvas.width = w
      canvas.height = h
      init()
    }

    function init() {
      particles = Array.from({ length: COUNT }, () => {
        const vx = (Math.random() - 0.5) * 0.35
        const vy = (Math.random() - 0.5) * 0.35
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: 1.5 + Math.random() * 1.5,
          vx, vy, bvx: vx, bvy: vy,
        }
      })
    }

    function yAlpha(y) {
      const fadeBot = canvas.height * 0.70
      const fade = y > fadeBot ? 1 - (y - fadeBot) / (canvas.height * 0.30) : 1
      return Math.max(0, fade)
    }

    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < LINK_DIST) {
            const lineAlpha = (1 - d / LINK_DIST) * 0.18 * Math.min(yAlpha(a.y), yAlpha(b.y))
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(${RGB}, ${lineAlpha})`
            ctx.lineWidth = 0.8
            ctx.stroke()
          }
        }
      }

      // Draw dots
      for (const p of particles) {
        if (!isMobile) {
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < REPEL_R && d > 0) {
            const f = (1 - d / REPEL_R) * REPEL_F
            p.vx += (dx / d) * f
            p.vy += (dy / d) * f
          }
          p.vx += (p.bvx - p.vx) * 0.025
          p.vy += (p.bvy - p.vy) * 0.025
        }

        p.x += p.vx
        p.y += p.vy

        if (p.x < -5) p.x = canvas.width + 5
        if (p.x > canvas.width + 5) p.x = -5
        if (p.y < -5) p.y = canvas.height + 5
        if (p.y > canvas.height + 5) p.y = -5

        const alpha = 0.35 * yAlpha(p.y)

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${RGB}, ${alpha})`
        ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }

    resize()
    tick()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999 }
    if (!isMobile) {
      window.addEventListener('mousemove', onMove)
      document.addEventListener('mouseleave', onLeave)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      if (!isMobile) {
        window.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseleave', onLeave)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none', display: 'block',
      }}
    />
  )
}

export default function Hero() {
  const navigate = useNavigate()

  return (
    <section
      id="hero"
      style={{
        minHeight: 'auto',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--white)',
        padding: '120px 24px 96px',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Animated particle background */}
      <ParticleCanvas />

      {/* Decorative side icons — left */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 200, zIndex: 0, pointerEvents: 'none' }}>
        {[
          { Icon: Activity,     top: '14%', left: '18%', rotate: -15, size: 28 },
          { Icon: FlaskConical, top: '32%', left: '6%',  rotate: 10,  size: 22 },
          { Icon: Heart,        top: '52%', left: '22%', rotate: -8,  size: 24 },
          { Icon: BarChart2,    top: '70%', left: '10%', rotate: 12,  size: 26 },
          { Icon: Droplets,     top: '84%', left: '28%', rotate: -6,  size: 20 },
        ].map(({ Icon, top, left, rotate, size }, i) => (
          <div key={i} style={{ position: 'absolute', top, left, transform: `rotate(${rotate}deg)`, opacity: 0.055 }}>
            <Icon size={size} color="var(--teal-500)" strokeWidth={1.2} />
          </div>
        ))}
      </div>

      {/* Decorative side icons — right */}
      <div aria-hidden="true" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 200, zIndex: 0, pointerEvents: 'none' }}>
        {[
          { Icon: ScanLine,      top: '12%', right: '14%', rotate: 8,   size: 26 },
          { Icon: Zap,           top: '30%', right: '24%', rotate: -12, size: 22 },
          { Icon: ClipboardList, top: '50%', right: '8%',  rotate: 6,   size: 28 },
          { Icon: Activity,      top: '66%', right: '20%', rotate: -10, size: 24 },
          { Icon: FlaskConical,  top: '82%', right: '30%', rotate: 14,  size: 20 },
        ].map(({ Icon, top, right, rotate, size }, i) => (
          <div key={i} style={{ position: 'absolute', top, right, transform: `rotate(${rotate}deg)`, opacity: 0.055 }}>
            <Icon size={size} color="var(--teal-500)" strokeWidth={1.2} />
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, width: '100%', textAlign: 'center' }}>

        {/* Eyebrow chip */}
        <div style={{ marginBottom: 32 }}>
          <span style={{
            display: 'inline-block',
            background: 'var(--teal-50)', border: '0.5px solid var(--teal-300)',
            borderRadius: 980, padding: '6px 18px',
            fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--teal-600)',
          }}>
            AI-powered health optimization
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(52px, 7vw, 84px)',
          fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05,
          color: 'var(--gray-900)',
          marginBottom: 24,
        }}>
          Know your body.<br />
          <span style={{ color: 'var(--teal-500)' }}>Upgrade your life.</span>
        </h1>

        {/* Subheadline */}
        <p style={{
          fontSize: 19, color: 'var(--gray-500)',
          maxWidth: 540, margin: '0 auto 40px',
          lineHeight: 1.6,
        }}>
          Upload your lab results, get AI analysis, and follow a personalized protocol.
          Track your progress weekly — not just one-time results.
        </p>

        {/* CTA row */}
        <div style={{
          display: 'flex', gap: 16, justifyContent: 'center',
          flexWrap: 'wrap', marginBottom: 40,
        }}>
          <button
            onClick={() => navigate('/login')}
            aria-label="Start free — no card needed"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--teal-800)', color: 'white',
              border: 'none', borderRadius: 980,
              padding: '16px 36px', fontSize: 17, fontWeight: 600,
              cursor: 'pointer', transition: 'background 200ms, transform 200ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--teal-600)'; e.currentTarget.style.transform = 'scale(1.02)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--teal-800)'; e.currentTarget.style.transform = 'scale(1)' }}
          >
            Start free — no card needed <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button
            onClick={() => { const el = document.getElementById('how-it-works'); el?.scrollIntoView({ behavior: 'smooth' }) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'transparent',
              border: '1.5px solid var(--gray-300)',
              borderRadius: 980, padding: '16px 28px', fontSize: 17,
              color: 'var(--gray-700)', cursor: 'pointer',
              transition: 'border-color 200ms, color 200ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--teal-500)'; e.currentTarget.style.color = 'var(--teal-600)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--gray-300)'; e.currentTarget.style.color = 'var(--gray-700)' }}
          >
            See how it works
          </button>
        </div>

        {/* Social proof */}
        <div style={{
          display: 'flex', gap: 20, justifyContent: 'center',
          alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            <span style={{ color: 'var(--teal-500)' }}>★★★★★</span> 4.9 · 100+ users
          </span>
          <span aria-hidden="true" style={{ width: '0.5px', height: 16, background: 'var(--gray-100)', display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Works with any lab worldwide</span>
          <span aria-hidden="true" style={{ width: '0.5px', height: 16, background: 'var(--gray-100)', display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Shield size={12} aria-hidden="true" /> Secure &amp; privacy-first
          </span>
        </div>

      </div>
    </section>
  )
}
