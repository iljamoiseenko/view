import { memo } from 'react'
import { Link } from 'react-router-dom'
import { PLACE_TYPES, MARKS } from '../../data/initialData'
import './PlaceCard.css'

const PlaceCard = memo(function PlaceCard({ place, todayEventCount = 0, hasNow = false }) {
  const todayEvents = { length: todayEventCount }
  const nowEvents   = { length: hasNow ? 1 : 0 }

  return (
    <Link to={`/place/${place.id}`} className="pcard">
      <div className="pcard__img-wrap">
        <img
          src={place.photos?.[0] || 'https://picsum.photos/seed/default/400/600'}
          alt={place.name}
          className="pcard__img"
          loading="lazy"
        />
        <div className="pcard__overlay" />

        {/* Top badges */}
        <div className="pcard__top">
          <span className={`badge badge-${place.type}`}>
            {PLACE_TYPES[place.type] || place.type}
          </span>
          {nowEvents.length > 0 ? (
            <span className="pcard__live">
              <span className="pcard__live-dot" />
              Зараз
            </span>
          ) : todayEvents.length > 0 ? (
            <span className="pcard__today">TODAY</span>
          ) : null}
        </div>

        {/* Bottom info */}
        <div className="pcard__bottom">
          <div className="pcard__meta-row">
            <span className="pcard__city">{place.city}</span>
            {place.cuisine && <span className="pcard__sep">·</span>}
            {place.cuisine && <span className="pcard__city">{place.cuisine}</span>}
          </div>
          <h3 className="pcard__name">{place.name}</h3>
          {/* Marks badges */}
          {Array.isArray(place.marks) && place.marks.length > 0 && (
            <div className="pcard__marks">
              {place.marks.map(slug => {
                const mark = MARKS.find(m => m.slug === slug)
                return mark ? (
                  <span key={slug} className="pcard__mark">
                    {mark.icon} {mark.label}
                  </span>
                ) : null
              })}
            </div>
          )}
          {todayEvents.length > 0 && (
            <div className="pcard__footer">
              <span className="pcard__events">
                {todayEvents.length} {todayEvents.length === 1 ? 'подія' : 'події'} сьогодні
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
})

export default PlaceCard
