

export default function FriendComparison({ friend, currentUser }) {
  const friendScore = friend.score || 0
  const yourScore = currentUser.score || 0
  const scoreDiff = Math.abs(friendScore - yourScore)
  const friendAhead = friendScore > yourScore

  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      padding: '16px',
      display: 'flex',
      gap: '16px',
      alignItems: 'center',
    }}>
      {/* Friend Avatar */}
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${friend.avatarGradient?.[0] || '#10b981'}, ${friend.avatarGradient?.[1] || '#059669'})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '20px',
        fontWeight: 700,
        flexShrink: 0,
      }}>
        {friend.userName.charAt(0).toUpperCase()}
      </div>

      {/* Friend Info */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
          {friend.userName}
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748b' }}>
          <span>Score: <strong>{friendScore}</strong></span>
          <span>•</span>
          <span>Uploads: <strong>{friend.uploadCount || 0}</strong></span>
          <span>•</span>
          <span>Streak: <strong>{friend.streak || 0}🔥</strong></span>
        </div>
      </div>

      {/* Comparison */}
      <div style={{
        textAlign: 'center',
        padding: '12px 16px',
        borderRadius: '8px',
        background: friendAhead ? '#fecaca' : '#dcfce7',
        minWidth: '80px',
      }}>
        <div style={{
          fontSize: '12px',
          color: friendAhead ? '#991b1b' : '#166534',
          fontWeight: 600,
          marginBottom: '4px',
        }}>
          {friendAhead ? 'Ahead' : 'Behind'}
        </div>
        <div style={{
          fontSize: '18px',
          fontWeight: 700,
          color: friendAhead ? '#dc2626' : '#16a34a',
        }}>
          {scoreDiff}
        </div>
        <div style={{ fontSize: '10px', color: friendAhead ? '#7f1d1d' : '#166534' }}>
          points
        </div>
      </div>

      {/* Action */}
      <button
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#64748b',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
        }}
      >
        ⋮
      </button>
    </div>
  )
}
