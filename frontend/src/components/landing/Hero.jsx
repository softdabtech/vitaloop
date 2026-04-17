import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Shield, Activity, Zap, FlaskConical, BarChart2, Heart, Droplets, ScanLine, ClipboardList, CheckCircle2, LayoutDashboard, Upload, X } from 'lucide-react'
import { stagger, staggerChild, buttonHoverProps, EASE } from '../../lib/motion.js'

const CABINET_STEPS = [
  {
    title: 'Upload a new lab report',
    body: 'A user drops in a PDF and VITALOOP starts extracting biomarkers immediately.',
    accent: '#1d9e75',
    status: 'Upload recognized',
    metrics: [
      { label: 'Biomarkers found', value: '54' },
      { label: 'Red flags', value: '3' },
      { label: 'Protocol tasks', value: '7' },
    ],
  },
  {
    title: 'Cabinet interprets the data',
    body: 'The dashboard surfaces latest upload, active assignments, and what matters today.',
    accent: '#0f766e',
    status: 'Dashboard updated',
    metrics: [
      { label: 'Health score', value: '78' },
      { label: 'Active assignments', value: '4' },
      { label: 'Insights ready', value: '5' },
    ],
  },
  {
    title: 'Weekly loop stays active',
    body: 'Check-ins, insights, and progress tracking keep the cabinet alive between uploads.',
    accent: '#0f766e',
    status: 'Weekly guidance ready',
    metrics: [
      { label: 'Check-in adherence', value: '5/5' },
      { label: 'Trend movement', value: '+12' },
      { label: 'Next action', value: 'Retest iron' },
    ],
  },
]

