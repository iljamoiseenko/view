import { Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useLanguage } from '../../context/LanguageContext'
import { COLLECTIONS } from '../../data/initialData'
import './CollectionsPage.css'

export default function CollectionsPage() {
  const { t } = useLanguage()
  const { filteredPlaces } = useApp()

  return (
    <div className="coll-page">
      <div className="container coll-page__inner">
        <span className="coll-page__badge">{t('collections.badge')}</span>
        <h1 className="coll-page__title">{t('collections.title')}</h1>
        <p className="coll-page__sub" style={{ whiteSpace: 'pre-line' }}>
          {t('collections.sub')}
        </p>
        <div className="coll-page__cards">
          {COLLECTIONS.map(c => {
            const count = filteredPlaces.filter(p => Array.isArray(p.collections) && p.collections.includes(c.slug)).length
            return (
              <Link key={c.slug} to={`/collections/${c.slug}`} className="coll-page__card">
                <span className="coll-page__card-icon">{c.icon}</span>
                <span className="coll-page__card-label">{t(`collectionsList.${c.slug}`)}</span>
                <span className="coll-page__card-soon">{t('collections.count', count)}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
