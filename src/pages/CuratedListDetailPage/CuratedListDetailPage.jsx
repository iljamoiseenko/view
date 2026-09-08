import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useLanguage } from '../../context/LanguageContext'
import PlaceCard from '../../components/PlaceCard/PlaceCard'
import { isAllDay } from '../../utils/eventTime'
import './CuratedListDetailPage.css'

const TODAY = new Date().toISOString().slice(0, 10)

function isHappeningNow(time) {
  if (!time) return false
  if (isAllDay(time)) return true
  const now = new Date()
  const [h, m] = time.split(':').map(Number)
  const evMin = h * 60 + m
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return evMin <= nowMin && nowMin <= evMin + 180
}

export default function CuratedListDetailPage() {
  const { id } = useParams()
  const { curatedLists, places, events } = useApp()
  const { t } = useLanguage()

  const list = curatedLists.find(c => c.id === id)

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

  const listPlaces = useMemo(() => {
    if (!list) return []
    return list.placeIds
      .map(pid => places.find(p => p.id === pid))
      .filter(Boolean)
  }, [list, places])

  if (!list) {
    return (
      <div className="sp-not-found container">
        <h2>{t('curated.notFoundTitle')}</h2>
        <Link to="/curated" className="btn btn-dark">{t('placeDetail.toHome')}</Link>
      </div>
    )
  }

  return (
    <div className="cld-page">
      <div className="cld-hero">
        <div className="container">
          <Link to="/curated" className="cld-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            {t('curated.back')}
          </Link>

          <div className="cld-hero__inner">
            {list.icon && <span className="cld-hero__icon">{list.icon}</span>}
            <h1 className="cld-hero__title">{list.title}</h1>
            <div className="cld-hero__author">
              {list.authorAvatar
                ? <img className="cld-hero__avatar" src={list.authorAvatar} alt={list.authorName} />
                : <div className="cld-hero__avatar cld-hero__avatar--empty">{list.authorName?.[0]}</div>
              }
              <div className="cld-hero__author-info">
                <span className="cld-hero__author-name">{list.authorName}</span>
                {list.authorRole && <span className="cld-hero__author-role">{list.authorRole}</span>}
              </div>
            </div>
            <p className="cld-hero__count">
              {listPlaces.length === 0 ? t('curated.noVenues') : t('curated.placesCount', listPlaces.length)}
            </p>
          </div>
        </div>
      </div>

      <div className="container cld-body">
        {listPlaces.length > 0 ? (
          <div className="cld-grid">
            {listPlaces.map((p, i) => (
              <div key={p.id} className="cld-grid__item">
                <span className="cld-grid__rank">{i + 1}</span>
                <PlaceCard
                  place={p}
                  todayEventCount={todayCountByPlace[p.id] || 0}
                  hasNow={nowByPlace.has(p.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-state__icon">{list.icon || '📍'}</span>
            <h3>{t('curated.emptyListTitle')}</h3>
          </div>
        )}
      </div>
    </div>
  )
}
