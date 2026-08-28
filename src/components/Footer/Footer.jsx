import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../api/client'
import './Footer.css'

export default function Footer() {
  const { t } = useLanguage()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const closeFeedback = () => {
    setFeedbackOpen(false)
    setFeedbackText('')
    setSent(false)
  }

  const submitFeedback = async (e) => {
    e.preventDefault()
    if (!feedbackText.trim() || sending) return
    setSending(true)
    try {
      await api.post('/feedback', { message: feedbackText.trim() })
      setSent(true)
      setFeedbackText('')
    } catch {
      // silently fail — nothing actionable for the visitor to do here
    } finally {
      setSending(false)
    }
  }

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

        {/* Right: donate + socials */}
        <div className="footer__right">
          <a href="https://send.monobank.ua/jar/4WzeZ54Q7f" className="footer__donate" target="_blank" rel="noreferrer">
            {t('footer.donate')}
          </a>
          <div className="footer__socials">
            <a href="https://www.instagram.com/theview_view?igsh=NDFxeHc5MGV0OHhi" className="footer__social" aria-label="Instagram">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
            <a href="https://t.me/view_view_view_kh" className="footer__social" aria-label="Telegram">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </a>
            <a href="www.tiktok.com/@view.kh" className="footer__social" aria-label="TikTok">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
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

      {feedbackOpen && (
        <div className="footer__feedback-overlay" onClick={closeFeedback}>
          <div className="footer__feedback-modal" onClick={e => e.stopPropagation()}>
            <div className="footer__feedback-modal__head">
              <h3>{t('footer.feedbackBtn')}</h3>
              <button className="footer__feedback-modal__close" onClick={closeFeedback}>✕</button>
            </div>
            {sent ? (
              <div className="footer__feedback-sent">
                <span className="footer__feedback-sent__icon">✓</span>
                <p>{t('footer.feedbackSent')}</p>
                <button type="button" className="btn btn-dark" onClick={closeFeedback}>{t('common.close')}</button>
              </div>
            ) : (
              <form onSubmit={submitFeedback}>
                <p className="footer__feedback-prompt">{t('footer.feedbackPrompt')}</p>
                <textarea
                  className="input textarea footer__feedback-textarea"
                  rows={5}
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder={t('footer.feedbackPlaceholder')}
                  autoFocus
                  required
                />
                <button type="submit" className="btn btn-dark footer__feedback-submit" disabled={sending || !feedbackText.trim()}>
                  {sending ? t('common.sending') : t('common.send')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

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
