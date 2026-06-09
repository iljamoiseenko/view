import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import { useApp } from '../../context/AppContext'
import { EVENT_TYPES, CITIES } from '../../data/initialData'
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
  const navigate = useNavigate()
  const [swiperRef, setSwiperRef] = useState(null)

  const cityPlaceIds = useMemo(
    () => new Set(filteredPlaces.map(p => p.id)),
    [filteredPlaces]
  )

  const todayEvents = useMemo(() =>
    events
      .filter(e => e.date === TODAY && cityPlaceIds.has(e.placeId))
      .sort((a, b) => {
        const aNow = isHappeningNow(a.time) ? 0 : 1
        const bNow = isHappeningNow(b.time) ? 0 : 1
        if (aNow !== bNow) return aNow - bNow
        return (a.time || '').localeCompare(b.time || '')
      }),
    [events, cityPlaceIds]
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
              {selectedCity === 'Усі міста' ? 'закладів' : `в ${selectedCity}`}
            </span>
          </button>
          <span className="ts-stats__dot" />
          <button className="ts-stat-btn" onClick={() => navigate('/events')}>
            <span className="ts-stat__num ts-stat__num--accent">{totalStats.events}</span>
            <span className="ts-stat__label">подій сьогодні</span>
          </button>
        </div>
      </div>

      {/* Events strip */}
      {todayEvents.length > 0 ? (
        <section className="ts-section">
          <div className="container ts-section__head">
            <div className="ts-section__left">
              <span className="ts-tag">
                <span className="ts-tag__dot" />
                сьогодні
              </span>
              <h2 className="ts-section__title">Що відбувається</h2>
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
              <Link to="/events" className="ts-all-link">Всі події →</Link>
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
                0:    { slidesPerView: 1.2, slidesPerGroup: 1 },
                480:  { slidesPerView: 2,   slidesPerGroup: 2 },
                768:  { slidesPerView: 3,   slidesPerGroup: 3 },
                1024: { slidesPerView: 4,   slidesPerGroup: 4 },
              }}
            >
              {todayEvents.map(ev => {
                const place = placeById[ev.placeId]
                const typeName = EVENT_TYPES[ev.type] || ev.type
                const happening = isHappeningNow(ev.time)

                return (
                  <SwiperSlide key={ev.id} className="ts-slide">
                    <Link
                      to={`/place/${ev.placeId}`}
                      className={`ts-card ${happening ? 'ts-card--now' : ''}`}
                    >
                      <div className="ts-card__img-wrap">
                        {ev.image
                          ? <img className="ts-card__img" src={ev.image} alt={ev.title} />
                          : <div className="ts-card__img ts-card__img--empty" />
                        }
                        <div className="ts-card__img-overlay" />
                        <div className="ts-card__top-badges">
                          {happening && (
                            <span className="ts-card__live">
                              <span className="ts-card__live-dot" /> Зараз
                            </span>
                          )}
                          <span className="ts-card__type">{typeName}</span>
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
              <p className="ts-empty__text">Сьогодні немає запланованих подій</p>
              <Link to="/events" className="ts-empty__link">Переглянути всі →</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
