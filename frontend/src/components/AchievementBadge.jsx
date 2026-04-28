export default function AchievementBadge({ achievement, size = 'medium' }) {
  const sizes = {
    small: { container: 60, icon: 24, text: 10 },
    medium: { container: 100, icon: 40, text: 12 },
    large: { container: 140, icon: 56, text: 14 },
  }

  const sizeConfig = sizes[size]
  const isLocked = !achievement.unlocked

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
    }}>
      <div style={{
        width: sizeConfig.container,
        height: sizeConfig.container,
        borderRadius: '50%',
        background: isLocked
          ? 'linear-gradient(135deg, #e2e8f0, #cbd5e1)'
          : 'linear-gradient(135deg, #10b981, #059669)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: sizeConfig.icon,
        boxShadow: isLocked
          ? '0 4px 12px rgba(0,0,0,0.08)'
          : '0 8px 24px rgba(16,185,129,0.3)',
        position: 'relative',
        opacity: isLocked ? 0.5 : 1,
      }}>
        {achievement.icon}

        {achievement.unlocked && (
          <div style={{
            position: 'absolute',
            bottom: '-4px',
            right: '-4px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
          }}>
            ✓
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', width: sizeConfig.container + 20 }}>
        <div style={{
          fontSize: sizeConfig.text,
          fontWeight: 700,
          color: '#0f172a',
          marginBottom: '2px',
        }}>
          {achievement.name}
        </div>
        {size !== 'small' && (
          <div style={{
            fontSize: sizeConfig.text - 2,
            color: '#64748b',
            lineHeight: 1.3,
          }}>
            {achievement.description}
          </div>
        )}
      </div>

      {achievement.progress !== undefined && achievement.target && (
        <div style={{
          width: '100%',
          maxWidth: '140px',
          height: '4px',
          borderRadius: '2px',
          background: '#e2e8f0',
          overflow: 'hidden',
        }}>
          <div
            style={{
              height: '100%',
              background: '#10b981',
              width: `${Math.min((achievement.progress / achievement.target) * 100, 100)}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}
    </div>
  )
}
