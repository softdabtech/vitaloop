import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Shield, Activity, Zap, FlaskConical, BarChart2, Heart, Droplets, ScanLine, ClipboardList, CheckCircle2, FileText, Upload, X } from 'lucide-react'
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
    title: 'Lab results become readable',
    body: 'The Lab Results page turns raw values into ranges, biomarker context, and actionable interpretation.',
    accent: '#0f766e',
    status: 'Results interpreted',
    metrics: [
      { label: 'Biomarkers interpreted', value: '54' },
      { label: 'Priority flags', value: '3' },
      { label: 'Insight cards', value: '5' },
    ],
  },
  {
    title: 'Assignments and check-ins activate',
    body: 'Assignments and weekly check-ins keep the protocol alive between uploads.',
    accent: '#0e7490',
    status: 'Weekly guidance ready',
    metrics: [
      { label: 'Active assignments', value: '4' },
      { label: 'Check-in adherence', value: '5/5' },
      { label: 'Next action', value: 'Retest iron' },
    ],
  },
  {
    title: 'Progress trend closes the loop',
    body: 'Progress and timeline views show what changed and what to do in the next cycle.',
    accent: '#0f766e',
    status: 'Trend updated',
    metrics: [
      { label: 'Trend movement', value: '+12' },
      { label: 'Health score', value: '78' },
      { label: 'Completed tasks', value: '9' },
    ],
  },
]

export function CabinetPreviewModal({ open, onClose, reduced }) {
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
                    {[Upload, FileText, ClipboardList, BarChart2].map((Icon, index) => (
                      <motion.div
                        key={index}
                        animate={{
                          scale: stepIndex === index ? 1.04 : 1,
                          backgroundColor: stepIndex === index ? 'rgba(29,158,117,0.12)' : 'rgba(248,250,252,1)',
                          borderColor: stepIndex === index ? 'rgba(29,158,117,0.35)' : 'rgba(148,163,184,0.12)',
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
                            {[0, 1, 2, 3].map((row) => (
                              <div key={row} style={{ borderRadius: 16, background: row === stepIndex ? `${activeStep.accent}10` : 'var(--gray-50)', border: `1px solid ${row === stepIndex ? `${activeStep.accent}35` : 'rgba(148,163,184,0.12)'}`, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)' }}>
                                    {row === 0 ? 'Upload labs' : row === 1 ? 'Lab results interpretation' : row === 2 ? 'Assignments and check-ins' : 'Progress and timeline'}
                                  </div>
                                  <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>
                                    {row === 0 ? 'PDF upload and biomarker extraction' : row === 1 ? 'Ranges, red flags, and result context' : row === 2 ? 'Protocol tasks, adherence, and follow-up' : 'Score movement and historical events'}
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
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)' }}>Your cabinet — live in seconds after your first upload</div>
                        <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>Every biomarker extracted, ranked, and explained — no manual entry needed.</div>
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
      {/* Новый SVG-баннер */}
      <img
        src="/mockups/hero-2026.svg"
        alt="VITALOOP premium dashboard hero banner"
        style={{
          width: '100%',
          maxWidth: 1200,
          height: 'auto',
          borderRadius: 32,
          boxShadow: '0 8px 48px rgba(16,24,32,0.18)',
          margin: '0 auto',
          display: 'block',
        }}
        draggable={false}
      />

      {/* CTA row под картинкой */}
      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <button
          onClick={() => navigate('/login?signup=true')}
          aria-label="Start free — no card needed"
          className="btn-primary hero-cta-primary"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--teal-800)', color: 'white',
            border: 'none', borderRadius: 980,
            padding: '16px 36px', fontSize: 17, fontWeight: 600,
            cursor: 'pointer', marginRight: 16,
          }}
        >
          Start Free — No card required <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button
          onClick={() => setPreviewOpen(true)}
          className="hero-cta-secondary"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'transparent',
            border: '1.5px solid var(--gray-300)',
            borderRadius: 980, padding: '16px 28px', fontSize: 17,
            color: 'var(--gray-700)', cursor: 'pointer',
          }}
        >
          See how it works <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>

      <CabinetPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} reduced={reduced} />
    </section>
  )
}
