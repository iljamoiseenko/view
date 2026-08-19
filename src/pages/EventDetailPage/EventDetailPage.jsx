import { useParams, Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useLanguage } from '../../context/LanguageContext'
import PlaceMap from '../../components/PlaceMap/PlaceMap'
import { mapsUrl } from '../../utils/maps'
import { parseAddresses } from '../../utils/address'
import { buildEventTimes, addToDeviceCalendar } from '../../utils/calendar'
import { getPlaceTypeLabel } from '../../utils/placeType'
import { getEventTypeLabel } from '../../utils/eventType'
import './EventDetailPage.css'

export default function EventDetailPage() {
  const { id } = useParams()
  const { events, places } = useApp()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const event = events.find(e => e.id === id)
  const place = event ? places.find(p => p.id === event.placeId) : null
  const venueAddresses = place ? parseAddresses(place.address) : []

  if (!event) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <h2>{t('eventDetail.notFoundTitle')}</h2>
        <Link to="/events" className="btn btn-dark" style={{ marginTop: 16, display: 'inline-flex' }}>{t('eventDetail.toEvents')}</Link>
      </div>
    )
  }

  const date = new Date(event.date)
  const dateStr = `${date.getDate()} ${t('common.monthsFull')[date.getMonth()]} · ${t('common.weekdaysFull')[date.getDay()]}`

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
          {t('common.back')}
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
                {getEventTypeLabel(event, t)}
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
              ? <span className="edetail__price free">{t('common.free')}</span>
              : <span className="edetail__price">{event.price} {t('common.currency')}</span>
            }
          </div>

          <div className="edetail__actions">
            <button className="btn btn-dark" onClick={handleAddToCalendar}>
              {t('eventDetail.addToCalendar')}
            </button>
            {place?.bookingEnabled && place?.bookingPhone && (
              <a href={`tel:${place.bookingPhone}`} className="btn btn-outline">
                {t('eventDetail.book')}
              </a>
            )}
            {place?.ticketsUrl && (
              <a href={place.ticketsUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
                {t('eventDetail.buyTickets')}
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
                  <span className="edetail__venue-label">{t('eventDetail.venueLabel')}</span>
                  <span className="edetail__venue-name">{place.name}</span>
                  <span className="edetail__venue-meta">
                    {getPlaceTypeLabel(place, t)}
                    {place.city && ` · ${place.city}`}
                  </span>
                </div>
              </Link>
              {venueAddresses.length === 1 && (
                <a
                  href={mapsUrl({ lat: place.lat, lng: place.lng, address: `${venueAddresses[0]}, ${place.city}` })}
                  target="_blank"
                  rel="noreferrer"
                  className="edetail__venue-address"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  {venueAddresses[0]}
                </a>
              )}
              {venueAddresses.length > 1 && (
                <ul className="edetail__venue-address-list">
                  {venueAddresses.map((addr, i) => (
                    <li key={i}>
                      <a
                        href={mapsUrl({ address: `${addr}, ${place.city}` })}
                        target="_blank"
                        rel="noreferrer"
                        className="edetail__venue-address"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        {addr}
                      </a>
                    </li>
                  ))}
                </ul>
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
