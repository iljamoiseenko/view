import { useState, useEffect } from 'react'
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

// Below this, curated lists render as a plain 2-per-row grid instead of the
// swiper carousel — a touch carousel just for 4-5 cards adds nothing on a
// phone, and matches how every other venue list in the app lays out on
// mobile. Checked in JS (not just CSS) so Swiper never mounts into a
// display:none container, where it would measure a 0-width slide track.
const MOBILE_BREAKPOINT = '(max-width: 700px)'

export default function CollectionsPage() {
  const { t } = useLanguage()
  const { filteredPlaces, curatedLists } = useApp()
  const activeCuratedLists = curatedLists.filter(c => c.active)
  const hasCurated = activeCuratedLists.length > 0
  const [activeTab, setActiveTab] = useState('categories')
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_BREAKPOINT).matches)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_BREAKPOINT)
    const onChange = () => setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <div className="coll-page">
      <div className="container coll-page__inner">
        <span className="coll-page__badge">{t('collections.badge')}</span>
        <h1 className="coll-page__title">{t('collections.title')}</h1>
        <p className="coll-page__sub" style={{ whiteSpace: 'pre-line' }}>
          {t('collections.sub')}
        </p>

        <div className="coll-page__body">
          {hasCurated && (
            <div className="coll-page__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'categories'}
                className={`coll-page__tab ${activeTab === 'categories' ? 'active' : ''}`}
                onClick={() => setActiveTab('categories')}
              >
                {t('collections.categoriesTitle')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'curated'}
                className={`coll-page__tab ${activeTab === 'curated' ? 'active' : ''}`}
                onClick={() => setActiveTab('curated')}
              >
                {t('curated.badge')}
              </button>
            </div>
          )}

          {(!hasCurated || activeTab === 'categories') && (
            <div className="coll-page__categories">
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
          )}

          {hasCurated && activeTab === 'curated' && (
            <div className="coll-page__curated">
              {isMobile ? (
                <div className="coll-page__curated-grid">
                  {activeCuratedLists.map(list => (
                    <CuratedListCard key={list.id} list={list} />
                  ))}
                </div>
              ) : (
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
