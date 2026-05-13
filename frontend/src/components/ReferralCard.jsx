import { Copy, Zap, Gift } from 'lucide-react'
import { useState } from 'react'

export default function ReferralCard({ referralCode, rewards, userName }) {
  const [copied, setCopied] = useState(false)

  const referralLink = `https://vitaloop.today/join?ref=${referralCode}`
  const shareText = `Join me on VITALOOP! Use code ${referralCode} and we both get rewards! 🎁`

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
      borderRadius: '16px',
      padding: '32px',
      color: '#fff',
      maxWidth: '600px',
    }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
          💜 Invite Friends & Earn Rewards
        </h2>
        <p style={{ fontSize: '14px', opacity: 0.9 }}>
          Share your referral code and get points for every friend that joins
        </p>
      </div>

      {/* Code Box */}
      <div style={{
        background: 'rgba(255,255,255,0.15)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px' }}>Your Referral Code</div>
        <div style={{
          fontSize: '32px',
          fontWeight: 900,
          letterSpacing: '2px',
          marginBottom: '12px',
          fontFamily: 'monospace',
        }}>
          {referralCode}
        </div>
        <button
          onClick={copyLink}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <Copy size={14} /> {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>

      {/* Reward Tiers */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '12px', opacity: 0.9 }}>
          💰 Earn Points When Your Friends:
        </div>
        <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={16} /> Sign up with your code → <strong>100 pts</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={16} /> Complete onboarding → <strong>200 pts</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={16} /> Upload first lab report → <strong>500 pts</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gift size={16} /> Refer 5+ people → <strong>1,000 pts bonus</strong>
          </div>
        </div>
      </div>

      {/* Current Rewards */}
      {rewards && (
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
        }}>
          <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px' }}>Your Points</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>
                {rewards.earnedRewards}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.7 }}>earned</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>
                {rewards.pendingRewards}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.7 }}>pending</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>
                {rewards.totalRewards}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.7 }}>total</div>
            </div>
          </div>
        </div>
      )}

      {/* Share Buttons */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText + ' ' + referralLink)}`, '_blank')}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            borderRadius: '8px',
            padding: '10px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          📱 Twitter
        </button>

        <button
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + referralLink)}`, '_blank')}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            borderRadius: '8px',
            padding: '10px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          💬 WhatsApp
        </button>
      </div>
    </div>
  )
}
