import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch() {
    // noop: avoid noisy console in production, use external monitoring if configured
  }

  handleReload = () => {
    window.location.reload()
  }

  handleHome = () => {
    window.location.assign('/')
  }

  isUkrainianLocale = () => {
    if (typeof window === 'undefined') return false
    const host = window.location.hostname.toLowerCase()
    const search = window.location.search.toLowerCase()
    const stored = window.localStorage?.getItem('vitaloop:locale') || ''
    return host === 'ua.vitaloop.today' || search.includes('locale=uk') || search.includes('lang=uk') || stored.startsWith('uk')
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const isUk = this.isUkrainianLocale()
    const copy = isUk
      ? {
          title: 'Щось пішло не так',
          body: 'Оновіть застосунок. Якщо проблема повториться, поверніться на головну і увійдіть ще раз.',
          reload: 'Оновити',
          home: 'На головну',
        }
      : {
          title: 'Something went wrong',
          body: 'Please reload the app. If the issue persists, return to home and sign in again.',
          reload: 'Reload',
          home: 'Go Home',
        }

    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0a0a0a', color: '#fff', padding: 24 }}>
        <div style={{ maxWidth: 460, width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>{copy.title}</h1>
          <p style={{ margin: '10px 0 20px', color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
            {copy.body}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={this.handleReload} style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>
              {copy.reload}
            </button>
            <button onClick={this.handleHome} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>
              {copy.home}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
