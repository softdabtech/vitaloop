import { AlertCircle, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react'
import { useState, useEffect } from 'react'
import { generateHealthTips, filterTipsByCategory, sortTipsByDifficulty } from '../lib/ai-health-tips'

export default function HealthTipsDisplay({ biomarkers, userContext }) {
  const [tips, setTips] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [expandedTip, setExpandedTip] = useState(null)
  const biomarkersKey = JSON.stringify((biomarkers || []).map((b) => ({
    name: b?.name,
    value: b?.value,
    status: b?.status,
    category: b?.category,
  })))
  const userContextKey = JSON.stringify({
    age: userContext?.age,
    lifestyle: userContext?.lifestyle,
    goals: userContext?.goals,
    compliance: userContext?.protocol_adherence,
  })

  useEffect(() => {
    async function loadTips() {
      setLoading(true)
      try {
        const generatedTips = await generateHealthTips(biomarkers, userContext)
        setTips(sortTipsByDifficulty(generatedTips))
      } catch (error) {
        console.error('Failed to load health tips:', error)
      } finally {
        setLoading(false)
      }
    }

    if (biomarkers?.length > 0) {
      loadTips()
    }
  }, [biomarkersKey, userContextKey])

  const categories = ['all', 'nutrition', 'exercise', 'sleep', 'stress', 'supplement']
  const filteredTips = selectedCategory === 'all'
    ? tips
    : filterTipsByCategory(tips, selectedCategory)

  if (loading) {
    return (
      <div style={{
        padding: '24px',
        background: '#f8fafc',
        borderRadius: '12px',
        textAlign: 'center',
        color: '#64748b'
      }}>
        Loading personalized health tips...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Lightbulb size={20} style={{ color: '#f59e0b' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Personalized Health Tips
          </h2>
        </div>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          AI-generated recommendations based on your biomarkers
        </p>
      </div>

      {/* Category Filter */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '16px'
      }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: selectedCategory === cat ? '2px solid #10b981' : '1px solid #e2e8f0',
              background: selectedCategory === cat ? '#f0fdf4' : '#fff',
              color: selectedCategory === cat ? '#059669' : '#64748b',
              fontWeight: selectedCategory === cat ? 600 : 500,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 200ms'
            }}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Tips List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredTips.length === 0 ? (
          <div style={{
            padding: '24px',
            background: '#f8fafc',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '14px'
          }}>
            No tips in this category yet
          </div>
        ) : (
          filteredTips.map((tip) => {
            const isExpanded = expandedTip === tip.id
            const difficultyColor = {
              easy: '#dcfce7',
              medium: '#fef3c7',
              hard: '#fee2e2'
            }
            const difficultyTextColor = {
              easy: '#166534',
              medium: '#92400e',
              hard: '#991b1b'
            }

            return (
              <div
                key={tip.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#fff'
                }}
              >
                <button
                  onClick={() => setExpandedTip(isExpanded ? null : tip.id)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: 'none',
                    background: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    textAlign: 'left'
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    fontSize: '24px',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    {tip.icon || '💡'}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                        {tip.title}
                      </div>
                      <span style={{
                        padding: '2px 8px',
                        background: difficultyColor[tip.difficulty],
                        color: difficultyTextColor[tip.difficulty],
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}>
                        {tip.difficulty}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
                      {tip.description}
                    </div>
                    {tip.estimatedTime && (
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                        ⏱️ {tip.estimatedTime}
                      </div>
                    )}
                  </div>

                  {/* Toggle Icon */}
                  <div style={{ color: '#94a3b8', flexShrink: 0, marginTop: '2px' }}>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{
                    padding: '0 16px 16px 52px',
                    borderTop: '1px solid #f1f5f9',
                    background: '#f8fafc'
                  }}>
                    {tip.evidence && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                          Evidence
                        </div>
                        <div style={{ fontSize: '13px', color: '#475569' }}>
                          {tip.evidence}
                        </div>
                      </div>
                    )}

                    {tip.actionItems && tip.actionItems.length > 0 && (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                          Action Items
                        </div>
                        <ul style={{
                          margin: 0,
                          paddingLeft: '20px',
                          fontSize: '13px',
                          color: '#475569',
                          lineHeight: 1.6
                        }}>
                          {tip.actionItems.map((item, idx) => (
                            <li key={idx} style={{ marginBottom: '4px' }}>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {tip.relatedBiomarkers && tip.relatedBiomarkers.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                          Related Biomarkers
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {tip.relatedBiomarkers.map((biomarker, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: '4px 10px',
                                background: '#dbeafe',
                                color: '#0369a1',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 500
                              }}
                            >
                              {biomarker}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
