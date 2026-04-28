import { Trophy, TrendingUp, Flame } from 'lucide-react'

export default function Leaderboard({ users = [], currentUserId, variant = 'global' }) {
  const sortedUsers = [...users].sort((a, b) => (b.score || 0) - (a.score || 0))
  const currentUserRank = sortedUsers.findIndex(u => u.id === currentUserId) + 1

  const getMedalColor = (rank) => {
    if (rank === 1) return '#FFD700'
    if (rank === 2) return '#C0C0C0'
    if (rank === 3) return '#CD7F32'
    return '#64748b'
  }

  const getMedal = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return rank
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Header with variant tabs */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        borderBottom: '1px solid #e2e8f0',
      }}>
        <button
          onClick={() => {}}
          style={{
            padding: '12px 16px',
            background: variant === 'global' ? '#10b981' : 'transparent',
            color: variant === 'global' ? '#fff' : '#64748b',
            border: 'none',
            borderBottom: variant === 'global' ? '2px solid #10b981' : 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Trophy size={16} /> Global
        </button>
        <button
          onClick={() => {}}
          style={{
            padding: '12px 16px',
            background: variant === 'friends' ? '#10b981' : 'transparent',
            color: variant === 'friends' ? '#fff' : '#64748b',
            border: 'none',
            borderBottom: variant === 'friends' ? '2px solid #10b981' : 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          👥 Friends
        </button>
        <button
          onClick={() => {}}
          style={{
            padding: '12px 16px',
            background: variant === 'weekly' ? '#10b981' : 'transparent',
            color: variant === 'weekly' ? '#fff' : '#64748b',
            border: 'none',
            borderBottom: variant === 'weekly' ? '2px solid #10b981' : 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Flame size={16} /> This Week
        </button>
      </div>

      {/* Current User Badge */}
      {currentUserRank <= 10 && (
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dbeafe 100%)',
          border: '2px solid #10b981',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
        }}>
          <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600, marginBottom: '4px' }}>
            🎯 Your Position
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
                #{currentUserRank}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {sortedUsers[currentUserRank - 1]?.userName || 'You'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#10b981' }}>
                {sortedUsers[currentUserRank - 1]?.score || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>points</div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        {sortedUsers.slice(0, 10).map((user, idx) => {
          const rank = idx + 1
          const isCurrentUser = user.id === currentUserId

          return (
            <div
              key={user.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                borderBottom: '1px solid #f1f5f9',
                background: isCurrentUser ? '#f0fdf4' : '#fff',
              }}
            >
              {/* Rank */}
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: rank <= 3 ? `${getMedalColor(rank)}20` : '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 700,
                color: getMedalColor(rank),
              }}>
                {getMedal(rank)}
              </div>

              {/* User Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                  {user.userName}
                  {isCurrentUser && <span style={{ fontSize: '12px', color: '#10b981' }}> (You)</span>}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Score: <strong>{user.score}</strong>
                </div>
              </div>

              {/* Stats */}
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  color: '#10b981',
                  fontWeight: 600,
                  marginBottom: '4px',
                }}>
                  <TrendingUp size={12} /> {user.improving || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {user.uploadCount || 0} uploads
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Info */}
      <div style={{
        marginTop: '20px',
        padding: '12px',
        background: '#f8fafc',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#64748b',
      }}>
        💡 Compete with friends, earn achievements, and track your progress over time.
        Sharing isn't about competition — it's about accountability and motivation!
      </div>
    </div>
  )
}
