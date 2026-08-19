import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useLanguage } from '../../context/LanguageContext'
import { CITIES } from '../../data/initialData'
import './RegisterPage.css'

export default function RegisterPage() {
  const { registerUser } = useAuth()
  const { reload } = useApp()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const [f, setF] = useState({ username: '', password: '', confirm: '', city: CITIES[0] })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const perks = [t('register.perk1'), t('register.perk2'), t('register.perk3'), t('register.perk4')]

  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!f.username.trim()) return setError(t('register.errLogin'))
    if (f.password.length < 6) return setError(t('register.errPasswordLen'))
    if (f.password !== f.confirm) return setError(t('register.errPasswordMatch'))

    setLoading(true)
    try {
      await registerUser({
        username: f.username.trim(),
        password: f.password,
        name: f.username.trim(),
        place: { type: 'restaurant', city: f.city },
      })
      await reload()
      navigate('/venue')
    } catch (err) {
      setError(err.message || t('register.errDefault'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rp-page">
      <div className="rp-layout">

        {/* ── Left: hero panel ── */}
        <div className="rp-hero">
          <Link to="/" className="rp-logo">VIEW</Link>

          <div className="rp-hero-body">
            <p className="rp-hero-label">{t('register.forOwners')}</p>
            <h1 className="rp-hero-title">
              {t('register.heroTitleLine1')}<br />{t('register.heroTitleLine2')}
            </h1>

            <ul className="rp-perks">
              {perks.map(p => (
                <li key={p} className="rp-perk">
                  <span className="rp-perk__check">✓</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <p className="rp-hero-footer">
            {t('register.haveAccount')}{' '}
            <Link to="/login" className="rp-hero-footer__link">{t('register.login')}</Link>
          </p>
        </div>

        {/* ── Right: form ── */}
        <div className="rp-form-wrap">
          <div className="rp-form-card">
            <div className="rp-form-head">
              <h2 className="rp-form-title">{t('register.formTitle')}</h2>
              <p className="rp-form-sub">{t('register.formSub')}</p>
            </div>

            <form onSubmit={handleSubmit} className="rp-form" noValidate>

              <div className="rp-field">
                <label className="rp-label">{t('register.login_')} *</label>
                <input
                  className="input"
                  type="text"
                  required
                  value={f.username}
                  onChange={e => set('username', e.target.value)}
                  placeholder={t('register.loginPlaceholder')}
                  autoComplete="username"
                />
              </div>

              <div className="rp-field">
                <label className="rp-label">{t('register.city')} *</label>
                <select
                  className="input"
                  required
                  value={f.city}
                  onChange={e => set('city', e.target.value)}
                >
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="rp-row">
                <div className="rp-field">
                  <label className="rp-label">{t('register.password')} *</label>
                  <input
                    className="input"
                    type="password"
                    required
                    value={f.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder={t('register.passwordPlaceholder')}
                  />
                </div>
                <div className="rp-field">
                  <label className="rp-label">{t('register.confirm')}</label>
                  <input
                    className="input"
                    type="password"
                    required
                    value={f.confirm}
                    onChange={e => set('confirm', e.target.value)}
                    placeholder={t('register.confirmPlaceholder')}
                  />
                </div>
              </div>

              {error && <p className="rp-error">{error}</p>}

              <button
                type="submit"
                className="btn btn-primary rp-submit"
                disabled={loading}
              >
                {loading
                  ? <><span className="rp-spinner" /> {t('register.submitting')}</>
                  : t('register.submit')
                }
              </button>

              <p className="rp-terms">
                {t('register.terms')}
              </p>
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}
