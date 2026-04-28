import { Upload } from 'lucide-react'

export default function EmptyState({ icon: Icon = Upload, title, description, action, actionText = 'Get started' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      textAlign: 'center',
      minHeight: '400px',
    }}>
      {Icon && <Icon size={64} style={{ color: '#cbd5e1', marginBottom: '24px' }} />}
      <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px', maxWidth: '400px' }}>
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action}
          style={{
            background: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          {actionText}
        </button>
      )}
    </div>
  )
}
