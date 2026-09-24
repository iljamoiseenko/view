import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import FeedbackModal from './FeedbackModal'
import './Footer.css'

export default function Footer() {
  const { t } = useLanguage()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  return (
    <footer className="footer">
      <div className="container footer__inner">

        {/* Logo */}
        <div className="footer__brand">
          <Link to="/" className="footer__logo">VIEW</Link>
        </div>

        {/* Nav */}
        <nav className="footer__nav">
          <NavLink to="/" end className="footer__nav-link">{t('header.venues')}</NavLink>
          <NavLink to="/events" className="footer__nav-link">{t('header.events')}</NavLink>
          <NavLink to="/about" className="footer__nav-link">{t('header.about')}</NavLink>
          <NavLink to="/register" className="footer__nav-link">{t('footer.addVenue')}</NavLink>
        </nav>

        {/* Right: socials */}
        <div className="footer__right">
          <div className="footer__socials">
            <a href="https://www.instagram.com/theview_events/" className="footer__social" aria-label="Instagram" target="_blank" rel="noreferrer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
            <a href="https://www.threads.com/@theview_events" className="footer__social" aria-label="Threads" target="_blank" rel="noreferrer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 11.2c-.07-.04-.15-.07-.22-.1-.13-2.4-1.44-3.78-3.65-3.8-1.36-.01-2.5.55-3.19 1.67l1.36.93c.51-.83 1.32-1 1.79-1h.02c.58.005 1.02.17 1.3.5.21.24.35.57.42 1-1.75-.3-3.13.05-4.1.77-1 .74-1.16 1.83-1.14 2.48.01.3.08.63.24.97.55 1.12 1.75 1.63 3.15 1.53 1.86-.13 2.98-.98 3.54-2.24.42.96.53 2.23-.48 3.24-.87.87-1.9 1.24-3.46 1.25-1.73-.01-3.05-.57-3.94-1.66-.83-1.02-1.26-2.5-1.28-4.4.02-1.9.45-3.38 1.28-4.4.89-1.09 2.21-1.65 3.94-1.66 1.75.01 3.08.58 3.97 1.68.44.55.76 1.24.97 2.06l1.55-.41c-.26-1.03-.68-1.92-1.26-2.65-1.19-1.48-2.95-2.24-5.22-2.25h-.01c-2.26.01-4 .78-5.17 2.28-1.05 1.33-1.58 3.17-1.6 5.35v.02c.02 2.18.55 4.02 1.6 5.35 1.17 1.5 2.91 2.27 5.17 2.28h.01c1.98-.01 3.38-.53 4.53-1.69 1.51-1.51 1.47-3.42.97-4.58-.36-.83-1.04-1.5-1.98-1.98zm-3.79 2.24c-1.13.06-2.02-.4-2.26-.9-.18-.35-.02-.75.11-.94.46-.63 1.5-.81 2.62-.72.06.005.13.01.19.02.11.98-.14 2.51-1.66 2.54z"/>
              </svg>
            </a>
          </div>
        </div>

      </div>

      <div className="footer__feedback-row">
        <div className="container">
          <button type="button" className="footer__feedback-btn" onClick={() => setFeedbackOpen(true)}>
            💬 {t('footer.feedbackBtn')}
          </button>
        </div>
      </div>

      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}

      <div className="footer__legal">
        <div className="footer__legal-links">
          <Link to="/terms" className="footer__legal-link">{t('footer.terms')}</Link>
          <Link to="/refund-policy" className="footer__legal-link">{t('footer.refundPolicy')}</Link>
          <Link to="/contacts" className="footer__legal-link">{t('footer.contacts')}</Link>
        </div>
        <div className="footer__copy">© 2026 View</div>
      </div>
    </footer>
  )
}
