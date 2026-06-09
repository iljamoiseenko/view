import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { PLACE_TYPES } from '../../data/initialData'
import EventCard from '../../components/EventCard/EventCard'
import './PlaceDetailPage.css'

export default function PlaceDetailPage() {
  const { id } = useParams()
  const { places, getPlaceEvents } = useApp()
  const navigate = useNavigate()
  const place = places.find(p => p.id === id)
  const [activePhoto, setActivePhoto] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  if (!place) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <h2>Заклад не знайдено</h2>
        <Link to="/" className="btn btn-dark" style={{ marginTop: 16, display: 'inline-flex' }}>На головну</Link>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const events = getPlaceEvents(place.id).filter(e => e.date >= today)
  const photos = place.photos?.length ? place.photos : ['https://picsum.photos/seed/default/800/600']

  const prev = () => setActivePhoto(i => (i - 1 + photos.length) % photos.length)
  const next = () => setActivePhoto(i => (i + 1) % photos.length)

  return (
    <div className="detail">

      {/* ── Nav ── */}
      <div className="container detail__nav">
        <button className="detail__back" onClick={() => navigate(-1)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Назад
        </button>
      </div>

      {/* ── 2-column layout ── */}
      <div className="container detail__layout">

        {/* LEFT: gallery */}
        <div className="detail__gallery">
          <div className="detail__main-photo" onClick={() => setLightbox(true)}>
            <img src={photos[activePhoto]} alt={place.name} />
            {photos.length > 1 && (
              <>
                <button className="detail__nav-btn detail__nav-btn--prev" onClick={e => { e.stopPropagation(); prev() }}>‹</button>
                <button className="detail__nav-btn detail__nav-btn--next" onClick={e => { e.stopPropagation(); next() }}>›</button>
                <span className="detail__photo-count">{activePhoto + 1} / {photos.length}</span>
              </>
            )}
          </div>

          {photos.length > 1 && (
            <div className="detail__thumbs">
              {photos.map((p, i) => (
                <button
                  key={i}
                  className={`detail__thumb ${i === activePhoto ? 'active' : ''}`}
                  onClick={() => setActivePhoto(i)}
                >
                  <img src={p} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: info */}
        <div className="detail__info-col">
          <div className="detail__meta">
            <span className={`badge badge-${place.type}`}>{PLACE_TYPES[place.type]}</span>
            <span className="detail__city">{place.city}</span>
          </div>

          <h1 className="detail__name">{place.name}</h1>

          {place.description && (
            <p className="detail__desc">{place.description}</p>
          )}

          <div className="detail__info-list">
            {place.address && (
              <div className="detail__info-row">
                <span className="detail__info-label">Адреса</span>
                <span className="detail__info-val">{place.address}</span>
              </div>
            )}
            {place.workingHours && (
              <div className="detail__info-row">
                <span className="detail__info-label">Години роботи</span>
                <span className="detail__info-val">{place.workingHours}</span>
              </div>
            )}
            {place.phone && (
              <div className="detail__info-row">
                <span className="detail__info-label">Телефон</span>
                <a href={`tel:${place.phone}`} className="detail__info-val detail__link">{place.phone}</a>
              </div>
            )}
            {place.cuisine && (
              <div className="detail__info-row">
                <span className="detail__info-label">Кухня</span>
                <span className="detail__info-val">{place.cuisine}</span>
              </div>
            )}
            {place.website && (
              <div className="detail__info-row">
                <span className="detail__info-label">Сайт</span>
                <a href={place.website} target="_blank" rel="noreferrer" className="detail__info-val detail__link">
                  {place.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </div>

          {place.tags?.length > 0 && (
            <div className="detail__tags">
              {place.tags.map(t => <span key={t} className="detail__tag">#{t}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* ── Events ── */}
      {events.length > 0 && (
        <div className="container detail__events">
          <div className="detail__events-head">
            <h2 className="detail__events-title">Найближчі події</h2>
            <span className="detail__events-count">{events.length}</span>
          </div>
          <div className="detail__events-grid">
            {events.map(e => <EventCard key={e.id} event={e} />)}
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(false)}>
          <button className="lightbox__close" onClick={() => setLightbox(false)}>✕</button>
          <img
            src={photos[activePhoto]}
            alt={place.name}
            className="lightbox__img"
            onClick={e => e.stopPropagation()}
          />
          {photos.length > 1 && (
            <div className="lightbox__nav" onClick={e => e.stopPropagation()}>
              <button className="lightbox__btn" onClick={prev}>‹</button>
              <span className="lightbox__counter">{activePhoto + 1} / {photos.length}</span>
              <button className="lightbox__btn" onClick={next}>›</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
