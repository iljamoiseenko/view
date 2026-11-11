import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { SUBSCRIPTION_TIERS } from '../../data/initialData'
import './PricingPage.css'

export default function PricingPage() {
  const { currentUser } = useAuth()
  const { t } = useLanguage()

  // A logged-in venue goes straight to the tab where checkout actually
  // happens; anyone else starts at registration — this page itself has no
  // checkout logic of its own, it just explains the tiers.
  const ctaTo = currentUser?.role === 'venue' ? '/venue?tab=subscription' : '/register'
  const ctaLabel = currentUser?.role === 'venue' ? t('pricing.manageCta') : t('pricing.registerCta')

  return (
    <div className="container pp-page">
      <div className="pp-head">
        <h1>{t('pricing.title')}</h1>
        <p>{t('pricing.subtitle')}</p>
      </div>

      <div className="pp-plans">
        {Object.keys(SUBSCRIPTION_TIERS).map(tierKey => {
          const tierInfo = SUBSCRIPTION_TIERS[tierKey]
          const isPopular = tierKey === 'premium'
          return (
            <div key={tierKey} className={`pp-card ${isPopular ? 'popular' : ''}`}>
              {isPopular && <span className="pp-card__badge">{t('venueAdmin.popularBadge')}</span>}
              <div className="pp-card__name">{t(`subscriptionTiers.${tierKey}`)}</div>
              <div className="pp-card__price">
                <span className="pp-card__price-amount">${tierInfo.price}</span>
                <span className="pp-card__price-period">{t('venueAdmin.perMonth')}</span>
              </div>
              <ul className="pp-card__features">
                <li>
                  <span className="pp-card__check">✓</span>
                  {tierInfo.eventsPerMonth ? t('venueAdmin.eventsLimitText', tierInfo.eventsPerMonth) : t('venueAdmin.eventsUnlimitedText')}
                </li>
                {tierInfo.boostsPerMonth > 0 && (
                  <li>
                    <span className="pp-card__check">✓</span>
                    {t('venueAdmin.boostsLimitText', tierInfo.boostsPerMonth)}
                  </li>
                )}
                {(tierKey === 'pro' || tierKey === 'premium') && (
                  <li>
                    <span className="pp-card__check">✓</span>
                    {t('venueAdmin.analyticsFeatureText')}
                  </li>
                )}
                {tierInfo.bookingEnabled && (
                  <li>
                    <span className="pp-card__check">✓</span>
                    {t('venueAdmin.bookingFeatureText')}
                  </li>
                )}
                <li>
                  <span className="pp-card__check">✓</span>
                  {t('venueAdmin.supportFeatureText')}
                </li>
              </ul>
              <Link to={ctaTo} className="btn btn-dark pp-card__btn">{ctaLabel}</Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
