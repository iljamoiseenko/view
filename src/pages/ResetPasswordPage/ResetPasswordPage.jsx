import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'

export default function ResetPasswordPage() {
  const { t } = useLanguage()
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
    if (password !== password2) return setError(t('resetPassword.errMismatch'))
    if (password.length < 6)    return setError(t('resetPassword.errLen'))
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('resetPassword.errDefault'))
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
          <p className="login-error">{t('resetPassword.invalidLink')}</p>
          <a href="/forgot-password" className="login-forgot" style={{ marginTop: 12, display: 'block', textAlign: 'center' }}>{t('resetPassword.requestNew')}</a>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-box__logo">VIEW</div>
        <h1 className="login-box__title">{t('resetPassword.title')}</h1>
        <p className="login-box__sub">{t('resetPassword.sub')}</p>

        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{t('resetPassword.doneTitle')}</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('resetPassword.doneText')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label className="login-label">{t('resetPassword.newPassword')}</label>
              <input
                className={`input ${error ? 'input--error' : ''}`}
                type="password"
                placeholder={t('resetPassword.newPasswordPlaceholder')}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                required
              />
            </div>
            <div className="login-field">
              <label className="login-label">{t('resetPassword.repeatPassword')}</label>
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
              {loading ? t('resetPassword.saving') : t('resetPassword.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
