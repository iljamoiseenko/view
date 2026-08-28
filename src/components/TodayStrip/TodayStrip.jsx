import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import { useApp } from '../../context/AppContext'
import { CITIES } from '../../data/initialData'
import { useLanguage } from '../../context/LanguageContext'
import { getEventTypeLabel } from '../../utils/eventType'
import './TodayStrip.css'

const TODAY = new Date().toISOString().slice(0, 10)

function isHappeningNow(time) {
  if (!time) return false
  const now = new Date()
  const [h, m] = time.split(':').map(Number)
  const evMin = h * 60 + m
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return evMin <= nowMin && nowMin <= evMin + 180
}

function formatTime(t) {
  return t ? t.slice(0, 5) : ''
}

export default function TodayStrip() {
  const { events, places, filteredPlaces, selectedCity } = useApp()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [swiperRef, setSwiperRef] = useState(null)

  // Published place IDs (all cities) — used to filter out orphan events
  const publishedPlaceIds = useMemo(
    () => new Set(places.filter(p => p.published).map(p => p.id)),
    [places]
  )

  // Used only for the "events today" stat in the bar above the strip.
  const todayEvents = useMemo(() =>
    events.filter(e => e.date === TODAY && publishedPlaceIds.has(e.placeId)),
    [events, publishedPlaceIds]
  )

  // The strip itself always shows the nearest events — today's (soonest/live
  // first) followed by the closest upcoming ones — instead of only today's.
  const nearestEvents = useMemo(() =>
    events
      .filter(e => e.date >= TODAY && publishedPlaceIds.has(e.placeId))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        if (a.date === TODAY) {
          const aNow = isHappeningNow(a.time) ? 0 : 1
          const bNow = isHappeningNow(b.time) ? 0 : 1
          if (aNow !== bNow) return aNow - bNow
        }
        return (a.time || '').localeCompare(b.time || '')
      })
      .slice(0, 12),
    [events, publishedPlaceIds]
  )

  const placeById = useMemo(() => {
    const m = {}
    places.forEach(p => { m[p.id] = p })
    return m
  }, [places])

  const totalStats = {
    places: filteredPlaces.length,
    events: todayEvents.length,
    cities: CITIES.length,
  }

  return (
    <div className="ts-wrap">
      {/* Stats bar */}
      <div className="ts-stats">
        <div className="container ts-stats__inner">
          <button className="ts-stat-btn" onClick={() => navigate('/')}>
            <span className="ts-stat__num">{totalStats.places}</span>
            <span className="ts-stat__label">
              {selectedCity === 'Усі міста' ? t('todayStrip.venuesLabel') : t('todayStrip.inCity', selectedCity)}
            </span>
          </button>
          <span className="ts-stats__dot" />
          <button className="ts-stat-btn" onClick={() => navigate('/events')}>
            <span className="ts-stat__num ts-stat__num--accent">{totalStats.events}</span>
            <span className="ts-stat__label">{t('todayStrip.eventsToday')}</span>
          </button>
        </div>
      </div>

      {/* Events strip */}
      {nearestEvents.length > 0 ? (
        <section className="ts-section">
          <div className="container ts-section__head">
            <div className="ts-section__left">
              <h2 className="ts-section__title">{t('todayStrip.upcomingTitle')}</h2>
            </div>
            <div className="ts-section__controls">
              <button
                className="ts-arrow"
                onClick={() => swiperRef?.slidePrev()}
                aria-label="prev"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </button>
              <button
                className="ts-arrow"
                onClick={() => swiperRef?.slideNext()}
                aria-label="next"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </button>
              <Link to="/events" className="ts-all-link">{t('todayStrip.allEvents')}</Link>
            </div>
          </div>

          <div className="container ts-swiper-outer">
            <Swiper
              onSwiper={setSwiperRef}
              modules={[Navigation]}
              slidesPerView={4}
              slidesPerGroup={4}
              spaceBetween={14}
              speed={400}
              className="ts-swiper"
              breakpoints={{
                0:    { slidesPerView: 1.8, slidesPerGroup: 1 },
                480:  { slidesPerView: 2.4, slidesPerGroup: 2 },
                768:  { slidesPerView: 3,   slidesPerGroup: 3 },
                1024: { slidesPerView: 4,   slidesPerGroup: 4 },
              }}
            >
              {nearestEvents.map(ev => {
                const place = placeById[ev.placeId]
                const typeName = getEventTypeLabel(ev, t)
                const evIsToday = ev.date === TODAY
                const happening = evIsToday && isHappeningNow(ev.time)
                const evDate = new Date(ev.date)

                return (
                  <SwiperSlide key={ev.id} className="ts-slide">
                    <Link
                      to={`/place/${ev.placeId}`}
                      className={`ts-card ${happening ? 'ts-card--now' : ''}`}
                    >
                      <div className="ts-card__img-wrap">
                        {ev.image
                          ? <img className="ts-card__img" src={ev.image} alt={ev.title} loading="lazy" />
                          : <div className="ts-card__img ts-card__img--empty" />
                        }
                        <div className="ts-card__img-overlay" />
                        <div className="ts-card__top-badges">
                          <div className="ts-card__badges-left">
                            {happening && (
                              <span className="ts-card__live">
                                <span className="ts-card__live-dot" /> {t('common.now')}
                              </span>
                            )}
                            <span className="ts-card__type">{typeName}</span>
                          </div>
                          <div className="ts-card__date">
                            <span className="ts-card__date-day">{evDate.getDate()}</span>
                            <span className="ts-card__date-month">{t('common.monthsShort')[evDate.getMonth()]}</span>
                          </div>
                        </div>
                        {ev.price === 0 && <span className="ts-card__free">FREE</span>}
                      </div>
                      <div className="ts-card__body">
                        <p className="ts-card__title">{ev.title}</p>
                        <div className="ts-card__meta">
                          {place && (
                            <span className="ts-card__place">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                              </svg>
                              {place.name}
                            </span>
                          )}
                          {!evIsToday && (
                            <span className="ts-card__time">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
                              </svg>
                              {evDate.getDate()} {t('common.monthsShort')[evDate.getMonth()]}
                            </span>
                          )}
                          {ev.time && (
                            <span className="ts-card__time">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                              </svg>
                              {formatTime(ev.time)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </SwiperSlide>
                )
              })}
            </Swiper>
          </div>
        </section>
      ) : (
        <div className="ts-empty">
          <div className="container ts-empty__inner">
            <span className="ts-empty__icon">🎵</span>
            <div>
              <p className="ts-empty__text">{t('todayStrip.noEvents')}</p>
              <Link to="/events" className="ts-empty__link">{t('todayStrip.viewAll')}</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
