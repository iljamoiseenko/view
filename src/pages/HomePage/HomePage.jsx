import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { EVENT_TYPES } from '../../data/initialData'
import PlaceCard from '../../components/PlaceCard/PlaceCard'
import EventCard from '../../components/EventCard/EventCard'
import TodayStrip from '../../components/TodayStrip/TodayStrip'
import BannerSlider from '../../components/BannerSlider/BannerSlider'
import Pagination from '../../components/Pagination/Pagination'
import './HomePage.css'

const PER_PAGE = 8

const TYPE_FILTERS = [
  { value: 'all',        label: 'Всі' },
  { value: 'restaurant', label: 'Ресторан' },
  { value: 'cafe',       label: 'Кафе' },
  { value: 'bar',        label: 'Бар' },
  { value: 'coffee',     label: "Кав'ярня" },
  { value: 'pub',        label: 'Паб' },
  { value: 'lounge',     label: 'Лаундж' },
  { value: 'theater',    label: 'Театр' },
  { value: 'exhibition', label: 'Виставка' },
]

const EVENT_DATE_FILTERS = [
  { value: 'all',      label: 'Усі дати' },
  { value: 'today',    label: 'Сьогодні' },
  { value: 'tomorrow', label: 'Завтра' },
  { value: 'week',     label: 'Цей тиждень' },
]

const TODAY    = new Date().toISOString().slice(0, 10)
const TOMORROW = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
const WEEK_END = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

function isHappeningNow(time) {
  if (!time) return false
  const now = new Date()
  const [h, m] = time.split(':').map(Number)
  const evMin  = h * 60 + m
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return evMin <= nowMin && nowMin <= evMin + 180
}

const TICKER_ITEMS = [
  'Заклади', 'Івенти', 'Live Music', 'Ресторани',
  'Бари', 'DJ Night', 'Джаз', "Кав'ярні", 'Виставки',
  'Паби', 'Cocktail Bar', 'Gastro', 'Лаунж', 'Після роботи',
]
const TICKER_FULL = [...TICKER_ITEMS, ...TICKER_ITEMS]

