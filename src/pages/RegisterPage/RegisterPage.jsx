import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import './RegisterPage.css'

const PERKS = [
  'Сторінка закладу в каталозі міста',
  'Публікація подій і заходів',
  'Редагування профілю у реальному часі',
  'Статистика переглядів',
]

export default function RegisterPage() {
  const { registerUser } = useAuth()
  const { reload } = useApp()
  const navigate = useNavigate()

  const [f, setF] = useState({
    email: '',
    password: '',
    confirm: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (f.password.length < 6) return setError('Пароль мінімум 6 символів')
    if (f.password !== f.confirm) return setError('Паролі не співпадають')

    setLoading(true)
    const emailName = f.email.trim().split('@')[0]
    try {
      await registerUser({
        email: f.email.trim(),
        password: f.password,
        name: emailName,
        place: { name: 'Мій заклад', type: 'restaurant', city: 'Харків' },
      })
      await reload()
      navigate('/venue')
    } catch (err) {
      setError(err.message || 'Помилка реєстрації')
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
            <p className="rp-hero-label">Для власників закладів</p>
            <h1 className="rp-hero-title">
              Розкажи місту<br />про свій заклад
            </h1>

            <ul className="rp-perks">
              {PERKS.map(p => (
                <li key={p} className="rp-perk">
                  <span className="rp-perk__check">✓</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <p className="rp-hero-footer">
            Вже є акаунт?{' '}
            <Link to="/login" className="rp-hero-footer__link">Увійти</Link>
          </p>
        </div>

        {/* ── Right: form ── */}
        <div className="rp-form-wrap">
          <div className="rp-form-card">
            <div className="rp-form-head">
              <h2 className="rp-form-title">Реєстрація</h2>
              <p className="rp-form-sub">Заповніть інформацію про заклад</p>
            </div>

            <form onSubmit={handleSubmit} className="rp-form" noValidate>

              <div className="rp-field">
                <label className="rp-label">Email *</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={f.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="hello@myvenue.ua"
                />
              </div>

              <div className="rp-row">
                <div className="rp-field">
                  <label className="rp-label">Пароль *</label>
                  <input
                    className="input"
                    type="password"
                    required
                    value={f.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="Мін. 6 символів"
                  />
                </div>
                <div className="rp-field">
                  <label className="rp-label">Підтвердити</label>
                  <input
                    className="input"
                    type="password"
                    required
                    value={f.confirm}
                    onChange={e => set('confirm', e.target.value)}
                    placeholder="Повторіть пароль"
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
                  ? <><span className="rp-spinner" /> Створюємо акаунт...</>
                  : 'Створити аккаунт'
                }
              </button>

              <p className="rp-terms">
                Реєструючись, ви погоджуєтесь з умовами використання сервісу.
              </p>
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}
