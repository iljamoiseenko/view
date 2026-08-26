import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../api/client'
import EventCard from '../../components/EventCard/EventCard'
import PlaceMap from '../../components/PlaceMap/PlaceMap'
import SocialLinks from '../../components/SocialLinks/SocialLinks'
import { mapsUrl } from '../../utils/maps'
import { parseAddresses } from '../../utils/address'
import { getPlaceTypeLabel } from '../../utils/placeType'
import './PlaceDetailPage.css'

export default function PlaceDetailPage() {
  const { id } = useParams()
  const { places, getPlaceEvents } = useApp()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const place = places.find(p => p.id === id)
  const [activePhoto, setActivePhoto] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  // Log one view per place per browser session — enough for owner-facing stats
  // without letting a single visitor inflate the count by refreshing repeatedly.
  useEffect(() => {
    if (!id) return
    const key = `view_logged_${id}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    api.post(`/places/${id}/view`, {}).catch(() => {})
  }, [id])

  if (!place) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <h2>{t('placeDetail.notFoundTitle')}</h2>
        <Link to="/" className="btn btn-dark" style={{ marginTop: 16, display: 'inline-flex' }}>{t('placeDetail.toHome')}</Link>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const events = getPlaceEvents(place.id).filter(e => e.date >= today)
  const photos = place.photos?.length ? place.photos : ['https://picsum.photos/seed/default/800/600']
  const hasSocialLinks = !!(place.website || place.instagramUrl || place.facebookUrl || place.tiktokUrl || place.threadsUrl || place.telegramUrl || place.youtubeUrl)
  const addresses = parseAddresses(place.address)

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
          {t('common.back')}
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
            <span className={`badge badge-${place.type}`}>{getPlaceTypeLabel(place, t)}</span>
            <span className="detail__city">{place.city}</span>
          </div>

          <h1 className="detail__name">{place.name}</h1>

          {place.description && (
            <p className="detail__desc">{place.description}</p>
          )}

          {place.bookingEnabled && place.bookingPhone && (
            <a href={`tel:${place.bookingPhone}`} className="btn btn-dark detail__book-btn">
              {t('placeDetail.book')}
            </a>
          )}

          {place.ticketsUrl && (
            <a href={place.ticketsUrl} target="_blank" rel="noreferrer" className="btn btn-dark detail__book-btn">
              {t('placeDetail.buyTickets')}
            </a>
          )}

          <div className="detail__info-list">
            {addresses.length === 1 && (
              <div className="detail__info-row">
                <span className="detail__info-label">{t('placeDetail.address')}</span>
                <a
                  href={mapsUrl({ lat: place.lat, lng: place.lng, address: `${addresses[0]}, ${place.city}` })}
                  target="_blank"
                  rel="noreferrer"
                  className="detail__info-val detail__link"
                >
                  {addresses[0]}
                </a>
              </div>
            )}
            {addresses.length > 1 && (
              <div className="detail__info-row">
                <span className="detail__info-label">{t('placeDetail.address')}</span>
                <ul className="detail__address-list">
                  {addresses.map((addr, i) => (
                    <li key={i}>
                      <a
                        href={mapsUrl({ address: `${addr}, ${place.city}` })}
                        target="_blank"
                        rel="noreferrer"
                        className="detail__info-val detail__link"
                      >
                        📍 {addr}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {place.workingHours && (
              <div className="detail__info-row">
                <span className="detail__info-label">{t('placeDetail.workingHours')}</span>
                <span className="detail__info-val">{place.workingHours}</span>
              </div>
            )}
            {place.phone && (
              <div className="detail__info-row">
                <span className="detail__info-label">{t('placeDetail.phone')}</span>
                <a href={`tel:${place.phone}`} className="detail__info-val detail__link">{place.phone}</a>
              </div>
            )}
            {place.cuisine && (
              <div className="detail__info-row">
                <span className="detail__info-label">{t('placeDetail.cuisine')}</span>
                <span className="detail__info-val">{place.cuisine}</span>
              </div>
            )}
            {hasSocialLinks && (
              <div className="detail__info-row">
                <span className="detail__info-label">{t('placeDetail.socialLinks')}</span>
                <SocialLinks place={place} />
              </div>
            )}
            {place.menuUrl && (
              <div className="detail__info-row">
                <span className="detail__info-label">{t('placeDetail.menu')}</span>
                <a href={place.menuUrl} target="_blank" rel="noreferrer" className="detail__info-val detail__link">
                  {t('placeDetail.viewMenu')}
                </a>
              </div>
            )}
            {(place.petsFriendly || place.kidsRoom) && (
              <div className="detail__info-row">
                <span className="detail__info-label">{t('placeDetail.amenities')}</span>
                <span className="detail__info-val detail__amenities">
                  {place.petsFriendly && <span className="detail__amenity">🐾 {t('placeDetail.petsFriendly')}</span>}
                  {place.kidsRoom && <span className="detail__amenity">🧸 {t('placeDetail.kidsRoom')}</span>}
                </span>
              </div>
            )}
          </div>

          {place.tags?.length > 0 && (
            <div className="detail__tags">
              {place.tags.map(tag => <span key={tag} className="detail__tag">#{tag}</span>)}
            </div>
          )}

          <PlaceMap lat={place.lat} lng={place.lng} name={place.name} address={place.address} />
        </div>
      </div>

      {/* ── Events ── */}
      {events.length > 0 && (
        <div className="container detail__events">
          <div className="detail__events-head">
            <h2 className="detail__events-title">{t('placeDetail.upcomingEvents')}</h2>
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
