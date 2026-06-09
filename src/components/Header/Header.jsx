import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Header.css'

export default function Header() {
  const { currentUser, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
    setMenuOpen(false)
  }

  return (
    <header className="header">
      <div className="container header__inner">

        <Link to="/" className="header__logo" onClick={() => setMenuOpen(false)}>
          VIEW
        </Link>

        <nav className={`header__nav ${menuOpen ? 'header__nav--open' : ''}`}>
          <NavLink to="/" end className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}
            onClick={() => setMenuOpen(false)}>
            Заклади
          </NavLink>
          <NavLink to="/events" className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}
            onClick={() => setMenuOpen(false)}>
            Івенти
          </NavLink>

          {currentUser?.role === 'superadmin' && (
            <NavLink to="/admin" className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}>
              Адмін
            </NavLink>
          )}
          {currentUser?.role === 'venue' && (
            <NavLink to="/venue" className={({ isActive }) => `header__link ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}>
              Мій заклад
            </NavLink>
          )}

          {/* Mobile-only login */}
          {!currentUser && (
            <Link to="/login" className="header__link header__link--mobile-login"
              onClick={() => setMenuOpen(false)}>
              Увійти
            </Link>
          )}
          {currentUser && (
            <button className="header__link header__link--mobile-logout" onClick={handleLogout}>
              Вийти
            </button>
          )}
        </nav>

        <div className="header__right">
          {currentUser ? (
            <div className="header__user">
              <span className="header__user-name">{currentUser.name.split(' ')[0]}</span>
              <button className="header__logout" onClick={handleLogout}>Вийти</button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-dark btn-sm header__login-btn">
              Увійти
            </Link>
          )}
        </div>

        <button
          className={`header__burger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Меню"
        >
          <span /><span /><span />
        </button>
      </div>
    </header>
  )
}
