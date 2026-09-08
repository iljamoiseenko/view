import { Link } from 'react-router-dom'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import { useApp } from '../../context/AppContext'
import { useLanguage } from '../../context/LanguageContext'
import { COLLECTIONS } from '../../data/initialData'
import CuratedListCard from '../../components/CuratedListCard/CuratedListCard'
import './CollectionsPage.css'

export default function CollectionsPage() {
  const { t } = useLanguage()
  const { filteredPlaces, curatedLists } = useApp()
  const activeCuratedLists = curatedLists.filter(c => c.active)

  return (
    <div className="coll-page">
      <div className="container coll-page__inner">
        <span className="coll-page__badge">{t('collections.badge')}</span>
        <h1 className="coll-page__title">{t('collections.title')}</h1>
        <p className="coll-page__sub" style={{ whiteSpace: 'pre-line' }}>
          {t('collections.sub')}
        </p>

        {activeCuratedLists.length > 0 && (
          <div className="coll-page__curated">
            <span className="coll-page__section-badge">{t('curated.badge')}</span>
            <h2 className="coll-page__section-title">{t('curated.title')}</h2>
            <div className="coll-page__curated-swiper-outer">
              <Swiper
                modules={[Navigation]}
                navigation
                slidesPerView="auto"
                spaceBetween={16}
                className="coll-page__curated-swiper"
              >
                {activeCuratedLists.map(list => (
                  <SwiperSlide key={list.id} className="coll-page__curated-slide">
                    <CuratedListCard list={list} />
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          </div>
        )}

        <h2 className="coll-page__section-title coll-page__section-title--categories">{t('collections.categoriesTitle')}</h2>
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
