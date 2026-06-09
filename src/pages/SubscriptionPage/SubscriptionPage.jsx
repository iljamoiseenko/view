import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './SubscriptionPage.css'

const PLAN_FEATURES = [
  'Необмежені події',
  'Редагування сторінки закладу',
  'Пріоритетне розміщення',
  'Аналітика переглядів',
]

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
}

function CardInput({ label, value, onChange, placeholder, maxLength, type = 'text' }) {
  return (
    <div className="sp-field">
      <label className="sp-label">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
      />
    </div>
  )
}

function formatCardNumber(val) {
  return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(val) {
  const digits = val.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2)
  return digits
}

export default function SubscriptionPage() {
  const { currentUser, subscribe, cancelSubscription, trialDaysLeft } = useAuth()
  const navigate = useNavigate()

  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelDone, setCancelDone] = useState(false)

  if (!currentUser) return null

  const { status, currentPeriodEnd, trialEndsAt } = currentUser.subscription
  const isActive = status === 'active'
  const isTrial = status === 'trial'
  const isInactive = status === 'inactive'
  const daysLeft = trialDaysLeft()

  const handleSubscribe = async (e) => {
    e.preventDefault()
    const digits = cardNumber.replace(/\s/g, '')
    if (digits.length < 16 || !cardName.trim() || expiry.length < 5 || cvv.length < 3) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 1400))
    subscribe()
    setLoading(false)
  }

  const handleCancel = () => {
    cancelSubscription()
    setShowCancel(false)
    setCancelDone(true)
  }

  return (
    <div className="sp-page">
      <div className="sp-hero">
        <div className="container">
          <p className="sp-hero__back">
            <button className="sp-back" onClick={() => navigate('/venue')}>← Назад до кабінету</button>
          </p>
          <h1 className="sp-hero__title">Підписка</h1>
        </div>
      </div>

      <div className="container sp-content">
        {isActive ? (
          /* ── Active state ── */
          <div className="sp-active-card">
            <div className="sp-active-card__icon">✓</div>
            <h2 className="sp-active-card__title">Підписка активна</h2>
            <p className="sp-active-card__date">
              Діє до <strong>{formatDate(currentPeriodEnd)}</strong>
            </p>
            <p className="sp-active-card__renew">Автопоновлення: ввімкнено</p>

            {cancelDone ? (
              <p className="sp-cancel-done">Підписку скасовано. Доступ збережеться до кінця оплаченого періоду.</p>
            ) : showCancel ? (
              <div className="sp-cancel-confirm">
                <p>Скасувати підписку? Доступ збережеться до {formatDate(currentPeriodEnd)}.</p>
                <div className="sp-cancel-confirm__btns">
                  <button className="btn-outline" onClick={() => setShowCancel(false)}>Ні, залишити</button>
                  <button className="btn-danger" onClick={handleCancel}>Так, скасувати</button>
                </div>
              </div>
            ) : (
              <button className="sp-cancel-btn" onClick={() => setShowCancel(true)}>
                Скасувати підписку
              </button>
            )}
          </div>
        ) : (
          /* ── Checkout state ── */
          <div className="sp-checkout">
            {/* Status banner */}
            {isTrial && (
              <div className="sp-status sp-status--trial">
                ⚡ Trial — закінчується через <strong>{daysLeft} {daysLeft === 1 ? 'день' : 'дні'}</strong> ({formatDate(trialEndsAt)})
              </div>
            )}
            {isInactive && (
              <div className="sp-status sp-status--inactive">
                🔒 Підписка неактивна. Активуйте, щоб публікувати події.
              </div>
            )}

            <div className="sp-cols">
              {/* Plan card */}
              <div className="sp-plan">
                <div className="sp-plan__head">
                  <span className="sp-plan__name">Стандарт</span>
                  <div className="sp-plan__price">
                    <span className="sp-plan__amount">$5</span>
                    <span className="sp-plan__period">/ місяць</span>
                  </div>
                </div>
                <ul className="sp-plan__features">
                  {PLAN_FEATURES.map(f => (
                    <li key={f} className="sp-plan__feature">
                      <span className="sp-plan__check">✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Stripe mock form */}
              <form className="sp-stripe" onSubmit={handleSubscribe}>
                <div className="sp-stripe__brand">
                  <span className="sp-stripe__lock">🔒</span>
                  <span className="sp-stripe__powered">Захищено Stripe</span>
                </div>

                <CardInput
                  label="Номер картки"
                  value={cardNumber}
                  onChange={v => setCardNumber(formatCardNumber(v))}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                />
                <CardInput
                  label="Ім'я власника"
                  value={cardName}
                  onChange={setCardName}
                  placeholder="IVAN PETRENKO"
                />
                <div className="sp-row">
                  <CardInput
                    label="Дата закінчення"
                    value={expiry}
                    onChange={v => setExpiry(formatExpiry(v))}
                    placeholder="MM/YY"
                    maxLength={5}
                  />
                  <CardInput
                    label="CVV"
                    value={cvv}
                    onChange={v => setCvv(v.replace(/\D/g, '').slice(0, 4))}
                    placeholder="123"
                    maxLength={4}
                    type="password"
                  />
                </div>

                <button
                  type="submit"
                  className={`btn-primary sp-pay-btn ${loading ? 'sp-pay-btn--loading' : ''}`}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="sp-spinner" />
                  ) : (
                    'Підписатись за $5/місяць'
                  )}
                </button>

                <p className="sp-disclaimer">
                  Це демо-форма. Реального списання не буде.
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
