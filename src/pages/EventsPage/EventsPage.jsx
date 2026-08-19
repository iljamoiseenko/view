import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { useLanguage } from '../../context/LanguageContext'
import EventCard from '../../components/EventCard/EventCard'
import Pagination from '../../components/Pagination/Pagination'
import './EventsPage.css'

const PER_PAGE = 8

const addDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const DATE_TAB_VALUES = ['all', 'today', 'tomorrow', 'week', 'past']
const EVENT_TYPE_VALUES = ['live_music', 'dj', 'jazz', 'wine', 'beer', 'master_class', 'theme_night', 'cocktail', 'other']

export default function EventsPage() {
  const { events, places } = useApp()
  const { t } = useLanguage()
  const [dateFilter, setDateFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)

  const today    = new Date().toISOString().split('T')[0]
  const tomorrow = addDays(1)
  const weekEnd  = addDays(7)

  useEffect(() => { setPage(1) }, [dateFilter, typeFilter])

  const filtered = useMemo(() => {
    let r = events

    if (dateFilter === 'today')    r = r.filter(e => e.date === today)
    else if (dateFilter === 'tomorrow') r = r.filter(e => e.date === tomorrow)
    else if (dateFilter === 'week') r = r.filter(e => e.date >= today && e.date <= weekEnd)
    else if (dateFilter === 'past') r = r.filter(e => e.date < today)
    else r = r.filter(e => e.date >= today)

    if (typeFilter !== 'all') r = r.filter(e => e.type === typeFilter)

    return r.sort((a, b) => {
      if (dateFilter === 'past') {
        return a.date !== b.date ? b.date.localeCompare(a.date) : b.time.localeCompare(a.time)
      }
      return a.date !== b.date ? a.date.localeCompare(b.date) : a.time.localeCompare(b.time)
    })
  }, [events, dateFilter, typeFilter, today, tomorrow, weekEnd])

  // Paginate
  const paginatedEvents = useMemo(() => {
    const start = (page - 1) * PER_PAGE
    return filtered.slice(start, start + PER_PAGE)
  }, [filtered, page])

  // Group paginated events by date
  const grouped = useMemo(() => {
    const g = {}
    paginatedEvents.forEach(e => { if (!g[e.date]) g[e.date] = []; g[e.date].push(e) })
    return g
  }, [paginatedEvents])

  const formatDate = (ds) => {
    const d   = new Date(ds + 'T00:00:00')
    const day = t('common.weekdaysShort')[d.getDay()]
    const monthDay = `${d.getDate()} ${t('common.monthsFull')[d.getMonth()]}`
    if (ds === today)    return t('events.todayLabel', monthDay)
    if (ds === tomorrow) return t('events.tomorrowLabel', monthDay)
    return `${day}, ${monthDay}`
  }

  return (
    <div className="events-page">
      <section className="events-hero">
        <div className="container events-hero__inner">
          <p className="events-hero__label">{t('events.heroLabel')}</p>
          <h1 className="events-hero__title">
            {t('events.titleLine1')}<br/>
            <span>{t('events.titleLine2')}</span>
          </h1>
        </div>
      </section>

      <div className="container">
        <div className="events-filters">
          <div className="events-tabs">
            {DATE_TAB_VALUES.map(v => (
              <button
                key={v}
                className={`events-tab ${dateFilter === v ? 'active' : ''}`}
                onClick={() => setDateFilter(v)}
              >
                {t(`events.tab${v.charAt(0).toUpperCase()}${v.slice(1)}`)}
              </button>
            ))}
          </div>
          <div className="events-chips">
            <button className={`events-chip ${typeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTypeFilter('all')}>{t('events.typeAll')}</button>
            {EVENT_TYPE_VALUES.map(v => (
              <button
                key={v}
                className={`events-chip ${typeFilter === v ? 'active' : ''}`}
                onClick={() => setTypeFilter(typeFilter === v ? 'all' : v)}
              >{t(`eventTypes.${v}`)}</button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon">🎭</span>
            <h3>{t('events.emptyTitle')}</h3>
            <p>{t('events.emptyText')}</p>
            <button className="btn btn-dark" onClick={() => { setDateFilter('all'); setTypeFilter('all') }}>
              {t('common.showAll')}
            </button>
          </div>
        ) : (
          <>
            <div className="events-list">
              {Object.entries(grouped).map(([date, items]) => (
                <div key={date} className="events-day">
                  <h2 className="events-day__title">{formatDate(date)}</h2>
                  <div className="events-grid">
                    {items.map(e => <EventCard key={e.id} event={e} />)}
                  </div>
                </div>
              ))}
            </div>
            <Pagination
              total={filtered.length}
              page={page}
              perPage={PER_PAGE}
              onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            />
          </>
        )}
      </div>
    </div>
  )
}
