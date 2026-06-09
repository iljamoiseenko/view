import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { EVENT_TYPES } from '../../data/initialData'
import EventCard from '../../components/EventCard/EventCard'
import Pagination from '../../components/Pagination/Pagination'
import './EventsPage.css'

const PER_PAGE = 8

const addDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const DATE_TABS = [
  { value: 'all',      label: 'Всі' },
  { value: 'today',    label: 'Сьогодні' },
  { value: 'tomorrow', label: 'Завтра' },
  { value: 'week',     label: 'Тиждень' },
]

const DAYS_UK   = ['Неділя','Понеділок','Вівторок','Середа','Четвер',"П'ятниця",'Субота']
const MONTHS_UK = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня']

export default function EventsPage() {
  const { events, places } = useApp()
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
    else r = r.filter(e => e.date >= today)

    if (typeFilter !== 'all') r = r.filter(e => e.type === typeFilter)

    return r.sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.time.localeCompare(b.time))
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
    const day = DAYS_UK[d.getDay()]
    if (ds === today)    return `Сьогодні — ${d.getDate()} ${MONTHS_UK[d.getMonth()]}`
    if (ds === tomorrow) return `Завтра — ${d.getDate()} ${MONTHS_UK[d.getMonth()]}`
    return `${day}, ${d.getDate()} ${MONTHS_UK[d.getMonth()]}`
  }

  return (
    <div className="events-page">
      <section className="events-hero">
        <div className="container events-hero__inner">
          <p className="events-hero__label">Афіша подій · Харків</p>
          <h1 className="events-hero__title">
            Івенти<br/>
            <span>цього тижня</span>
          </h1>
        </div>
      </section>

      <div className="container">
        <div className="events-filters">
          <div className="events-tabs">
            {DATE_TABS.map(t => (
              <button
                key={t.value}
                className={`events-tab ${dateFilter === t.value ? 'active' : ''}`}
                onClick={() => setDateFilter(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="events-chips">
            <button className={`events-chip ${typeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTypeFilter('all')}>Всі типи</button>
            {Object.entries(EVENT_TYPES).map(([k, v]) => (
              <button
                key={k}
                className={`events-chip ${typeFilter === k ? 'active' : ''}`}
                onClick={() => setTypeFilter(typeFilter === k ? 'all' : k)}
              >{v}</button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon">🎭</span>
            <h3>Подій не знайдено</h3>
            <p>Заклади ще не додали події на цей час</p>
            <button className="btn btn-dark" onClick={() => { setDateFilter('all'); setTypeFilter('all') }}>
              Показати всі
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
