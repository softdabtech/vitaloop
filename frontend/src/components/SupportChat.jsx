import { useState, useRef, useEffect } from 'react'
import { X, Send } from 'lucide-react'

const QUICK_QUESTIONS = [
  'How does the AI analysis work?',
  'Which labs are supported?',
  'Is my data secure?',
  'How much does it cost?',
  'Can I cancel anytime?',
]

const AUTO_ANSWERS = {
  'How does the AI analysis work?':
    'You upload a PDF or photo of your blood test. Our browser-based OCR extracts all biomarkers, then Claude AI classifies each one and generates a personalized supplement protocol. Takes about 60 seconds.',
  'Which labs are supported?':
    'Any lab worldwide - Quest, LabCorp, SonoHealth in the US, Synlab and Eurofins in Europe, and any private lab PDF in any language.',
  'Is my data secure?':
    'Your PDF never leaves your device - OCR runs 100% in your browser. Only the extracted text values are stored, encrypted in our database. You can delete your data anytime.',
  'How much does it cost?':
    'Free plan to try: upload 1 lab and see basic results. Core plan is $29/month with unlimited uploads, full protocol, and progress tracking. Cancel anytime.',
  'Can I cancel anytime?':
    'Yes, 1-click cancellation from your account settings. No questions asked, no fees.',
}

const FALLBACK = 'Great question - our team will get back to you within a few hours. You can also email us at hello@vitaloop.com'

export default function SupportChat({ onClose }) {
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: 'Hi! How can I help you today? Choose a question or type your own.',
    },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = (text) => {
    if (!text.trim()) return
    const userMsg = { from: 'user', text: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setTyping(true)

    setTimeout(() => {
      const answer = AUTO_ANSWERS[text.trim()] || FALLBACK
      setMessages((prev) => [...prev, { from: 'bot', text: answer }])
      setTyping(false)
    }, 800)
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 3000,
      width: 360, maxHeight: 520,
      background: '#ffffff',
      borderRadius: 20,
      border: '0.5px solid var(--gray-100)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--teal-800,#085041)', padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--teal-500,#1D9E75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" fill="rgba(255,255,255,0.2)"/>
              <path d="M4 14h4l2-6 4 12 2-7 2 4h6" stroke="white"
                    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>VITALOOP Support</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6,
                borderRadius: '50%', background: '#4ade80',
                marginRight: 4, verticalAlign: 'middle',
              }}/>
              Online - usually replies in minutes
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.1)', border: 'none',
            borderRadius: '50%', width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'white',
          }}
        >
          <X size={14}/>
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '80%',
              background: m.from === 'user' ? 'var(--teal-800,#085041)' : 'var(--gray-50,#f5f5f7)',
              color: m.from === 'user' ? 'white' : 'var(--gray-900,#1d1d1f)',
              borderRadius: m.from === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: '10px 14px',
              fontSize: 14, lineHeight: 1.55,
            }}>
              {m.text}
            </div>
          </div>
        ))}

        {typing && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              background: 'var(--gray-50,#f5f5f7)',
              borderRadius: '16px 16px 16px 4px',
              padding: '10px 16px',
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--gray-300,#aeaeb2)',
                  animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                }}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Quick questions */}
      {messages.length === 1 && (
        <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              style={{
                background: 'none',
                border: '0.5px solid var(--gray-100,#d2d2d7)',
                borderRadius: 10, padding: '8px 12px',
                textAlign: 'left', fontSize: 13,
                color: 'var(--gray-700,#3d3d3f)',
                cursor: 'pointer', transition: 'border-color 150ms, background 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--teal-500,#1D9E75)'
                e.currentTarget.style.background = 'var(--teal-50,#E1F5EE)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--gray-100,#d2d2d7)'
                e.currentTarget.style.background = 'none'
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: '0.5px solid var(--gray-100,#d2d2d7)',
        display: 'flex', gap: 8,
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
          placeholder="Type a question..."
          style={{
            flex: 1, border: '0.5px solid var(--gray-100,#d2d2d7)',
            borderRadius: 10, padding: '9px 14px',
            fontSize: 14, color: 'var(--gray-900,#1d1d1f)',
            background: 'var(--gray-50,#f5f5f7)',
            outline: 'none',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--teal-500,#1D9E75)' }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--gray-100,#d2d2d7)' }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim()}
          style={{
            background: 'var(--teal-800,#085041)', color: 'white',
            border: 'none', borderRadius: 10,
            width: 36, height: 36, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            opacity: input.trim() ? 1 : 0.4,
            transition: 'opacity 200ms',
          }}
        >
          <Send size={14}/>
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
