import { memo } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { getPlaceTypeLabel } from '../../utils/placeType'
import './PlaceCard.css'

const PlaceCard = memo(function PlaceCard({ place, todayEventCount = 0, hasNow = false }) {
  const { t } = useLanguage()
  const todayEvents = { length: todayEventCount }
  const nowEvents   = { length: hasNow ? 1 : 0 }
  const isTop = !!(place.topUntil && place.topUntil > Date.now())

  // "Ще не відкрились?" — blurred + SOON while no opening date is set yet, or it's
  // still in the future; once the date arrives the blur lifts and it reads NEW.
  // While still "soon", the venue's detail page has nothing to show yet, so the
  // card isn't a link at all — just a static preview.
  const today = new Date().toISOString().slice(0, 10)
  const isOpeningSoon = place.openingSoon && (!place.openingDate || place.openingDate > today)
  const isNewlyOpened = place.openingSoon && !!place.openingDate && place.openingDate <= today

  const openingDateLabel = isOpeningSoon && place.openingDate
    ? `${new Date(place.openingDate).getDate()} ${t('common.monthsFull')[new Date(place.openingDate).getMonth()]}`
    : null

  const content = (
      <div className="pcard__img-wrap">
        <img
          src={place.photos?.[0] || 'https://picsum.photos/seed/default/400/600'}
          alt={place.name}
          className={`pcard__img ${isOpeningSoon ? 'pcard__img--blur' : ''}`}
          loading="lazy"
        />
        <div className="pcard__overlay" />

        {isOpeningSoon && (
          <div className="pcard__opening-date">
            <span className="pcard__opening-date-value">SOON</span>
            {openingDateLabel && (
              <span className="pcard__opening-date-label">{t('common.openingSoonLabel')} · {openingDateLabel}</span>
            )}
          </div>
        )}

        {/* Top ribbon */}
        {isTop && (
          <div className="pcard__ribbon">
            <div className="pcard__ribbon-track">
              <span className="pcard__ribbon-text">
                {Array.from({ length: 6 }).map((_, i) => <span key={i}>{t('common.topBadge')}&nbsp;&nbsp;•&nbsp;&nbsp;</span>)}
              </span>
              <span className="pcard__ribbon-text" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, i) => <span key={i}>{t('common.topBadge')}&nbsp;&nbsp;•&nbsp;&nbsp;</span>)}
              </span>
            </div>
          </div>
        )}

        {/* Top badges */}
        <div className="pcard__top">
          <div className="pcard__top-left">
            <span className={`badge badge-${place.type}`}>
              {getPlaceTypeLabel(place, t)}
            </span>
          </div>
          {isNewlyOpened ? (
            <span className="pcard__opening-badge pcard__opening-badge--new">NEW</span>
          ) : nowEvents.length > 0 ? (
            <span className="pcard__live">
              <span className="pcard__live-dot" />
              {t('common.now')}
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
          {todayEvents.length > 0 && (
            <div className="pcard__footer">
              <span className="pcard__events">
                {t('common.eventsToday', todayEvents.length)}
              </span>
            </div>
          )}
        </div>
      </div>
  )

  return isOpeningSoon
    ? <div className="pcard pcard--soon">{content}</div>
    : <Link to={`/place/${place.id}`} className="pcard">{content}</Link>
})

export default PlaceCard
