import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import { useApp } from '../../context/AppContext'
import { useLanguage } from '../../context/LanguageContext'
import CuratedListCard from '../../components/CuratedListCard/CuratedListCard'
import './CuratedListsPage.css'

export default function CuratedListsPage() {
  const { t } = useLanguage()
  const { curatedLists } = useApp()
  const activeLists = curatedLists.filter(c => c.active)

  return (
    <div className="cl-page">
      <div className="container cl-page__inner">
        <span className="cl-page__badge">{t('curated.badge')}</span>
        <h1 className="cl-page__title">{t('curated.title')}</h1>
        <p className="cl-page__sub">{t('curated.sub')}</p>
      </div>

      {activeLists.length > 0 ? (
        <div className="container cl-page__swiper-outer">
          <Swiper
            modules={[Navigation]}
            navigation
            slidesPerView={1.15}
            spaceBetween={16}
            breakpoints={{
              540:  { slidesPerView: 2.2 },
              900:  { slidesPerView: 3.2 },
              1200: { slidesPerView: 3.6 },
            }}
            className="cl-page__swiper"
          >
            {activeLists.map(list => (
              <SwiperSlide key={list.id} className="cl-page__slide">
                <CuratedListCard list={list} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      ) : (
        <div className="container">
          <div className="empty-state">
            <span className="empty-state__icon">✍️</span>
            <h3>{t('curated.emptyTitle')}</h3>
            <p>{t('curated.emptyText')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
