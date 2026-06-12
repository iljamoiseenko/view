import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './LoginPage.css'

export default function LoginPage() {
  const { login, currentUser } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (currentUser) {
    return <Navigate to={currentUser.role === 'superadmin' ? '/admin' : '/venue'} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      navigate(user.role === 'superadmin' ? '/admin' : '/venue', { replace: true })
    } catch (err) {
      setError(err.message || 'Невірний email або пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-box__logo">VIEW</div>
        <h1 className="login-box__title">Вхід в акаунт</h1>
        <p className="login-box__sub">Для власників закладів та адміністраторів</p>

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

          <div className="login-field">
            <label className="login-label">Пароль</label>
            <input
              className={`input ${error ? 'input--error' : ''}`}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="btn btn-dark login-submit" disabled={loading}>
            {loading ? 'Входимо...' : 'Увійти'}
          </button>
        </form>

        <div className="login-footer-links">
          <a href="/forgot-password" className="login-forgot">Забув пароль?</a>
          <span className="login-footer-sep">·</span>
          <a href="/register" className="login-forgot">Зареєструватися</a>
        </div>
      </div>
    </div>
  )
}
