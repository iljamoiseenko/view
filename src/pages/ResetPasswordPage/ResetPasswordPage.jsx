import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function ResetPasswordPage() {
  const [searchParams]        = useSearchParams()
  const token                 = searchParams.get('token') || ''
  const navigate              = useNavigate()
  const [password, setPassword]   = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [done, setDone]           = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== password2) return setError('Паролі не співпадають')
    if (password.length < 6)    return setError('Мінімум 6 символів')
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Помилка')
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-box">
          <p className="login-error">Невірне або відсутнє посилання для скидання пароля.</p>
          <a href="/forgot-password" className="login-forgot" style={{ marginTop: 12, display: 'block', textAlign: 'center' }}>Запросити нове</a>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-box__logo">VIEW</div>
        <h1 className="login-box__title">Новий пароль</h1>
        <p className="login-box__sub">Введіть новий пароль для вашого акаунту</p>

        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Пароль змінено!</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Переходимо до входу...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label className="login-label">Новий пароль</label>
              <input
                className={`input ${error ? 'input--error' : ''}`}
                type="password"
                placeholder="мінімум 6 символів"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                required
              />
            </div>
            <div className="login-field">
              <label className="login-label">Повторіть пароль</label>
              <input
                className={`input ${error ? 'input--error' : ''}`}
                type="password"
                placeholder="••••••••"
                value={password2}
                onChange={e => { setPassword2(e.target.value); setError('') }}
                required
              />
            </div>
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="btn btn-dark login-submit" disabled={loading}>
              {loading ? 'Зберігаємо...' : 'Зберегти пароль'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
