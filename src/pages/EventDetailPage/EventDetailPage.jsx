import { useParams, Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { EVENT_TYPES, PLACE_TYPES } from '../../data/initialData'
import PlaceMap from '../../components/PlaceMap/PlaceMap'
import { mapsUrl } from '../../utils/maps'
import { buildEventTimes, addToDeviceCalendar } from '../../utils/calendar'
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

  const handleAddToCalendar = () => {
    const { start, end } = buildEventTimes(event.date, event.time)
    const location = place ? [place.name, place.address].filter(Boolean).join(', ') : ''
    addToDeviceCalendar({ title: event.title, description: event.description, location, start, end })
  }

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

          <div className="edetail__actions">
            <button className="btn btn-dark" onClick={handleAddToCalendar}>
              Додати в календар
            </button>
            {place?.bookingEnabled && place?.bookingPhone && (
              <a href={`tel:${place.bookingPhone}`} className="btn btn-outline">
                Забронювати
              </a>
            )}
          </div>

          {event.description && (
            <p className="edetail__desc">{event.description}</p>
          )}

          {place && (
            <div className="edetail__venue-card">
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
                </div>
              </Link>
              {place.address && (
                <a
                  href={mapsUrl({ lat: place.lat, lng: place.lng, address: `${place.address}, ${place.city}` })}
                  target="_blank"
                  rel="noreferrer"
                  className="edetail__venue-address"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  {place.address}
                </a>
              )}
            </div>
          )}

          {place && (
            <PlaceMap lat={place.lat} lng={place.lng} name={place.name} address={place.address} />
          )}

        </div>
      </div>
    </div>
  )
}
