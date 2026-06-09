import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { MARKS } from '../../data/initialData'
import PlaceCard from '../../components/PlaceCard/PlaceCard'
import Pagination from '../../components/Pagination/Pagination'
import './SpecialPage.css'

const PER_PAGE = 8
const TODAY = new Date().toISOString().slice(0, 10)

function isHappeningNow(time) {
  if (!time) return false
  const now = new Date()
  const [h, m] = time.split(':').map(Number)
  const evMin = h * 60 + m
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return evMin <= nowMin && nowMin <= evMin + 180
}

export default function SpecialPage() {
  const { slug } = useParams()
  const { filteredPlaces, events } = useApp()
  const [page, setPage] = useState(1)

  const todayCountByPlace = useMemo(() => {
    const m = {}
    events.filter(e => e.date === TODAY).forEach(e => { m[e.placeId] = (m[e.placeId] || 0) + 1 })
    return m
  }, [events])

  const nowByPlace = useMemo(() => {
    const s = new Set()
    events.filter(e => e.date === TODAY && isHappeningNow(e.time)).forEach(e => s.add(e.placeId))
    return s
  }, [events])

  const mark   = MARKS.find(m => m.slug === slug)
  const places = filteredPlaces.filter(p => Array.isArray(p.marks) && p.marks.includes(slug))

  const pageItems = useMemo(() => {
    const start = (page - 1) * PER_PAGE
    return places.slice(start, start + PER_PAGE)
  }, [places, page])

  if (!mark) {
    return (
      <div className="sp-not-found container">
        <h2>Категорію не знайдено</h2>
        <Link to="/" className="btn btn-dark">На головну</Link>
      </div>
    )
  }

  return (
    <div className="sp-page">
      {/* Hero */}
      <div className="sp-hero">
        <div className="container sp-hero__inner">
          <span className="sp-hero__icon">{mark.icon}</span>
          <div className="sp-hero__text">
            <h1 className="sp-hero__title">{mark.label}</h1>
            <p className="sp-hero__count">
              {places.length === 0
                ? 'Заклади не знайдено'
                : `${places.length} ${places.length === 1 ? 'заклад' : places.length < 5 ? 'заклади' : 'закладів'}`
              }
            </p>
          </div>
          <Link to="/" className="sp-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Назад
          </Link>
        </div>
      </div>

      {/* Grid */}
      <div className="container sp-body">
        {places.length > 0 ? (
          <>
            <div className="sp-grid">
              {pageItems.map(p => (
                <PlaceCard
                  key={p.id}
                  place={p}
                  todayEventCount={todayCountByPlace[p.id] || 0}
                  hasNow={nowByPlace.has(p.id)}
                />
              ))}
            </div>
            <Pagination
              total={places.length}
              page={page}
              perPage={PER_PAGE}
              onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            />
          </>
        ) : (
          <div className="empty-state">
            <span className="empty-state__icon">{mark.icon}</span>
            <h3>Заклади з відміткою «{mark.label}» відсутні</h3>
            <p>Незабаром тут з'являться заклади</p>
            <Link to="/" className="btn btn-dark">На головну</Link>
          </div>
        )}
      </div>
    </div>
  )
}