export default function HomePage() {
  const { filteredPlaces, events, banners } = useApp()

  const [activeTab, setActiveTab] = useState('venues')

  // ── Venues tab state ──────────────────────────────
  const [typeFilter,  setTypeFilter]  = useState('all')
  const [quickFilter, setQuickFilter] = useState('all')
  const [search,      setSearch]      = useState('')
  const [placePage,   setPlacePage]   = useState(1)

  // ── Events tab state ──────────────────────────────
  const [evDate,     setEvDate]     = useState('all')
  const [evType,     setEvType]     = useState('all')
  const [eventPage,  setEventPage]  = useState(1)

  // Reset page when filters change
  useEffect(() => { setPlacePage(1) }, [typeFilter, quickFilter, search])
  useEffect(() => { setEventPage(1) }, [evDate, evType])
  useEffect(() => { setPlacePage(1); setEventPage(1) }, [activeTab])

  // Places with events today / now — for quick filters
  const placesWithToday = useMemo(() => {
    const s = new Set()
    events.filter(e => e.date === TODAY).forEach(e => s.add(e.placeId))
    return s
  }, [events])

  const placesWithNow = useMemo(() => {
    const s = new Set()
    events.filter(e => e.date === TODAY && isHappeningNow(e.time)).forEach(e => s.add(e.placeId))
    return s
  }, [events])

  // Per-place event counts for PlaceCard badges (computed once, not per card)
  const todayCountByPlace = useMemo(() => {
    const m = {}
    events.filter(e => e.date === TODAY).forEach(e => { m[e.placeId] = (m[e.placeId] || 0) + 1 })
    return m
  }, [events])

  // Filtered venues (full list)
  const allFilteredPlaces = useMemo(() => {
    let r = filteredPlaces
    if (typeFilter  !== 'all')     r = r.filter(p => p.type === typeFilter)
    if (quickFilter === 'today')   r = r.filter(p => placesWithToday.has(p.id))
    if (quickFilter === 'now')     r = r.filter(p => placesWithNow.has(p.id))
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.cuisine?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q)
      )
    }
    return r
  }, [filteredPlaces, typeFilter, quickFilter, search, placesWithToday, placesWithNow])

  // Paginated venues
  const displayedPlaces = useMemo(() => {
    const start = (placePage - 1) * PER_PAGE
    return allFilteredPlaces.slice(start, start + PER_PAGE)
  }, [allFilteredPlaces, placePage])

  // Filtered events (full list)
  const allFilteredEvents = useMemo(() => {
    let r = events.filter(e => e.date >= TODAY)
    if (evDate === 'today')    r = r.filter(e => e.date === TODAY)
    if (evDate === 'tomorrow') r = r.filter(e => e.date === TOMORROW)
    if (evDate === 'week')     r = r.filter(e => e.date <= WEEK_END)
    if (evType !== 'all')      r = r.filter(e => e.type === evType)
    return r.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
  }, [events, evDate, evType])

  // Paginated events
  const displayedEvents = useMemo(() => {
    const start = (eventPage - 1) * PER_PAGE
    return allFilteredEvents.slice(start, start + PER_PAGE)
  }, [allFilteredEvents, eventPage])

  const scrollToListing = () => {
    document.querySelector('.home__listing')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handlePageChange = (setter) => (page) => {
    setter(page)
    scrollToListing()
  }

  const resetVenues = () => { setTypeFilter('all'); setQuickFilter('all'); setSearch('') }
  const resetEvents = () => { setEvDate('all'); setEvType('all') }
  const hasVenueFilters = typeFilter !== 'all' || quickFilter !== 'all' || search
  const hasEventFilters = evDate !== 'all' || evType !== 'all'

  return (
    <div className="home">

      {/* ── Hero ── */}
      <section className="home__hero">
        <div className="home__ticker" aria-hidden="true">
          <div className="home__ticker-track">
            {TICKER_FULL.map((item, i) => (
              <span key={i} className="home__ticker-item">
                {item} <span className="home__ticker-sep">—</span>
              </span>
            ))}
          </div>
        </div>
        <div className="container home__hero-inner">
          <div className="home__hero-left">
            <h1 className="home__hero-title">
              які<br/>в тебе<br/>плани?
            </h1>
            <p className="home__hero-sub">Знайди де провести час —&nbsp;зараз</p>
          </div>
        </div>
      </section>

      {/* ── Banner Slider ── */}
      <BannerSlider banners={banners} />

      {/* ── Today strip ── */}
      <TodayStrip />

      {/* ── Listing ── */}
      <div className="home__listing">
        <div className="container">

          {/* Search — venues only */}
          {activeTab === 'venues' && (
            <div className="home__search">
              <svg className="home__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className="home__search-input"
                type="text"
                placeholder="Заклад, кухня, адреса..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button className="home__search-clear" onClick={() => setSearch('')}>✕</button>}
            </div>
          )}

          {/* Section tabs */}
          <div className="home__section-tabs">
            <button
              className={`home__section-tab ${activeTab === 'venues' ? 'active' : ''}`}
              onClick={() => setActiveTab('venues')}
            >
              Заклади
              <span className="home__section-tab__count">{filteredPlaces.length}</span>
            </button>
            <button
              className={`home__section-tab ${activeTab === 'events' ? 'active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              Події
              <span className="home__section-tab__count">{events.filter(e => e.date >= TODAY).length}</span>
            </button>
          </div>

          {/* ── VENUES tab ── */}
          {activeTab === 'venues' && (
            <>
              <div className="home__filters">
                <div className="home__filter-group">
                  <div className="home__quick">
                    <button
                      className={`home__quick-btn ${quickFilter === 'now' ? 'active' : ''}`}
                      onClick={() => setQuickFilter(q => q === 'now' ? 'all' : 'now')}
                    >
                      <span className="home__live-dot" />
                      Зараз
                    </button>
                    <button
                      className={`home__quick-btn ${quickFilter === 'today' ? 'active' : ''}`}
                      onClick={() => setQuickFilter(q => q === 'today' ? 'all' : 'today')}
                    >
                      З подіями сьогодні
                    </button>
                  </div>
                  <div className="home__filter-divider" />
                  {TYPE_FILTERS.map(f => (
                    <button
                      key={f.value}
                      className={`home__filter-btn ${typeFilter === f.value ? 'active' : ''}`}
                      onClick={() => setTypeFilter(f.value)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="home__filter-right">
                  <span className="home__count">
                    {allFilteredPlaces.length} {allFilteredPlaces.length === 1 ? 'заклад' : allFilteredPlaces.length < 5 ? 'заклади' : 'закладів'}
                  </span>
                  {hasVenueFilters && (
                    <button className="home__reset" onClick={resetVenues}>Скинути</button>
                  )}
                </div>
              </div>

              {allFilteredPlaces.length > 0 ? (
                <>
                  <div className="home__grid">
                    {displayedPlaces.map(place => (
                      <PlaceCard
                        key={place.id}
                        place={place}
                        todayEventCount={todayCountByPlace[place.id] || 0}
                        hasNow={placesWithNow.has(place.id)}
                      />
                    ))}
                  </div>
                  <Pagination
                    total={allFilteredPlaces.length}
                    page={placePage}
                    perPage={PER_PAGE}
                    onChange={handlePageChange(setPlacePage)}
                  />
                </>
              ) : (
                <div className="empty-state">
                  <span className="empty-state__icon">🔍</span>
                  <h3>Нічого не знайдено</h3>
                  <p>Спробуйте змінити фільтри</p>
                  <button className="btn btn-dark" onClick={resetVenues}>Показати все</button>
                </div>
              )}
            </>
          )}

          {/* ── EVENTS tab ── */}
          {activeTab === 'events' && (
            <>
              <div className="home__filters">
                <div className="home__filter-group">
                  {EVENT_DATE_FILTERS.map(f => (
                    <button
                      key={f.value}
                      className={`home__filter-btn ${evDate === f.value ? 'active' : ''}`}
                      onClick={() => setEvDate(f.value)}
                    >
                      {f.label}
                    </button>
                  ))}
                  <div className="home__filter-divider" />
                  <button
                    className={`home__filter-btn ${evType === 'all' ? 'active' : ''}`}
                    onClick={() => setEvType('all')}
                  >
                    Усі типи
                  </button>
                  {Object.entries(EVENT_TYPES).map(([val, label]) => (
                    <button
                      key={val}
                      className={`home__filter-btn ${evType === val ? 'active' : ''}`}
                      onClick={() => setEvType(val)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="home__filter-right">
                  <span className="home__count">
                    {allFilteredEvents.length} {allFilteredEvents.length === 1 ? 'подія' : allFilteredEvents.length < 5 ? 'події' : 'подій'}
                  </span>
                  {hasEventFilters && (
                    <button className="home__reset" onClick={resetEvents}>Скинути</button>
                  )}
                </div>
              </div>

              {allFilteredEvents.length > 0 ? (
                <>
                  <div className="home__events-grid">
                    {displayedEvents.map(e => <EventCard key={e.id} event={e} />)}
                  </div>
                  <Pagination
                    total={allFilteredEvents.length}
                    page={eventPage}
                    perPage={PER_PAGE}
                    onChange={handlePageChange(setEventPage)}
                  />
                </>
              ) : (
                <div className="empty-state">
                  <span className="empty-state__icon">🎵</span>
                  <h3>Подій не знайдено</h3>
                  <p>Спробуйте змінити фільтр дати або типу</p>
                  <button className="btn btn-dark" onClick={resetEvents}>Показати все</button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}
