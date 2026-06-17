import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Header.css'

export default function Header() {
  const { currentUser, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const close = () => setMenuOpen(false)

  const handleLogout = () => {
    logout()
    navigate('/')
    close()
  }

  return (
    <header className="header">
      <div className="container header__inner">

        <Link to="/" className="header__logo" onClick={close}>VIEW</Link>

        {/* Desktop nav */}
        <nav className="header__nav">
          <NavLink to="/" end className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}>Заклади</NavLink>
          <NavLink to="/events" className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}>Івенти</NavLink>
          <NavLink to="/collections" className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}>Підбірки</NavLink>
          <NavLink to="/about" className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}>Про нас</NavLink>
          {currentUser?.role === 'superadmin' && (
            <NavLink to="/admin" className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}>Адмін</NavLink>
          )}
          {currentUser?.role === 'venue' && (
            <NavLink to="/venue" className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}>Мій заклад</NavLink>
          )}
        </nav>

        {/* Desktop right */}
        <div className="header__right">
          {currentUser ? (
            <div className="header__user">
              <span className="header__user-name">{currentUser.name.split(' ')[0]}</span>
              <button className="header__logout" onClick={handleLogout}>Вийти</button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-dark btn-sm header__login-btn">Для закладів</Link>
          )}
        </div>

        {/* Burger */}
        <button
          className={`header__burger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Меню"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="header__mobile-menu">
          <nav className="header__mobile-nav">
            <NavLink to="/" end className={({ isActive }) => `header__mobile-link ${isActive ? 'active' : ''}`} onClick={close}>Заклади</NavLink>
            <NavLink to="/events" className={({ isActive }) => `header__mobile-link ${isActive ? 'active' : ''}`} onClick={close}>Івенти</NavLink>
            <NavLink to="/collections" className={({ isActive }) => `header__mobile-link ${isActive ? 'active' : ''}`} onClick={close}>Підбірки</NavLink>
            <NavLink to="/about" className={({ isActive }) => `header__mobile-link ${isActive ? 'active' : ''}`} onClick={close}>Про нас</NavLink>
            {currentUser?.role === 'superadmin' && (
              <NavLink to="/admin" className={({ isActive }) => `header__mobile-link ${isActive ? 'active' : ''}`} onClick={close}>Адмін</NavLink>
            )}
            {currentUser?.role === 'venue' && (
              <NavLink to="/venue" className={({ isActive }) => `header__mobile-link ${isActive ? 'active' : ''}`} onClick={close}>Мій заклад</NavLink>
            )}
          </nav>

          <div className="header__mobile-footer">
            {currentUser ? (
              <>
                <span className="header__mobile-user">👤 {currentUser.name}</span>
                <button className="header__mobile-logout" onClick={handleLogout}>Вийти з акаунту</button>
              </>
            ) : (
              <Link to="/login" className="btn btn-dark" style={{width:'100%', textAlign:'center'}} onClick={close}>
                Увійти
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
