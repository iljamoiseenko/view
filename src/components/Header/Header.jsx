import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../api/client'
import './Header.css'

const DEFAULT_AVATAR = (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"/>
  </svg>
)

export default function Header() {
  const { currentUser, logout, updateCurrentUser } = useAuth()
  const { lang, setLang, t } = useLanguage()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const navigate = useNavigate()
  const profileRef = useRef(null)
  const close = () => setMenuOpen(false)
  const closeProfile = () => setProfileOpen(false)

  const profilePath = currentUser?.role === 'superadmin' ? '/admin' : '/venue'

  useEffect(() => {
    if (!profileOpen) return
    const onDocClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) closeProfile()
    }
    const onKeyDown = (e) => { if (e.key === 'Escape') closeProfile() }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [profileOpen])

  const handleLogout = () => {
    logout()
    navigate('/')
    close()
    closeProfile()
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const form = new FormData()
      form.append('image', file)
      const token = localStorage.getItem('view_token')
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (data.url) {
        await api.put(`/users/${currentUser.id}`, { avatarUrl: data.url })
        updateCurrentUser({ avatarUrl: data.url })
      }
    } catch {
      // silently fail
    } finally {
      setAvatarUploading(false)
      e.target.value = ''
    }
  }

  const avatar = (className) => (
    <label className={className} title={t('header.changeAvatar')}>
      {avatarUploading ? (
        <span className="header__avatar-spinner" />
      ) : currentUser.avatarUrl ? (
        <img src={currentUser.avatarUrl} alt="" />
      ) : DEFAULT_AVATAR}
      <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={avatarUploading} />
    </label>
  )

  return (
    <header className="header">
      <div className="container header__inner">

        <Link to="/" className="header__logo" onClick={close}>VIEW</Link>

        {/* Desktop nav */}
        <nav className="header__nav">
          <NavLink to="/" end className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}>{t('header.venues')}</NavLink>
          <NavLink to="/events" className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}>{t('header.events')}</NavLink>
          <NavLink to="/collections" className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}>{t('header.collections')}</NavLink>
          <NavLink to="/about" className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}>{t('header.about')}</NavLink>
          {currentUser?.role === 'superadmin' && (
            <NavLink to="/admin" className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}>{t('header.admin')}</NavLink>
          )}
          {currentUser?.role === 'venue' && (
            <NavLink to="/venue" className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}>{t('header.myVenue')}</NavLink>
          )}
        </nav>

        {/* Desktop right */}
        <div className="header__right">
          <button
            className="header__lang"
            onClick={() => setLang(lang === 'uk' ? 'en' : 'uk')}
            aria-label="Switch language"
          >
            {lang === 'uk' ? 'EN' : 'UK'}
          </button>
          <div className="header__profile" ref={profileRef}>
            <button
              className="header__avatar-btn"
              onClick={() => setProfileOpen(v => !v)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              aria-label={t('header.profile')}
            >
              {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt="" /> : DEFAULT_AVATAR}
            </button>

            {profileOpen && (
              <div className="header__profile-menu" role="menu">
                {currentUser ? (
                  <>
                    <div className="header__profile-menu-head">
                      {avatar('header__avatar header__avatar--menu')}
                      <span className="header__profile-menu-name">{currentUser.name}</span>
                    </div>
                    <Link to={profilePath} className="header__profile-menu-item" onClick={closeProfile}>
                      {t('header.profile')}
                    </Link>
                    <button className="header__profile-menu-item header__profile-menu-item--danger" onClick={handleLogout}>
                      {t('header.logoutAccount')}
                    </button>
                  </>
                ) : (
                  <div className="header__profile-guest">
                    <span className="header__profile-guest-title">{t('header.yourAccount')}</span>
                    <Link to="/login" className="header__profile-guest-cta" onClick={closeProfile}>
                      {t('header.login')}
                    </Link>
                    <Link to="/register" className="header__profile-guest-register" onClick={closeProfile}>
                      {t('header.noAccount')}
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Burger */}
        <button
          className={`header__burger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(v => !v)}
          aria-label={t('header.menu')}
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="header__mobile-menu">
          <nav className="header__mobile-nav">
            <NavLink to="/" end className={({ isActive }) => `header__mobile-link ${isActive ? 'active' : ''}`} onClick={close}>{t('header.venues')}</NavLink>
            <NavLink to="/events" className={({ isActive }) => `header__mobile-link ${isActive ? 'active' : ''}`} onClick={close}>{t('header.events')}</NavLink>
            <NavLink to="/collections" className={({ isActive }) => `header__mobile-link ${isActive ? 'active' : ''}`} onClick={close}>{t('header.collections')}</NavLink>
            <NavLink to="/about" className={({ isActive }) => `header__mobile-link ${isActive ? 'active' : ''}`} onClick={close}>{t('header.about')}</NavLink>
            {currentUser?.role === 'superadmin' && (
              <NavLink to="/admin" className={({ isActive }) => `header__mobile-link ${isActive ? 'active' : ''}`} onClick={close}>{t('header.admin')}</NavLink>
            )}
            {currentUser?.role === 'venue' && (
              <NavLink to="/venue" className={({ isActive }) => `header__mobile-link ${isActive ? 'active' : ''}`} onClick={close}>{t('header.myVenue')}</NavLink>
            )}
          </nav>

          <div className="header__mobile-footer">
            <button
              className="header__lang header__lang--mobile"
              onClick={() => setLang(lang === 'uk' ? 'en' : 'uk')}
            >
              {lang === 'uk' ? 'English' : 'Українська'}
            </button>
            {currentUser ? (
              <>
                <div className="header__mobile-user">
                  {avatar('header__avatar header__avatar--mobile')}
                  <span>{currentUser.name}</span>
                </div>
                <button className="header__mobile-logout" onClick={handleLogout}>{t('header.logoutAccount')}</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-dark" style={{width:'100%', textAlign:'center'}} onClick={close}>
                  {t('header.login')}
                </Link>
                <Link to="/register" className="btn btn-outline" style={{width:'100%', textAlign:'center'}} onClick={close}>
                  {t('login.register')}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
