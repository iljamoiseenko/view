import { useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../api/client'
import './Footer.css'

// "Help us make View better" feedback form — opened from the site footer and
// from the Account tab in the iOS app.
export default function FeedbackModal({ onClose }) {
  const { t } = useLanguage()
  const [feedbackText, setFeedbackText] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

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
    <div className="footer__feedback-overlay" onClick={onClose}>
      <div className="footer__feedback-modal" onClick={e => e.stopPropagation()}>
        <div className="footer__feedback-modal__head">
          <h3>{t('footer.feedbackBtn')}</h3>
          <button className="footer__feedback-modal__close" onClick={onClose}>✕</button>
        </div>
        {sent ? (
          <div className="footer__feedback-sent">
            <span className="footer__feedback-sent__icon">✓</span>
            <p>{t('footer.feedbackSent')}</p>
            <button type="button" className="btn btn-dark" onClick={onClose}>{t('common.close')}</button>
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
  )
}
