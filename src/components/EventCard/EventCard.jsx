import { Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useLanguage } from '../../context/LanguageContext'
import { getEventTypeLabel } from '../../utils/eventType'
import { formatEventTimeRange, eventEndDate } from '../../utils/eventTime'
import './EventCard.css'

export default function EventCard({ event }) {
  const { places } = useApp()
  const { t } = useLanguage()
  const place = places.find(p => p.id === event.placeId)
  const date = new Date(event.date)

  // A multi-day event within the same month shows as "2–3" in the day slot;
  // crossing a month boundary is rare enough to just show the start day
  // rather than complicate this small badge further.
  const endDateStr = eventEndDate(event)
  const endDate = endDateStr !== event.date ? new Date(endDateStr) : null
  const sameMonth = endDate && date.getMonth() === endDate.getMonth() && date.getFullYear() === endDate.getFullYear()
  const dayLabel = sameMonth ? `${date.getDate()}–${endDate.getDate()}` : date.getDate()

  return (
    <Link to={`/event/${event.id}`} className="ecard" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      <div className="ecard__img-wrap">
        <img
          src={event.image || 'https://picsum.photos/seed/event_default/800/400'}
          alt={event.title}
          className="ecard__img"
          loading="lazy"
        />
        <div className="ecard__date">
          <span className="ecard__date-day">{dayLabel}</span>
          <span className="ecard__date-month">{t('common.monthsShort')[date.getMonth()]}</span>
        </div>
        <span className={`ecard__type badge badge-event-${event.type}`}>
          {getEventTypeLabel(event, t)}
        </span>
      </div>

      <div className="ecard__body">
        <h3 className="ecard__title">{event.title}</h3>
        <p className="ecard__desc">{event.description}</p>

        {place ? (
          <Link to={`/place/${place.id}`} className="ecard__place" onClick={e => e.stopPropagation()}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {place.name} <span className="ecard__place-city">· {place.city}</span>
          </Link>
        ) : event.address ? (
          <span className="ecard__place">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {event.address}
          </span>
        ) : null}

        <div className="ecard__footer">
          <span className="ecard__time">{formatEventTimeRange(event, t)}</span>
          <span className={`ecard__price ${event.price === 0 ? 'free' : ''}`}>
            {event.price === 0 ? t('common.free') : `${event.price} ${t('common.currency')}`}
          </span>
        </div>
      </div>
    </Link>
  )
}
