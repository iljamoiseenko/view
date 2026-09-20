import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import '../LoginPage/LoginPage.css'

export default function RegisterGuestPage() {
  const { registerGuest, currentUser } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (currentUser) {
    const redirect = currentUser.role === 'superadmin' ? '/admin' : currentUser.role === 'user' ? '/my-bookings' : '/venue'
    return <Navigate to={redirect} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) return setError(t('registerGuest.errPasswordLen'))
    if (password !== confirm) return setError(t('registerGuest.errPasswordMatch'))

    setLoading(true)
    try {
      await registerGuest({ email: email.trim(), password, name: name.trim() })
      navigate('/my-bookings', { replace: true })
    } catch (err) {
      setError(err.message || t('registerGuest.errDefault'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-box__logo">VIEW</div>
        <h1 className="login-box__title">{t('registerGuest.title')}</h1>
        <p className="login-box__sub">{t('registerGuest.sub')}</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label className="login-label">{t('registerGuest.name')}</label>
            <input
              className="input"
              type="text"
              placeholder={t('registerGuest.namePlaceholder')}
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              autoComplete="name"
            />
          </div>

          <div className="login-field">
            <label className="login-label">{t('registerGuest.email')}</label>
            <input
              className={`input ${error ? 'input--error' : ''}`}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label className="login-label">{t('registerGuest.password')}</label>
            <input
              className={`input ${error ? 'input--error' : ''}`}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="login-field">
            <label className="login-label">{t('registerGuest.confirmPassword')}</label>
            <input
              className={`input ${error ? 'input--error' : ''}`}
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError('') }}
              required
              autoComplete="new-password"
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="btn btn-dark login-submit" disabled={loading}>
            {loading ? t('registerGuest.submitting') : t('registerGuest.submit')}
          </button>
        </form>

        <div className="login-footer-links">
          <span>{t('registerGuest.haveAccount')}</span>
          <Link to="/login" className="login-forgot">{t('login.title')}</Link>
        </div>
      </div>
    </div>
  )
}
