import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './SubscriptionBanner.css'

export default function SubscriptionBanner() {
  const { currentUser, isSubscribed, trialDaysLeft } = useAuth()
  if (!currentUser || currentUser.role !== 'venue') return null

  const subscribed = isSubscribed()
  const daysLeft = trialDaysLeft()
  const status = currentUser.subscription.status

  if (subscribed && (status !== 'trial' || daysLeft > 5)) return null

  const isInactive = status === 'inactive'
  const isTrialEnding = status === 'trial' && daysLeft <= 5

  return (
    <div className={`sub-banner ${isInactive ? 'sub-banner--warn' : 'sub-banner--info'}`}>
      <div className="container sub-banner__inner">
        <span className="sub-banner__icon">{isInactive ? '🔒' : '⚡'}</span>
        <p className="sub-banner__text">
          {isInactive
            ? 'Підписка неактивна. Поновіть, щоб публікувати події.'
            : `Trial закінчується через ${daysLeft} ${daysLeft === 1 ? 'день' : 'дні'}. Активуйте підписку зараз.`}
        </p>
        <Link to="/subscription" className="sub-banner__cta">
          {isInactive ? 'Підписатись' : 'Активувати'} →
        </Link>
      </div>
    </div>
  )
}
