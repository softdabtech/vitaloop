import { useState } from 'react'
import { X, Copy, Trash2, Clock, Mail } from 'lucide-react'
import { shareToPractitioner, getPractitionerShares, revokePractitionerAccess } from '../lib/practitioner-sharing'

export default function PractitionerShareModal({ uploadId, isOpen, onClose }) {
  const [shares, setShares] = useState([])
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [accessLevel, setAccessLevel] = useState('view')
  const [expiresInDays, setExpiresInDays] = useState(30)
  const [message, setMessage] = useState('')

  const loadShares = async () => {
    try {
      setLoading(true)
      const practitionerShares = await getPractitionerShares(uploadId)
      setShares(practitionerShares)
    } catch (err) {
      setMessage('Failed to load shares')
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async (e) => {
    e.preventDefault()
    if (!email || !name) {
      setMessage('Please enter practitioner email and name')
      return
    }

    try {
      setLoading(true)
      await shareToPractitioner(uploadId, email, name, accessLevel, expiresInDays)
      setMessage('Share link created successfully!')
      setEmail('')
      setName('')
      setAccessLevel('view')
      setExpiresInDays(30)
      await loadShares()
    } catch (err) {
      setMessage('Failed to create share link')
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async (shareId) => {
    if (!window.confirm('Revoke access to this practitioner?')) return

    try {
      setLoading(true)
      await revokePractitionerAccess(shareId)
      setShares(shares.filter(s => s.id !== shareId))
      setMessage('Access revoked')
    } catch (err) {
      setMessage('Failed to revoke access')
    } finally {
      setLoading(false)
    }
  }

  const copyShareLink = (token) => {
    const shareUrl = `${window.location.origin}/share/${token}`
    navigator.clipboard.writeText(shareUrl)
    setMessage('Share link copied to clipboard!')
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        padding: '24px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Share with Practitioners
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px',
              display: 'flex'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            padding: '12px 16px',
            background: message.includes('Failed') ? '#fee2e2' : '#dcfce7',
            border: `1px solid ${message.includes('Failed') ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: '8px',
            fontSize: '14px',
            color: message.includes('Failed') ? '#991b1b' : '#166534',
            marginBottom: '16px'
          }}>
            {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleShare} style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#0f172a',
              marginBottom: '6px'
            }}>
              Practitioner Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Dr. Smith"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#0f172a',
              marginBottom: '6px'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="doctor@example.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#0f172a',
              marginBottom: '6px'
            }}>
              Access Level
            </label>
            <select
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            >
              <option value="view">View Only</option>
              <option value="comment">View + Comment</option>
              <option value="export">Full Access (View, Comment, Export)</option>
            </select>
            <div style={{
              fontSize: '12px',
              color: '#64748b',
              marginTop: '6px'
            }}>
              {accessLevel === 'view' && 'Practitioner can view your results'}
              {accessLevel === 'comment' && 'Practitioner can view and add comments'}
              {accessLevel === 'export' && 'Practitioner can view, comment, and export results'}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#0f172a',
              marginBottom: '6px'
            }}>
              Expires In (days)
            </label>
            <input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              max="365"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 200ms'
            }}
          >
            {loading ? 'Creating...' : 'Create Share Link'}
          </button>
        </form>

        {/* Active Shares */}
        <div>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#0f172a',
            marginBottom: '12px'
          }}>
            Active Shares
          </h3>

          {shares.length === 0 ? (
            <div style={{
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '14px'
            }}>
              No active shares yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {shares.map((share) => {
                const isExpired = new Date(share.expiresAt) < new Date()
                const shareUrl = `${window.location.origin}/share/${share.shareToken}`

                return (
                  <div
                    key={share.id}
                    style={{
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: '#fff'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px'
                    }}>
                      <Mail size={16} style={{ color: '#10b981' }} />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                          {share.practitionerName}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {share.practitionerEmail}
                        </div>
                      </div>
                      <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b' }}>
                        {share.accessLevel.charAt(0).toUpperCase() + share.accessLevel.slice(1)}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      marginBottom: '8px',
                      padding: '8px',
                      background: '#f8fafc',
                      borderRadius: '6px',
                      overflow: 'hidden'
                    }}>
                      <code style={{
                        fontSize: '11px',
                        color: '#64748b',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {shareUrl}
                      </code>
                      <button
                        onClick={() => copyShareLink(share.shareToken)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#10b981',
                          padding: '4px',
                          flexShrink: 0
                        }}
                        title="Copy share link"
                      >
                        <Copy size={16} />
                      </button>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: isExpired ? '#dc2626' : '#64748b',
                      marginBottom: '8px'
                    }}>
                      <Clock size={14} />
                      Expires: {new Date(share.expiresAt).toLocaleDateString()}
                      {isExpired && ' (EXPIRED)'}
                    </div>

                    <button
                      onClick={() => handleRevoke(share.id)}
                      style={{
                        padding: '6px 12px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'opacity 200ms'
                      }}
                      onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                      onMouseLeave={(e) => e.target.style.opacity = '1'}
                    >
                      <Trash2 size={14} />
                      Revoke
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
