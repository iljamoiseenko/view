import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import DeleteAccount from '../../components/DeleteAccount/DeleteAccount'
import FeedbackModal from '../../components/Footer/FeedbackModal'
import './AccountPage.css'

// "Account" tab of the iOS app: profile, links that live in the site's header
// menu and footer on the web, language, logout and account deletion.

const Chevron = () => (
  <svg className="acc-row__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 6 6 6-6 6" />
  </svg>
)

function Row({ to, href, onClick, label, value, danger }) {
  const content = (
    <>
      <span className={`acc-row__label ${danger ? 'acc-row__label--danger' : ''}`}>{label}</span>
      {value && <span className="acc-row__value">{value}</span>}
      {!danger && <Chevron />}
    </>
  )
  if (to) return <Link to={to} className="acc-row">{content}</Link>
  if (href) return <a href={href} target="_blank" rel="noreferrer" className="acc-row">{content}</a>
  return <button type="button" className="acc-row" onClick={onClick}>{content}</button>
}

export default function AccountPage() {
  const { currentUser, logout } = useAuth()
  const { lang, setLang, t } = useLanguage()
  const navigate = useNavigate()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const role = currentUser?.role
  const handleLogout = () => {
    logout()
    navigate('/account', { replace: true })
  }

  return (
    <div className="acc-page">
      <div className="container acc-inner">
        <h1 className="acc-title">{t('tabs.account')}</h1>

        {currentUser ? (
          <div className="acc-profile">
            <div className="acc-profile__avatar">
              {currentUser.avatarUrl
                ? <img src={currentUser.avatarUrl} alt="" />
                : <span>{(currentUser.name || '?').trim().charAt(0).toUpperCase()}</span>}
            </div>
            <div className="acc-profile__text">
              <span className="acc-profile__name">{currentUser.name}</span>
              <span className="acc-profile__meta">
                {t(`account.role_${role}`)}{currentUser.email ? ` · ${currentUser.email}` : ''}
              </span>
            </div>
          </div>
        ) : (
          <div className="acc-guest">
            <p className="acc-guest__title">{t('account.guestTitle')}</p>
            <p className="acc-guest__text">{t('account.guestText')}</p>
            <Link to="/login" className="btn btn-dark acc-guest__btn">{t('header.login')}</Link>
            <Link to="/register-guest" className="btn btn-outline acc-guest__btn">{t('header.createAccount')}</Link>
          </div>
        )}

        {currentUser && (
          <div className="acc-group">
            {role === 'user' && <Row to="/my-bookings" label={t('header.myBookings')} />}
            {role === 'venue' && <Row to="/venue" label={t('header.myVenue')} />}
            {role === 'superadmin' && <Row to="/admin" label={t('header.admin')} />}
          </div>
        )}

        <div className="acc-group">
          <Row to="/collections" label={t('header.collections')} />
          <Row
            onClick={() => setLang(lang === 'uk' ? 'en' : 'uk')}
            label={t('account.language')}
            value={lang === 'uk' ? 'Українська' : 'English'}
          />
          {!currentUser && <Row to="/register" label={t('footer.addVenue')} />}
        </div>

        <div className="acc-group">
          <Row to="/about" label={t('header.about')} />
          <Row onClick={() => setFeedbackOpen(true)} label={t('footer.feedbackBtn')} />
          <Row href="https://www.instagram.com/theview_events/" label="Instagram" />
        </div>

        <div className="acc-group">
          <Row to="/terms" label={t('footer.terms')} />
          <Row to="/refund-policy" label={t('footer.refundPolicy')} />
          <Row to="/contacts" label={t('footer.contacts')} />
        </div>

        {currentUser && (
          <div className="acc-group">
            <Row onClick={handleLogout} label={t('header.logoutAccount')} danger />
          </div>
        )}

        {currentUser && role !== 'superadmin' && <DeleteAccount />}

        <p className="acc-copy">© 2026 View</p>
      </div>

      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </div>
  )
}
