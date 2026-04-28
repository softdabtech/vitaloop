import { X, Share2, Download } from 'lucide-react'
import { useState } from 'react'

export default function AchievementShareModal({ achievement, onClose }) {
  const [copied, setCopied] = useState(false)

  const shareText = `I just unlocked "${achievement.name}" on VITALOOP! 🎉\n${achievement.description}\n\nJoin me on my health optimization journey! 💪`

  const copyShare = async () => {
    await navigator.clipboard.writeText(shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadBadge = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 400
    const ctx = canvas.getContext('2d')

    // Draw background
    const gradient = ctx.createLinearGradient(0, 0, 400, 400)
    gradient.addColorStop(0, '#10b981')
    gradient.addColorStop(1, '#059669')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 400, 400)

    // Draw circle
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.beginPath()
    ctx.arc(200, 150, 80, 0, Math.PI * 2)
    ctx.fill()

    // Draw emoji (using text as fallback)
    ctx.font = 'bold 100px Arial'
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.fillText(achievement.icon, 200, 180)

    // Draw name
    ctx.font = 'bold 24px Arial'
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.fillText(achievement.name, 200, 280)

    // Draw description
    ctx.font = '14px Arial'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.textAlign = 'center'
    const words = achievement.description.split(' ')
    let line = ''
    let y = 320

    words.forEach(word => {
      const testLine = line + word + ' '
      if (ctx.measureText(testLine).width > 320) {
        ctx.fillText(line, 200, y)
        line = word + ' '
        y += 18
      } else {
        line = testLine
      }
    })
    ctx.fillText(line, 200, y)

    // Download
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `vitaloop-${achievement.id}.png`
    link.click()
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '500px',
        width: '90vw',
        position: 'relative',
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#64748b',
          }}
        >
          <X size={24} />
        </button>

        {/* Badge */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '60px',
            margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
          }}>
            {achievement.icon}
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Achievement Unlocked! 🎉
          </h2>

          <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#10b981', marginBottom: '8px' }}>
            {achievement.name}
          </h3>

          <p style={{ color: '#64748b', fontSize: '14px' }}>
            {achievement.description}
          </p>
        </div>

        {/* Share section */}
        <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '12px' }}>
            Share Your Achievement
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)} https://vitaloop.today`, '_blank')}
              style={{
                flex: 1,
                background: '#1DA1F2',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              Twitter
            </button>

            <button
              onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=https://vitaloop.today`, '_blank')}
              style={{
                flex: 1,
                background: '#0A66C2',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              LinkedIn
            </button>

            <button
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')}
              style={{
                flex: 1,
                background: '#25D366',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              WhatsApp
            </button>
          </div>

          <button
            onClick={copyShare}
            style={{
              width: '100%',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Share2 size={14} /> {copied ? 'Copied!' : 'Copy Text'}
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={downloadBadge}
            style={{
              flex: 1,
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Download size={16} /> Download Badge
          </button>

          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
