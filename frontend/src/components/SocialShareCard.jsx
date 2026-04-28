import { Download, Share2, Twitter, Linkedin, MessageCircle } from 'lucide-react'
import { useState } from 'react'

export default function SocialShareCard({ metrics, userName = 'You', resultDate }) {
  const [copied, setCopied] = useState(false)

  const improving = metrics.improving || 0
  const declining = metrics.declining || 0
  const score = metrics.score || 78

  const shareText = `I just tracked my health with @VITALOOP! 💪
📊 Score: ${score}/100
📈 Improving: ${improving} biomarkers
Comparing my progress over time. #HealthOptimization #Biohacking`

  const shareUrl = `https://vitaloop.today/results/${metrics.uploadId}`

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      borderRadius: '16px',
      padding: '32px',
      color: '#fff',
      maxWidth: '600px',
      boxShadow: '0 20px 40px rgba(16,185,129,0.3)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>📊 Health Progress</div>
          <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }}>VITALOOP</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '12px', opacity: 0.8 }}>
          {resultDate}
        </div>
      </div>

      {/* Main Score */}
      <div style={{
        background: 'rgba(255,255,255,0.15)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '8px' }}>Health Score</div>
        <div style={{ fontSize: '48px', fontWeight: 900, marginBottom: '4px' }}>{score}</div>
        <div style={{ fontSize: '12px', opacity: 0.8 }}>/100</div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '10px',
          padding: '16px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>Improving</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>+{improving}</div>
          <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>biomarkers ↑</div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '10px',
          padding: '16px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>Stable</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{metrics.stable || 0}</div>
          <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>biomarkers →</div>
        </div>
      </div>

      {/* Message */}
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '10px',
        padding: '16px',
        marginBottom: '24px',
        fontSize: '14px',
        fontStyle: 'italic',
      }}>
        "Tracking my health progress with AI-powered biomarker analysis. Optimizing my wellness journey!" 🎯
      </div>

      {/* Share Buttons */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${shareUrl}`, '_blank')}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            borderRadius: '8px',
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          <Twitter size={16} /> Twitter
        </button>

        <button
          onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`, '_blank')}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            borderRadius: '8px',
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          <Linkedin size={16} /> LinkedIn
        </button>

        <button
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`, '_blank')}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            borderRadius: '8px',
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          <MessageCircle size={16} /> WhatsApp
        </button>

        <button
          onClick={copyToClipboard}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            borderRadius: '8px',
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          <Share2 size={16} /> {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
