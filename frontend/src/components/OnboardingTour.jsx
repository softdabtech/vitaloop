import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

const TOUR_STEPS = [
  {
    target: 'body',
    title: '🔬 Welcome to VITALOOP',
    description: 'Interpret your blood tests with AI and get a personalized health protocol.',
  },
  {
    target: 'body',
    title: '📤 Upload your lab results',
    description: 'Drop any PDF or photo of your blood test. We handle OCR automatically.',
  },
  {
    target: 'body',
    title: '🎯 Get personalized insights',
    description: 'See which biomarkers need attention and get supplement recommendations.',
  },
  {
    target: 'body',
    title: '📊 Track progress over time',
    description: 'Upload multiple results and watch your health trends improve.',
  },
  {
    target: 'body',
    title: '✅ You are all set!',
    description: 'Ready to optimize your health? Upload your first lab result.',
  },
]

export function OnboardingTour() {
  const [currentStep, setCurrentStep] = useState(0)
  const [showTour, setShowTour] = useState(() => {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem('vitaloop-tour-seen') !== 'true'
  })

  if (!showTour) return null

  const step = TOUR_STEPS[currentStep]
  const isLast = currentStep === TOUR_STEPS.length - 1

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem('vitaloop-tour-seen', 'true')
      setShowTour(false)
    } else {
      setCurrentStep(c => c + 1)
    }
  }

  const handleSkip = () => {
    localStorage.setItem('vitaloop-tour-seen', 'true')
    setShowTour(false)
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'flex-end',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px 16px 0 0',
        padding: '32px 24px',
        width: '100%',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
          {step.title}
        </h2>
        <p style={{ fontSize: '15px', color: '#64748b', marginBottom: '24px', lineHeight: 1.6 }}>
          {step.description}
        </p>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <button
            onClick={handleSkip}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Skip
          </button>

          <div style={{ display: 'flex', gap: '6px' }}>
            {TOUR_STEPS.map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: idx === currentStep ? '#10b981' : '#cbd5e1',
                }}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            style={{
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              minHeight: '44px',
            }}
          >
            {isLast ? 'Get Started' : 'Next'}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
