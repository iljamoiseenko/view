import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import './LoginPage.css'

export default function LoginPage() {
  const { login, currentUser } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
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
      const user = await login(username, password)
      navigate(user.role === 'superadmin' ? '/admin' : '/venue', { replace: true })
    } catch (err) {
      setError(err.message || t('login.errorDefault'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-box__logo">VIEW</div>
        <h1 className="login-box__title">{t('login.title')}</h1>
        <p className="login-box__sub">{t('login.sub')}</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label className="login-label">{t('login.login')}</label>
            <input
              className={`input ${error ? 'input--error' : ''}`}
              type="text"
              placeholder={t('login.loginPlaceholder')}
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              required
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label className="login-label">{t('login.password')}</label>
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
            {loading ? t('login.submitting') : t('login.submit')}
          </button>
        </form>

        <div className="login-footer-links">
          <a href="/forgot-password" className="login-forgot">{t('login.forgot')}</a>
          <span className="login-footer-sep">·</span>
          <a href="/register" className="login-forgot">{t('login.register')}</a>
        </div>
      </div>
    </div>
  )
}
