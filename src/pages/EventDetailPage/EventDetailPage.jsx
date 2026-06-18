import { useParams, Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { EVENT_TYPES, PLACE_TYPES } from '../../data/initialData'
import './EventDetailPage.css'

const MONTHS_FULL = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня']
const WEEKDAYS = ['неділя','понеділок','вівторок','середа','четвер','пʼятниця','субота']

export default function EventDetailPage() {
  const { id } = useParams()
  const { events, places } = useApp()
  const navigate = useNavigate()

  const event = events.find(e => e.id === id)
  const place = event ? places.find(p => p.id === event.placeId) : null

  if (!event) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <h2>Подію не знайдено</h2>
        <Link to="/events" className="btn btn-dark" style={{ marginTop: 16, display: 'inline-flex' }}>До подій</Link>
      </div>
    )
  }

  const date = new Date(event.date)
  const dateStr = `${date.getDate()} ${MONTHS_FULL[date.getMonth()]} · ${WEEKDAYS[date.getDay()]}`

  return (
    <div className="edetail">

      {/* ── Nav ── */}
      <div className="container edetail__nav">
        <button className="edetail__back" onClick={() => navigate(-1)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Назад
        </button>
      </div>

      {/* ── 2-column layout ── */}
      <div className="container edetail__layout">

        {/* LEFT: poster */}
        <div className="edetail__gallery">
          <div className="edetail__poster">
            <img
              src={event.image || 'https://picsum.photos/seed/event_default/600/800'}
              alt={event.title}
              className="edetail__poster-img"
            />
            <div className="edetail__poster-badge">
              <span className={`badge badge-event-${event.type}`}>
                {EVENT_TYPES[event.type] || event.type}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: info */}
        <div className="edetail__info">

          <div className="edetail__date-row">
            <span className="edetail__date">{dateStr}</span>
            <span className="edetail__sep">·</span>
            <span className="edetail__time">{event.time}</span>
          </div>

          <h1 className="edetail__title">{event.title}</h1>

          <div className="edetail__price-row">
            {event.price === 0
              ? <span className="edetail__price free">FREE</span>
              : <span className="edetail__price">{event.price} грн</span>
            }
          </div>

          {event.description && (
            <p className="edetail__desc">{event.description}</p>
          )}

          {place && (
            <Link to={`/place/${place.id}`} className="edetail__venue">
              <div className="edetail__venue-img-wrap">
                <img
                  src={place.photos?.[0] || 'https://picsum.photos/seed/default/400/300'}
                  alt={place.name}
                  className="edetail__venue-img"
                />
              </div>
              <div className="edetail__venue-info">
                <span className="edetail__venue-label">Місце проведення</span>
                <span className="edetail__venue-name">{place.name}</span>
                <span className="edetail__venue-meta">
                  {PLACE_TYPES[place.type] || place.type}
                  {place.city && ` · ${place.city}`}
                </span>
                {place.address && (
                  <span className="edetail__venue-address">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    {place.address}
                  </span>
                )}
              </div>
            </Link>
          )}

        </div>
      </div>
    </div>
  )
}
