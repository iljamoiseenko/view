import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import './AboutPage.css'

export default function AboutPage() {
  const { t } = useLanguage()
  return (
    <div className="about">
      <div className="about__hero">
        <div className="container about__hero-inner">
          <p className="about__eyebrow">{t('about.eyebrow')}</p>
          <h1 className="about__title">{t('about.titleLine1')}<br/>{t('about.titleLine2')}</h1>
          <p className="about__sub">{t('about.sub')}</p>
        </div>
      </div>

      <div className="container about__body">
        <div className="about__blocks">
          <div className="about__block">
            <span className="about__block-icon">📍</span>
            <h2>{t('about.block1Title')}</h2>
            <p>{t('about.block1Text')}</p>
          </div>
          <div className="about__block">
            <span className="about__block-icon">🎭</span>
            <h2>{t('about.block2Title')}</h2>
            <p>{t('about.block2Text')}</p>
          </div>
          <div className="about__block">
            <span className="about__block-icon">🏢</span>
            <h2>{t('about.block3Title')}</h2>
            <p>{t('about.block3Text')}</p>
          </div>
        </div>

        <div className="about__cta">
          <Link to="/" className="btn btn-dark">{t('about.ctaViewVenues')}</Link>
          <Link to="/register" className="btn btn-outline">{t('about.ctaAddVenue')}</Link>
        </div>
      </div>
    </div>
  )
}