function CabinetPreviewModal({ open, onClose, reduced }) {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (!open) {
      setStepIndex(0)
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const timer = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % CABINET_STEPS.length)
    }, 2400)

    return () => {
      document.body.style.overflow = previousOverflow
      window.clearInterval(timer)
    }
  }, [open])

  const activeStep = CABINET_STEPS[stepIndex]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{
              width: 'min(1100px, 100%)',
              maxHeight: 'min(92vh, 860px)',
              overflow: 'auto',
              borderRadius: 28,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(247,250,249,0.98))',
              border: '1px solid rgba(148, 163, 184, 0.18)',
              boxShadow: '0 40px 120px rgba(15, 23, 42, 0.28)',
              padding: '24px',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal-500)', marginBottom: 10 }}>
                  Animated cabinet preview
                </div>
                <h3 style={{ fontSize: 'clamp(24px, 4vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--gray-900)', marginBottom: 10 }}>
                  See how a user moves through the VITALOOP cabinet
                </h3>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--gray-500)', maxWidth: 700 }}>
                  This is the product story in motion: upload, interpretation, assignments, check-ins, and progress all living inside one premium cabinet surface.
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close preview"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  border: '1px solid var(--gray-200)',
                  background: 'rgba(255,255,255,0.9)',
                  color: 'var(--gray-700)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]" style={{ gap: 18 }}>
              <div
                style={{
                  borderRadius: 24,
                  border: '1px solid rgba(148,163,184,0.16)',
                  background: 'linear-gradient(180deg, #f8fafc 0%, #eefaf4 100%)',
                  padding: 18,
                  minHeight: 520,
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-[92px_minmax(0,1fr)]" style={{ gap: 16, minHeight: '100%' }}>
                  <div className="grid grid-cols-4 md:grid-cols-1" style={{ borderRadius: 20, background: '#ffffff', border: '1px solid rgba(148,163,184,0.16)', padding: '18px 12px', gap: 12 }}>
                    {[LayoutDashboard, Upload, ClipboardList, BarChart2].map((Icon, index) => (
                      <motion.div
                        key={index}
                        animate={{
                          scale: stepIndex === index || (stepIndex === 2 && index === 3) ? 1.04 : 1,
                          backgroundColor: stepIndex === index || (stepIndex === 2 && index === 3) ? 'rgba(29,158,117,0.12)' : 'rgba(248,250,252,1)',
                          borderColor: stepIndex === index || (stepIndex === 2 && index === 3) ? 'rgba(29,158,117,0.35)' : 'rgba(148,163,184,0.12)',
                        }}
                        transition={{ duration: 0.35, ease: EASE }}
                        style={{ borderRadius: 16, border: '1px solid rgba(148,163,184,0.12)', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal-700)' }}
                      >
                        <Icon size={18} />
                      </motion.div>
                    ))}
                  </div>

                    <div style={{ display: 'grid', gap: 14, gridTemplateRows: 'auto auto 1fr auto' }}>
                    <div style={{ borderRadius: 20, background: '#ffffff', border: '1px solid rgba(148,163,184,0.16)', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 4 }}>VITALOOP user cabinet</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.02em' }}>{activeStep.title}</div>
                      </div>
                      <div style={{ borderRadius: 999, padding: '8px 12px', background: `${activeStep.accent}16`, color: activeStep.accent, fontSize: 12, fontWeight: 700 }}>
                        {activeStep.status}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12 }}>
                      {activeStep.metrics.map((metric, index) => (
                        <motion.div
                          key={metric.label}
                          animate={{ y: [0, -3, 0] }}
                          transition={{ duration: 1.1, delay: index * 0.08, repeat: Infinity, repeatDelay: 1.3 }}
                          style={{ borderRadius: 18, background: '#ffffff', border: '1px solid rgba(148,163,184,0.16)', padding: '16px 14px' }}
                        >
                          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>{metric.label}</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '-0.02em' }}>{metric.value}</div>
                        </motion.div>
                      ))}
                    </div>

                    <div style={{ borderRadius: 22, background: '#ffffff', border: '1px solid rgba(148,163,184,0.16)', padding: 18, display: 'grid', gap: 14 }}>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeStep.title}
                          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
                          transition={{ duration: 0.28, ease: EASE }}
                          style={{ display: 'grid', gap: 14 }}
                        >
                          <div style={{ display: 'grid', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' }}>Active flow</div>
                              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>step {stepIndex + 1} / {CABINET_STEPS.length}</div>
                            </div>
                            <p style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.7 }}>{activeStep.body}</p>
                          </div>

                          <div style={{ display: 'grid', gap: 10 }}>
                            {[0, 1, 2].map((row) => (
                              <div key={row} style={{ borderRadius: 16, background: row === stepIndex ? `${activeStep.accent}10` : 'var(--gray-50)', border: `1px solid ${row === stepIndex ? `${activeStep.accent}35` : 'rgba(148,163,184,0.12)'}`, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)' }}>
                                    {row === 0 ? 'Latest upload summary' : row === 1 ? 'Insights and assignments' : 'Weekly check-in pulse'}
                                  </div>
                                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                                    {row === 0 ? 'Biomarkers, ranges, and source lab' : row === 1 ? 'Protocol tasks, red flags, and next action' : 'Adherence, mood, energy, and follow-up'}
                                  </div>
                                </div>
                                {row === stepIndex ? <CheckCircle2 size={18} color={activeStep.accent} /> : <div style={{ width: 18, height: 18, borderRadius: 999, border: '1px solid rgba(148,163,184,0.25)' }} />}
                              </div>
                            ))}
                          </div>

                          <div style={{ display: 'flex', gap: 8 }}>
                            {CABINET_STEPS.map((step, index) => (
                              <motion.div
                                key={step.title}
                                animate={{ flex: index === stepIndex ? 1.45 : 1, backgroundColor: index === stepIndex ? step.accent : 'rgba(203,213,225,0.8)' }}
                                transition={{ duration: 0.25 }}
                                style={{ height: 6, borderRadius: 999 }}
                              />
                            ))}
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    <div className="flex flex-col sm:flex-row" style={{ borderRadius: 18, padding: '16px 18px', background: 'linear-gradient(135deg, rgba(29,158,117,0.12), rgba(255,255,255,0.86))', border: '1px solid rgba(29,158,117,0.18)', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)' }}>This is what “See how it works” should feel like</div>
                        <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>A product demo, not a redirect away from the main page.</div>
                      </div>
                      <button
                        onClick={onClose}
                        style={{
                          borderRadius: 999,
                          border: 'none',
                          background: 'var(--teal-800)',
                          color: '#fff',
                          padding: '11px 16px',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        Close preview
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 14 }}>
                {CABINET_STEPS.map((step, index) => (
                  <motion.button
                    key={step.title}
                    onClick={() => setStepIndex(index)}
                    whileHover={reduced ? undefined : { y: -2 }}
                    style={{
                      textAlign: 'left',
                      borderRadius: 20,
                      border: `1px solid ${index === stepIndex ? `${step.accent}35` : 'rgba(148,163,184,0.14)'}`,
                      background: index === stepIndex ? `${step.accent}12` : '#ffffff',
                      padding: '18px 18px 16px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: index === stepIndex ? step.accent : 'var(--gray-400)', marginBottom: 8 }}>
                      Stage {index + 1}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 8 }}>{step.title}</div>
                    <div style={{ fontSize: 14, color: 'var(--gray-500)', lineHeight: 1.65 }}>{step.body}</div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

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
  const reduced = useReducedMotion()
  const [previewOpen, setPreviewOpen] = useState(false)

  // Stagger container: chip → h1 → p1 → p2 → ctas → proof
  const containerVariants = reduced ? {} : stagger(0.1, 0)
  const childVariants = reduced ? {} : staggerChild

  return (
    <section
      id="hero"
      className="hero-section"
      style={{
        minHeight: 'auto',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--white)',
        padding: 'var(--hero-pt) 24px var(--hero-pb)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Radial glow — fades in once */}
      {!reduced && (
        <div
          aria-hidden="true"
          className="hero-radial-glow"
          style={{
            position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 70% 55% at 50% 40%, #10b981, transparent)',
          }}
        />
      )}

      {/* Animated particle background */}
      <ParticleCanvas />

      {/* Decorative side icons — left */}
      <div aria-hidden="true" className="hero-deco" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 200, zIndex: 0, pointerEvents: 'none' }}>
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
      <div aria-hidden="true" className="hero-deco" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 200, zIndex: 0, pointerEvents: 'none' }}>
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

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ position: 'relative', zIndex: 1, maxWidth: 760, width: '100%', textAlign: 'center' }}
      >

        {/* Eyebrow chip */}
        <motion.div variants={childVariants} style={{ marginBottom: 32 }}>
          <span style={{
            display: 'inline-block',
            background: 'var(--teal-50)', border: '0.5px solid var(--teal-300)',
            borderRadius: 980, padding: '6px 18px',
            fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--teal-600)',
          }}>
            AI-Powered Biohacking as a Service
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={reduced ? {} : {
            hidden: { opacity: 0, y: 32, filter: 'blur(6px)' },
            visible: { opacity: 1, y: 0, filter: 'blur(0px)',
              transition: { duration: 0.48, ease: EASE } },
          }}
          style={{
            fontSize: 'clamp(42px, 7vw, 84px)',
            fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05,
            color: 'var(--gray-900)',
            marginBottom: 24,
          }}
        >
          Know your body.<br />
          <span style={{ color: 'var(--teal-500)' }}>Upgrade your life.</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p variants={childVariants} style={{
          fontSize: 'clamp(16px, 2.5vw, 19px)', color: 'var(--gray-500)',
          maxWidth: 580, margin: '0 auto 12px',
          lineHeight: 1.6,
        }}>
          Upload any lab result and receive an AI-powered analysis of 50+ biomarkers, red flags, and a personalized protocol in seconds.
        </motion.p>
        <motion.p variants={childVariants} style={{
          fontSize: 'clamp(14px, 2vw, 17px)', color: 'var(--gray-400)',
          maxWidth: 560, margin: '0 auto 40px',
          lineHeight: 1.6,
        }}>
          Timeline tracking, weekly check-ins, and practitioner CRM — everything in one place.
        </motion.p>

        {/* CTA row */}
        <motion.div
          variants={childVariants}
          className="hero-cta-row"
          style={{
            display: 'flex', gap: 16, justifyContent: 'center',
            flexWrap: 'wrap', marginBottom: 40,
          }}
        >
          <motion.button
            onClick={() => navigate('/login?signup=true')}
            aria-label="Start free — no card needed"
            className="btn-primary hero-cta-primary"
            {...buttonHoverProps}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--teal-800)', color: 'white',
              border: 'none', borderRadius: 980,
              padding: '16px 36px', fontSize: 17, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Start Free — No card required <ArrowRight size={16} aria-hidden="true" />
          </motion.button>
          <motion.button
            onClick={() => setPreviewOpen(true)}
            className="hero-cta-secondary"
            {...buttonHoverProps}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'transparent',
              border: '1.5px solid var(--gray-300)',
              borderRadius: 980, padding: '16px 28px', fontSize: 17,
              color: 'var(--gray-700)', cursor: 'pointer',
            }}
          >
            See how it works <ArrowRight size={16} aria-hidden="true" />
          </motion.button>
        </motion.div>

        {/* Social proof */}
        <motion.div
          variants={childVariants}
          className="hero-proof-row"
          style={{
            display: 'flex', gap: 20, justifyContent: 'center',
            alignItems: 'center', flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            <span style={{ color: 'var(--teal-500)' }}>★★★★★</span> 4.9 early-user rating
          </span>
          <span aria-hidden="true" className="hero-proof-divider" style={{ width: '0.5px', height: 16, background: 'var(--gray-100)', display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Works with any laboratory worldwide</span>
          <span aria-hidden="true" className="hero-proof-divider" style={{ width: '0.5px', height: 16, background: 'var(--gray-100)', display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Shield size={12} aria-hidden="true" /> Secure. Private. Privacy-first by design.
          </span>
        </motion.div>

      </motion.div>

      <CabinetPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} reduced={reduced} />
    </section>
  )
}
