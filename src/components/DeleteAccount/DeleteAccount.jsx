import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../api/client'
import './DeleteAccount.css'

// Self-service account deletion — the App Store requires it for any app with sign-up.
export default function DeleteAccount() {
  const { logout } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    if (!window.confirm(t('deleteAccount.confirm'))) return
    setDeleting(true)
    setError('')
    try {
      await api.delete('/auth/me')
      logout()
      navigate('/')
    } catch (err) {
      setError(err.message || t('deleteAccount.error'))
      setDeleting(false)
    }
  }

  return (
    <div className="delete-account">
      <p className="delete-account__title">{t('deleteAccount.title')}</p>
      <p className="delete-account__text">{t('deleteAccount.text')}</p>
      <button type="button" className="btn delete-account__btn" disabled={deleting} onClick={handleDelete}>
        {deleting ? '…' : t('deleteAccount.btn')}
      </button>
      {error && <p className="delete-account__error">{error}</p>}
    </div>
  )
}
