import { useState } from 'react'

export default function ForgotPasswordPage() {
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
        throw new Error(data.error || 'Помилка')
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
        <h1 className="login-box__title">Відновлення пароля</h1>
        <p className="login-box__sub">Введіть email — надішлемо посилання для скидання</p>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Перевірте пошту</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Посилання для скидання пароля відправлено на <strong>{email}</strong>. Діє 1 годину.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label className="login-label">Email</label>
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
              {loading ? 'Надсилаємо...' : 'Надіслати посилання'}
            </button>
          </form>
        )}

        <div className="login-footer-links" style={{ marginTop: 16 }}>
          <a href="/login" className="login-forgot">← Назад до входу</a>
        </div>
      </div>
    </div>
  )
}
