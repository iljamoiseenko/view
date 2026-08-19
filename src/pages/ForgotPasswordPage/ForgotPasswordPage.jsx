import { useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'

export default function ForgotPasswordPage() {
  const { t } = useLanguage()
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('forgotPassword.errorDefault'))
      }
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-box__logo">VIEW</div>
        <h1 className="login-box__title">{t('forgotPassword.title')}</h1>
        <p className="login-box__sub">{t('forgotPassword.sub')}</p>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{t('forgotPassword.sentTitle')}</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('forgotPassword.sentText', email)}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label className="login-label">{t('forgotPassword.email')}</label>
              <input
                className={`input ${error ? 'input--error' : ''}`}
                type="email"
                placeholder="your@email.ua"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                required
                autoComplete="email"
              />
            </div>
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="btn btn-dark login-submit" disabled={loading}>
              {loading ? t('forgotPassword.sending') : t('forgotPassword.submit')}
            </button>
          </form>
        )}

        <div className="login-footer-links" style={{ marginTop: 16 }}>
          <a href="/login" className="login-forgot">{t('forgotPassword.backToLogin')}</a>
        </div>
      </div>
    </div>
  )
}
