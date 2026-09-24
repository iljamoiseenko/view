import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { useLanguage } from '../../context/LanguageContext'
import './TabBar.css'

// Bottom tab bar of the iOS app (rendered only when isNative, see App.jsx).

// Routes that belong to the Account tab; /events and /event/:id belong to
// Events; everything else (places, collections, curated lists…) is Home.
const ACCOUNT_PATHS = [
  '/account', '/login', '/register', '/register-guest', '/forgot-password', '/reset-password',
  '/my-bookings', '/venue', '/admin', '/about', '/terms', '/refund-policy', '/contacts',
]

function tabFor(pathname) {
  if (pathname === '/events' || pathname.startsWith('/event/')) return 'events'
  if (ACCOUNT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'account'
  return 'home'
}

const icons = {
  home: (active) => (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-6h-5.6v6H5A1.5 1.5 0 0 1 3.5 19z" />
    </svg>
  ),
  events: (active) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill={active ? 'currentColor' : 'none'} />
      <path d="M8 3v4M16 3v4" />
      <path d="M3.5 10h17" stroke={active ? 'var(--bg)' : 'currentColor'} />
    </svg>
  ),
  account: (active) => (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20.5c.6-3.9 3.9-6.5 8-6.5s7.4 2.6 8 6.5z" />
    </svg>
  ),
}

const TABS = [
  { key: 'home', root: '/' },
  { key: 'events', root: '/events' },
  { key: 'account', root: '/account' },
]

export default function TabBar() {
  const { t } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const current = tabFor(location.pathname)

  // Like a native tab bar, each tab remembers where you were inside it.
  const lastPath = useRef({ home: '/', events: '/events', account: '/account' })
  useEffect(() => {
    lastPath.current[current] = location.pathname + location.search
  }, [current, location.pathname, location.search])

  const handlePress = (tab) => {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
    if (tab.key === current) {
      // Tapping the active tab: first back to its root, then scroll to top.
      if (location.pathname !== tab.root) navigate(tab.root)
      else window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    navigate(lastPath.current[tab.key])
  }

  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(tab => {
        const active = tab.key === current
        return (
          <button
            key={tab.key}
            type="button"
            className={`tabbar__item ${active ? 'active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => handlePress(tab)}
          >
            {icons[tab.key](active)}
            <span>{t(`tabs.${tab.key}`)}</span>
          </button>
        )
      })}
    </nav>
  )
}
