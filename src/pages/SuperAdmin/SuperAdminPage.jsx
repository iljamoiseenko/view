import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../api/client'
import { PLACE_TYPES, EVENT_TYPES, CITIES, CUISINE_LIST, TICKET_TYPES, COLLECTIONS, SUBSCRIPTION_TIERS } from '../../data/initialData'
import { getPlaceTypeLabel } from '../../utils/placeType'
import { getEventTypeLabel } from '../../utils/eventType'
import './SuperAdminPage.css'

const EMPTY_PLACE = {
  name: '', type: 'restaurant', city: CITIES[0], address: '',
  description: '', cuisine: '', phone: '', workingHours: '',
  website: '', menuUrl: '', photos: [''], tags: '', collections: [], rating: '',
  petsFriendly: false, kidsRoom: false, ticketsUrl: '', customType: '',
  instagramUrl: '', facebookUrl: '', tiktokUrl: '', threadsUrl: '', telegramUrl: '', youtubeUrl: '',
}
const EMPTY_EVENT = {
  placeId: '', title: '', description: '', date: '',
  time: '19:00', type: 'live_music', price: 0, image: '', customType: '',
}
const EMPTY_ACCOUNT = { name: '', username: '', password: '', placeId: '' }
const EMPTY_BANNER = {
  title: '', subtitle: '', image: '', linkSlug: COLLECTIONS[0]?.slug || '',
  bgColor: '#1a1a1a', sortOrder: 0,
}

// ── Reusable Modal ───────────────────────────────────────────────────────────
function Modal({ title, onClose, children, size }) {
  return (
    <div className="sa-overlay" onClick={onClose}>
      <div className={`sa-modal ${size === 'sm' ? 'sa-modal--sm' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="sa-modal__head">
          <h2>{title}</h2>
          <button className="sa-modal__close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Image Upload Input ───────────────────────────────────────────────────────
function ImageInput({ value, onChange, placeholder }) {
  const { t } = useLanguage()
  const inputRef = useRef()
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('image', file)
      const token = localStorage.getItem('view_token')
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (data.url) onChange(data.url)
    } catch { /* silently fail */ }
    finally { setUploading(false) }
  }

  return (
    <div className="sa-img-input">
      {value && (
        <div className="sa-img-preview">
          <img src={value} alt="" />
          <button type="button" className="sa-img-remove" onClick={() => onChange('')}>✕</button>
        </div>
      )}
      <div className="sa-img-controls">
        <input
          className="input"
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || 'https://...'}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="sa-upload-btn"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? '...' : t('superAdmin.uploadFile')}
        </button>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>
    </div>
  )
}

// ── Place Stats (view analytics — superadmin bypasses the Standard/Pro gate) ──
function PlaceStats({ placeId }) {
  const { t, lang } = useLanguage()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/places/${placeId}/stats`).then(setData).catch(err => setError(err.message))
  }, [placeId])

  if (error) return <div className="sa-modal-body"><p className="sa-empty">{error}</p></div>
  if (!data) return <div className="sa-modal-body"><p className="sa-empty">{t('venueAdmin.statsLoading')}</p></div>

  const max = Math.max(1, ...data.daily.map(d => d.count))

  return (
    <div className="sa-modal-body">
      <div className="va-stats-cards">
        <div className="va-stats-card">
          <div className="va-stats-card__value">{data.total}</div>
          <div className="va-stats-card__label">{t('venueAdmin.statsTotalViews')}</div>
        </div>
        <div className="va-stats-card">
          <div className="va-stats-card__value">{data.last7}</div>
          <div className="va-stats-card__label">{t('venueAdmin.statsLast7')}</div>
        </div>
        <div className="va-stats-card">
          <div className="va-stats-card__value">{data.last30}</div>
          <div className="va-stats-card__label">{t('venueAdmin.statsLast30')}</div>
        </div>
      </div>
      <div className="va-stats-chart-title">{t('venueAdmin.statsChartTitle')}</div>
      <div className="va-stats-chart">
        {data.daily.map(d => (
          <div key={d.date} className="va-stats-bar" title={`${new Date(d.date).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US')}: ${d.count}`}>
            <div className="va-stats-bar__fill" style={{ height: `${Math.max(Math.round((d.count / max) * 100), d.count > 0 ? 6 : 2)}%` }} />
            <div className="va-stats-bar__day">{new Date(d.date).getDate()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Place Form ───────────────────────────────────────────────────────────────
function PlaceForm({ initial, onSave, onClose }) {
  const { t } = useLanguage()
  const [f, setF] = useState({
    ...EMPTY_PLACE,
    ...initial,
    photos: initial?.photos?.length ? initial.photos : [''],
    tags: Array.isArray(initial?.tags) ? initial.tags.join(', ') : (initial?.tags || ''),
    collections: Array.isArray(initial?.collections) ? initial.collections : [],
  })
  const isTicketType = TICKET_TYPES.includes(f.type)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const setPhoto = (i, v) => { const a = [...f.photos]; a[i] = v; set('photos', a) }
  const toggleCollection = (slug) => {
    set('collections', f.collections.includes(slug) ? f.collections.filter(c => c !== slug) : [...f.collections, slug])
  }

  const submit = (e) => {
    e.preventDefault()
    onSave({
      ...f,
      photos: f.photos.filter(Boolean),
      tags: f.tags ? f.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      rating: f.rating ? parseFloat(f.rating) : undefined,
    })
  }

  return (
    <form onSubmit={submit} className="sa-form">
      <div className="sa-grid">
        <div className="sa-col2"><label className="sa-label">{t('superAdmin.fieldName')}</label>
          <input className="input" required value={f.name} onChange={e => set('name', e.target.value)} /></div>
        <div><label className="sa-label">{t('superAdmin.fieldType')}</label>
          <select className="input" value={f.type} onChange={e => set('type', e.target.value)}>
            {Object.keys(PLACE_TYPES).map(k => <option key={k} value={k}>{t(`placeTypes.${k}`)}</option>)}</select>
          {f.type === 'other' && (
            <input className="input" style={{ marginTop: 6 }}
              placeholder={t('superAdmin.customTypePh')}
              value={f.customType || ''}
              onChange={e => set('customType', e.target.value)} />
          )}
        </div>
        <div><label className="sa-label">{t('superAdmin.fieldCity')}</label>
          <select className="input" value={f.city} onChange={e => set('city', e.target.value)}>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="sa-col2"><label className="sa-label">{t('superAdmin.fieldAddress')}</label>
          <input className="input" required value={f.address} onChange={e => set('address', e.target.value)} /></div>
        {!isTicketType && (
          <div><label className="sa-label">{t('superAdmin.fieldCuisine')}</label>
            <input className="input" list="sa-cuisine" value={f.cuisine} onChange={e => set('cuisine', e.target.value)} />
            <datalist id="sa-cuisine">{CUISINE_LIST.map(c => <option key={c} value={c} />)}</datalist></div>
        )}
        <div><label className="sa-label">{t('superAdmin.fieldRating')}</label>
          <input className="input" type="number" min="1" max="5" step="0.1" value={f.rating} onChange={e => set('rating', e.target.value)} /></div>
        <div><label className="sa-label">{t('superAdmin.fieldPhone')}</label>
          <input className="input" value={f.phone} onChange={e => set('phone', e.target.value)} /></div>
        <div><label className="sa-label">{t('superAdmin.fieldWorkingHours')}</label>
          <input className="input" value={f.workingHours} onChange={e => set('workingHours', e.target.value)} placeholder={t('superAdmin.fieldWorkingHoursPh')} /></div>
        <div className="sa-col2"><label className="sa-label">{t('superAdmin.fieldWebsite')}</label>
          <input className="input" type="url" value={f.website} onChange={e => set('website', e.target.value)} placeholder="https://" /></div>
        <div className="sa-col2"><label className="sa-label">{t('superAdmin.fieldMenuUrl')}</label>
          <input className="input" type="url" value={f.menuUrl || ''} onChange={e => set('menuUrl', e.target.value)} placeholder={t('superAdmin.menuUrlPh')} /></div>
        <div className="sa-col2"><label className="sa-label">{t('superAdmin.fieldDescription')}</label>
          <textarea className="input textarea" rows={3} value={f.description} onChange={e => set('description', e.target.value)} /></div>
        <div className="sa-col2"><label className="sa-label">{t('superAdmin.fieldTags')}</label>
          <input className="input" value={f.tags} onChange={e => set('tags', e.target.value)} placeholder={t('superAdmin.fieldTagsPh')} /></div>
        {/* Socials */}
        <div className="sa-col2">
          <label className="sa-label">{t('superAdmin.sectionSocials')}</label>
          <div className="sa-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <input className="input" type="url" value={f.instagramUrl || ''} onChange={e => set('instagramUrl', e.target.value)} placeholder={t('superAdmin.fieldInstagram')} />
            <input className="input" type="url" value={f.facebookUrl || ''} onChange={e => set('facebookUrl', e.target.value)} placeholder={t('superAdmin.fieldFacebook')} />
            <input className="input" type="url" value={f.tiktokUrl || ''} onChange={e => set('tiktokUrl', e.target.value)} placeholder={t('superAdmin.fieldTiktok')} />
            <input className="input" type="url" value={f.threadsUrl || ''} onChange={e => set('threadsUrl', e.target.value)} placeholder={t('superAdmin.fieldThreads')} />
            <input className="input" type="url" value={f.telegramUrl || ''} onChange={e => set('telegramUrl', e.target.value)} placeholder={t('superAdmin.fieldTelegram')} />
            <input className="input" type="url" value={f.youtubeUrl || ''} onChange={e => set('youtubeUrl', e.target.value)} placeholder={t('superAdmin.fieldYoutube')} />
          </div>
        </div>
        {/* Booking / Tickets */}
        {!isTicketType && (
          <div className="sa-col2">
            <label className="sa-label">{t('superAdmin.fieldBooking')}</label>
            <label className="toggle-switch">
              <input type="checkbox" checked={!!f.bookingEnabled} onChange={e => set('bookingEnabled', e.target.checked)} />
              <span className="toggle-switch__track" />
              <span className="toggle-switch__label">{t('superAdmin.bookingToggle')}</span>
            </label>
            {f.bookingEnabled && (
              <input className="input" type="tel" required style={{ marginTop: 10, maxWidth: 320 }}
                value={f.bookingPhone || ''} onChange={e => set('bookingPhone', e.target.value)}
                placeholder={t('superAdmin.bookingPhonePh')} />
            )}
          </div>
        )}
        {isTicketType && (
          <div className="sa-col2">
            <label className="sa-label">{t('superAdmin.fieldTicketsUrl')}</label>
            <input className="input" type="url" style={{ maxWidth: 400 }}
              value={f.ticketsUrl || ''} onChange={e => set('ticketsUrl', e.target.value)}
              placeholder={t('superAdmin.ticketsUrlPh')} />
          </div>
        )}
        {/* Amenities */}
        <div className="sa-col2">
          <label className="sa-label">{t('superAdmin.fieldAmenities')}</label>
          <div className="va-amenities">
            <label className="toggle-switch">
              <input type="checkbox" checked={!!f.petsFriendly} onChange={e => set('petsFriendly', e.target.checked)} />
              <span className="toggle-switch__track" />
              <span className="toggle-switch__label">{t('superAdmin.petsFriendlyToggle')}</span>
            </label>
            <label className="toggle-switch">
              <input type="checkbox" checked={!!f.kidsRoom} onChange={e => set('kidsRoom', e.target.checked)} />
              <span className="toggle-switch__track" />
              <span className="toggle-switch__label">{t('superAdmin.kidsRoomToggle')}</span>
            </label>
          </div>
        </div>
        {/* Collections */}
        <div className="sa-col2">
          <label className="sa-label">{t('superAdmin.fieldCollections')}</label>
          <div className="sa-marks">
            {COLLECTIONS.map(c => (
              <label key={c.slug} className={`sa-mark-check ${f.collections.includes(c.slug) ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={f.collections.includes(c.slug)}
                  onChange={() => toggleCollection(c.slug)}
                />
                <span>{c.icon} {t(`collectionsList.${c.slug}`)}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="sa-col2">
          <label className="sa-label">{t('superAdmin.fieldPhotos')}</label>
          {f.photos.map((ph, i) => (
            <div key={i} className="sa-photo-row">
              <input className="input" value={ph} placeholder="https://..." onChange={e => setPhoto(i, e.target.value)} />
              {f.photos.length > 1 && <button type="button" className="sa-rm-btn" onClick={() => set('photos', f.photos.filter((_, j) => j !== i))}>✕</button>}
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => set('photos', [...f.photos, ''])}>{t('superAdmin.addPhoto')}</button>
        </div>
      </div>
      <div className="sa-modal__foot">
        <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
        <button type="submit" className="btn btn-dark">{initial?.id ? t('common.save') : t('common.add')}</button>
      </div>
    </form>
  )
}

// ── Event Form ───────────────────────────────────────────────────────────────
function EventForm({ initial, places, onSave, onClose }) {
  const { t } = useLanguage()
  const [f, setF] = useState({ ...EMPTY_EVENT, placeId: places[0]?.id || '', ...initial })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ ...f, price: Number(f.price) }) }} className="sa-form">
      <div className="sa-grid">
        <div className="sa-col2"><label className="sa-label">{t('superAdmin.fieldVenue')}</label>
          <select className="input" required value={f.placeId} onChange={e => set('placeId', e.target.value)}>
            {places.map(p => <option key={p.id} value={p.id}>{p.name} ({p.city})</option>)}</select></div>
        <div className="sa-col2"><label className="sa-label">{t('superAdmin.fieldEventTitle')}</label>
          <input className="input" required value={f.title} onChange={e => set('title', e.target.value)} /></div>
        <div><label className="sa-label">{t('superAdmin.fieldType')}</label>
          <select className="input" value={f.type} onChange={e => set('type', e.target.value)}>
            {Object.keys(EVENT_TYPES).map(k => <option key={k} value={k}>{t(`eventTypes.${k}`)}</option>)}</select>
          {f.type === 'other' && (
            <input className="input" style={{ marginTop: 6 }}
              placeholder={t('superAdmin.customTypePh')}
              value={f.customType || ''}
              onChange={e => set('customType', e.target.value)} />
          )}
        </div>
        <div><label className="sa-label">{t('superAdmin.fieldPriceFree')}</label>
          <input className="input" type="number" min="0" value={f.price} onChange={e => set('price', e.target.value)} /></div>
        <div><label className="sa-label">{t('superAdmin.fieldDate')}</label>
          <input className="input" type="date" required value={f.date} onChange={e => set('date', e.target.value)} /></div>
        <div><label className="sa-label">{t('superAdmin.fieldTime')}</label>
          <input className="input" type="time" required value={f.time} onChange={e => set('time', e.target.value)} /></div>
        <div className="sa-col2"><label className="sa-label">{t('superAdmin.fieldDescription')}</label>
          <textarea className="input textarea" rows={3} required value={f.description} onChange={e => set('description', e.target.value)} /></div>
        <div className="sa-col2"><label className="sa-label">{t('superAdmin.fieldImage')}</label>
          <input className="input" type="url" value={f.image} onChange={e => set('image', e.target.value)} placeholder="https://..." /></div>
      </div>
      <div className="sa-modal__foot">
        <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
        <button type="submit" className="btn btn-dark">{initial?.id ? t('common.save') : t('common.add')}</button>
      </div>
    </form>
  )
}

// ── Account Form ─────────────────────────────────────────────────────────────
function AccountForm({ places, onSave, onClose }) {
  const { t } = useLanguage()
  const [f, setF] = useState({ ...EMPTY_ACCOUNT, placeId: places[0]?.id || '' })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f) }} className="sa-form">
      <div className="sa-grid">
        <div className="sa-col2"><label className="sa-label">{t('superAdmin.fieldVenueName')}</label>
          <input className="input" required value={f.name} onChange={e => set('name', e.target.value)} placeholder={t('superAdmin.venueNamePh')} /></div>
        <div className="sa-col2"><label className="sa-label">{t('superAdmin.fieldLogin')}</label>
          <input className="input" required value={f.username} onChange={e => set('username', e.target.value)} placeholder={t('superAdmin.loginPh')} /></div>
        <div className="sa-col2"><label className="sa-label">{t('superAdmin.fieldPassword')}</label>
          <input className="input" required value={f.password} onChange={e => set('password', e.target.value)} minLength={6} placeholder={t('superAdmin.passwordPh')} /></div>
        <div className="sa-col2"><label className="sa-label">{t('superAdmin.fieldLinkVenue')}</label>
          <select className="input" value={f.placeId} onChange={e => set('placeId', e.target.value)}>
            <option value="">{t('superAdmin.selectVenue')}</option>
            {places.map(p => <option key={p.id} value={p.id}>{p.name} ({p.city})</option>)}
          </select></div>
      </div>
      <div className="sa-modal__foot">
        <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
        <button type="submit" className="btn btn-dark">{t('superAdmin.createAccountBtn')}</button>
      </div>
    </form>
  )
}

// ── Banner Form ───────────────────────────────────────────────────────────────
function BannerForm({ initial, onSave, onClose }) {
  const { t } = useLanguage()
  const [f, setF] = useState({ ...EMPTY_BANNER, ...initial })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f) }} className="sa-form">
      <div className="sa-grid">
        <div className="sa-col2">
          <label className="sa-label">{t('superAdmin.fieldBannerImage')}</label>
          <ImageInput value={f.image} onChange={v => set('image', v)} placeholder={t('superAdmin.bannerImagePh')} />
        </div>
        <div className="sa-col2">
          <label className="sa-label">{t('superAdmin.fieldTitle')}</label>
          <input className="input" required value={f.title} onChange={e => set('title', e.target.value)} placeholder={t('superAdmin.bannerTitlePh')} />
        </div>
        <div className="sa-col2">
          <label className="sa-label">{t('superAdmin.fieldSubtitle')}</label>
          <input className="input" value={f.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder={t('superAdmin.bannerSubtitlePh')} />
        </div>
        <div>
          <label className="sa-label">{t('superAdmin.fieldCategory')}</label>
          <select className="input" required value={f.linkSlug} onChange={e => set('linkSlug', e.target.value)}>
            {COLLECTIONS.map(m => (
              <option key={m.slug} value={m.slug}>{m.icon} {t(`collectionsList.${m.slug}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="sa-label">{t('superAdmin.fieldBgColor')}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={f.bgColor} onChange={e => set('bgColor', e.target.value)} style={{ width: 44, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
            <input className="input" value={f.bgColor} onChange={e => set('bgColor', e.target.value)} style={{ flex: 1 }} placeholder="#1a1a1a" />
          </div>
        </div>
        <div>
          <label className="sa-label">{t('superAdmin.fieldSortOrder')}</label>
          <input className="input" type="number" min="0" value={f.sortOrder} onChange={e => set('sortOrder', Number(e.target.value))} />
        </div>
        {/* Banner preview */}
        {(f.image || f.title) && (
          <div className="sa-col2">
            <label className="sa-label">{t('superAdmin.previewLabel')}</label>
            <div className="sa-banner-preview" style={f.image ? { backgroundImage: `url(${f.image})` } : { background: f.bgColor }}>
              <div className="sa-banner-preview__overlay" />
              <div className="sa-banner-preview__content">
                {f.subtitle && <p className="sa-banner-preview__sub">{f.subtitle}</p>}
                <h3 className="sa-banner-preview__title">{f.title || t('superAdmin.previewTitleFallback')}</h3>
                <span className="sa-banner-preview__cta">{t('superAdmin.watch')}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="sa-modal__foot">
        <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
        <button type="submit" className="btn btn-dark">{initial?.id ? t('common.save') : t('superAdmin.addBanner')}</button>
      </div>
    </form>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const { currentUser, logout } = useAuth()
  const { places, events, banners, addPlace, updatePlace, deletePlace, addEvent, updateEvent, deleteEvent, addBanner, updateBanner, deleteBanner, reload } = useApp()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const [tab, setTab] = useState('places')
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [venueUsers, setVenueUsers] = useState([])
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeResult, setGeocodeResult] = useState(null)
  const [viewsSummary, setViewsSummary] = useState({})

  useEffect(() => {
    api.get('/users').then(users => setVenueUsers(users.filter(u => u.role === 'venue'))).catch(() => {})
  }, [])

  useEffect(() => {
    api.get('/places/views-summary').then(setViewsSummary).catch(() => {})
  }, [])

  const handleSavePlace = async (data) => {
    if (data.id) await updatePlace(data.id, data)
    else await addPlace(data)
    setModal(null)
  }

  const handleSaveEvent = async (data) => {
    if (data.id) await updateEvent(data.id, data)
    else await addEvent(data)
    setModal(null)
  }

  const handleSaveAccount = async (data) => {
    const created = await api.post('/users', data)
    setVenueUsers(prev => [...prev, created])
    setModal(null)
  }

  const handleSaveBanner = async (data) => {
    if (data.id) await updateBanner(data.id, data)
    else await addBanner(data)
    setModal(null)
  }

  const handleToggleBoost = async (p) => {
    const isActive = p.topUntil && p.topUntil > Date.now()
    if (isActive) await api.delete(`/places/${p.id}/boost`)
    else await api.post(`/places/${p.id}/boost`, {})
    await reload()
  }

  const handleToggleActive = async (u) => {
    const updated = await api.put(`/users/${u.id}`, { isActive: !u.isActive })
    setVenueUsers(prev => prev.map(x => x.id === u.id ? updated : x))
  }

  const handleChangeTier = async (u, tier) => {
    const updated = await api.put(`/users/${u.id}`, { subscriptionTier: tier })
    setVenueUsers(prev => prev.map(x => x.id === u.id ? updated : x))
  }

  const handleToggleBanner = async (b) => {
    await updateBanner(b.id, { active: !b.active })
  }

  const handleConfirm = async () => {
    if (!confirm) return
    if (confirm.type === 'place') await deletePlace(confirm.id)
    else if (confirm.type === 'event') await deleteEvent(confirm.id)
    else if (confirm.type === 'banner') await deleteBanner(confirm.id)
    else if (confirm.type === 'account') {
      await api.delete(`/users/${confirm.id}`)
      setVenueUsers(prev => prev.filter(u => u.id !== confirm.id))
    }
    setConfirm(null)
  }

  const getPlaceName = (pid) => places.find(p => p.id === pid)?.name || '—'

  const handleGeocodeMissing = async () => {
    setGeocoding(true)
    setGeocodeResult(null)
    try {
      const result = await api.post('/places/geocode-missing', {})
      setGeocodeResult(result)
      await reload()
    } catch {
      setGeocodeResult({ error: true })
    } finally {
      setGeocoding(false)
    }
  }

  return (
    <div className="sa-page">
      <div className="sa-topbar">
        <div className="container sa-topbar__inner">
          <div className="sa-topbar__brand">
            <span className="sa-topbar__logo">VIEW</span>
            <span className="sa-topbar__role">{t('superAdmin.role')}</span>
          </div>
          <div className="sa-topbar__stats">
            <span>{t('superAdmin.statVenues', places.length)}</span>
            <span>·</span>
            <span>{t('superAdmin.statEvents', events.length)}</span>
            <span>·</span>
            <span>{t('superAdmin.statBanners', banners.length)}</span>
            <span>·</span>
            <span>{t('superAdmin.statAccounts', venueUsers.length)}</span>
          </div>
          <button className="sa-logout" onClick={() => { logout(); navigate('/') }}>{t('superAdmin.logout')}</button>
        </div>
      </div>

      <div className="container sa-body">
        <div className="sa-tabs">
          {[
            { v: 'places',   l: t('superAdmin.tabVenues'),   c: places.length },
            { v: 'events',   l: t('superAdmin.tabEvents'),   c: events.length },
            { v: 'banners',  l: t('superAdmin.tabBanners'),  c: banners.length },
            { v: 'accounts', l: t('superAdmin.tabAccounts'), c: venueUsers.length },
          ].map(tb => (
            <button key={tb.v} className={`sa-tab ${tab === tb.v ? 'active' : ''}`} onClick={() => setTab(tb.v)}>
              {tb.l} <span className="sa-tab__count">{tb.c}</span>
            </button>
          ))}
        </div>

        {/* ── PLACES ── */}
        {tab === 'places' && (
          <div className="sa-section">
            <div className="sa-section__head">
              <h2>{t('superAdmin.tabVenues')}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {geocodeResult && !geocodeResult.error && (
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    {t('superAdmin.geocodeDone', geocodeResult.updated, geocodeResult.total)}
                    {geocodeResult.failed?.length > 0 && t('superAdmin.geocodeFailed', geocodeResult.failed.length)}
                  </span>
                )}
                {geocodeResult?.error && (
                  <span style={{ fontSize: 13, color: 'var(--vivid)' }}>{t('superAdmin.geocodeError')}</span>
                )}
                <button className="btn btn-outline btn-sm" onClick={handleGeocodeMissing} disabled={geocoding}>
                  {geocoding ? t('superAdmin.geocodeRunning') : t('superAdmin.geocodeButton')}
                </button>
                <button className="btn btn-dark btn-sm" onClick={() => setModal({ type: 'place', data: null })}>{t('superAdmin.addVenue')}</button>
              </div>
            </div>
            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead><tr>
                  <th>{t('superAdmin.thPhoto')}</th><th>{t('superAdmin.thName')}</th><th>{t('superAdmin.thType')}</th><th>{t('superAdmin.thCity')}</th>
                  <th>{t('superAdmin.thCollections')}</th><th>{t('superAdmin.thRating')}</th><th>{t('superAdmin.thEvents')}</th><th>{t('superAdmin.thViews')}</th><th>{t('superAdmin.thActions')}</th>
                </tr></thead>
                <tbody>
                  {places.map(p => {
                    const isTop = p.topUntil && p.topUntil > Date.now()
                    return (
                    <tr key={p.id} className={isTop ? 'sa-row--boosted' : ''}>
                      <td><img src={p.photos?.[0] || 'https://picsum.photos/seed/d/60/40'} alt="" className="sa-thumb" /></td>
                      <td>
                        <span className="sa-main">{isTop && '🚀 '}{p.name}</span>
                        <span className="sa-sub">{p.address}</span>
                      </td>
                      <td><span className={`badge badge-${p.type}`}>{getPlaceTypeLabel(p, t)}</span></td>
                      <td>{p.city}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {Array.isArray(p.collections) && p.collections.map(slug => {
                            const c = COLLECTIONS.find(x => x.slug === slug)
                            return c ? <span key={slug} className="sa-mark-badge">{c.icon}</span> : null
                          })}
                        </div>
                      </td>
                      <td>{p.rating ? `${p.rating}` : '—'}</td>
                      <td className="sa-center">{events.filter(e => e.placeId === p.id).length}</td>
                      <td className="sa-center">
                        <button className="sa-views-btn" onClick={() => setModal({ type: 'stats', data: p })}>
                          {viewsSummary[p.id] || 0}
                        </button>
                      </td>
                      <td>
                        <div className="sa-actions">
                          <button
                            className="sa-icon-btn"
                            title={isTop ? t('superAdmin.unboostButton') : t('superAdmin.boostButton')}
                            onClick={() => handleToggleBoost(p)}
                          >
                            {isTop ? '⬇️' : '🚀'}
                          </button>
                          <button className="sa-icon-btn" onClick={() => setModal({ type: 'place', data: p })}>✏️</button>
                          <button className="sa-icon-btn" onClick={() => setConfirm({ type: 'place', id: p.id, name: p.name })}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
              {places.length === 0 && <div className="sa-empty">{t('superAdmin.noVenues')}</div>}
            </div>
          </div>
        )}

        {/* ── EVENTS ── */}
        {tab === 'events' && (
          <div className="sa-section">
            <div className="sa-section__head">
              <h2>{t('superAdmin.tabEvents')}</h2>
              <button className="btn btn-dark btn-sm" onClick={() => setModal({ type: 'event', data: null })} disabled={places.length === 0}>
                {t('superAdmin.addEvent')}
              </button>
            </div>
            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead><tr>
                  <th>{t('superAdmin.thEventTitle')}</th><th>{t('superAdmin.thEventType')}</th><th>{t('superAdmin.thEventVenue')}</th>
                  <th>{t('superAdmin.thDate')}</th><th>{t('superAdmin.thTime')}</th><th>{t('superAdmin.thPrice')}</th><th>{t('superAdmin.thActions')}</th>
                </tr></thead>
                <tbody>
                  {[...events].sort((a, b) => a.date.localeCompare(b.date)).map(ev => (
                    <tr key={ev.id}>
                      <td className="sa-main">{ev.title}</td>
                      <td><span className={`badge badge-event-${ev.type}`}>{getEventTypeLabel(ev, t)}</span></td>
                      <td className="sa-muted">{getPlaceName(ev.placeId)}</td>
                      <td>{ev.date}</td>
                      <td>{ev.time}</td>
                      <td>{ev.price === 0 ? <span className="sa-free">{t('common.free')}</span> : `${ev.price} ${t('common.currency')}`}</td>
                      <td>
                        <div className="sa-actions">
                          <button className="sa-icon-btn" onClick={() => setModal({ type: 'event', data: ev })}>✏️</button>
                          <button className="sa-icon-btn" onClick={() => setConfirm({ type: 'event', id: ev.id, name: ev.title })}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {events.length === 0 && <div className="sa-empty">{t('superAdmin.noEvents')}</div>}
            </div>
          </div>
        )}

        {/* ── BANNERS ── */}
        {tab === 'banners' && (
          <div className="sa-section">
            <div className="sa-section__head">
              <h2>{t('superAdmin.bannersTitle')}</h2>
              <button className="btn btn-dark btn-sm" onClick={() => setModal({ type: 'banner', data: null })}>{t('superAdmin.addBanner')}</button>
            </div>
            {banners.length === 0 ? (
              <div className="sa-empty">
                <p>{t('superAdmin.noBannersTitle')}</p>
              </div>
            ) : (
              <div className="sa-banners-list">
                {[...banners].sort((a, b) => a.sortOrder - b.sortOrder).map(b => {
                  const mark = COLLECTIONS.find(m => m.slug === b.linkSlug)
                  return (
                    <div key={b.id} className={`sa-banner-row ${!b.active ? 'inactive' : ''}`}>
                      <div
                        className="sa-banner-row__thumb"
                        style={b.image ? { backgroundImage: `url(${b.image})` } : { background: b.bgColor }}
                      >
                        <div className="sa-banner-row__thumb-overlay" />
                        <span className="sa-banner-row__title-preview">{b.title}</span>
                      </div>
                      <div className="sa-banner-row__info">
                        <span className="sa-main">{b.title}</span>
                        {b.subtitle && <span className="sa-sub">{b.subtitle}</span>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <span className="sa-mark-badge" style={{ fontSize: 12 }}>
                            {mark ? `${mark.icon} ${t(`collectionsList.${mark.slug}`)}` : b.linkSlug}
                          </span>
                          <span className="sa-sub">{t('superAdmin.order', b.sortOrder)}</span>
                        </div>
                      </div>
                      <div className="sa-banner-row__actions">
                        <button
                          className={`sa-toggle ${b.active ? 'sa-toggle--active' : 'sa-toggle--inactive'}`}
                          onClick={() => handleToggleBanner(b)}
                        >
                          {b.active ? t('superAdmin.active') : t('superAdmin.inactive')}
                        </button>
                        <button className="sa-icon-btn" onClick={() => setModal({ type: 'banner', data: b })}>✏️</button>
                        <button className="sa-icon-btn sa-btn-icon--danger" onClick={() => setConfirm({ type: 'banner', id: b.id, name: b.title })}>🗑️</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ACCOUNTS ── */}
        {tab === 'accounts' && (
          <div className="sa-section">
            <div className="sa-section__head">
              <h2>{t('superAdmin.accountsTitle')}</h2>
              <button className="btn btn-dark btn-sm" onClick={() => setModal({ type: 'account', data: null })}>{t('superAdmin.createAccount')}</button>
            </div>
            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead><tr>
                  <th>{t('superAdmin.thAccName')}</th><th>{t('superAdmin.thAccLogin')}</th><th>{t('superAdmin.thAccPassword')}</th><th>{t('superAdmin.thAccVenue')}</th><th>{t('superAdmin.thAccTier')}</th><th>{t('superAdmin.thAccStatus')}</th><th>{t('superAdmin.thActions')}</th>
                </tr></thead>
                <tbody>
                  {venueUsers.map(u => (
                    <tr key={u.id}>
                      <td><span className="sa-main">{u.name}</span></td>
                      <td><code style={{fontSize:13}}>{u.username || u.email}</code></td>
                      <td><code style={{fontSize:13, color: u.plainPass ? 'var(--text)' : 'var(--text-3)'}}>{u.plainPass || '—'}</code></td>
                      <td className="sa-muted">{getPlaceName(u.placeId)}</td>
                      <td>
                        <select
                          className="input sa-tier-select"
                          value={u.subscriptionTier || 'basic'}
                          onChange={e => handleChangeTier(u, e.target.value)}
                        >
                          {Object.keys(SUBSCRIPTION_TIERS).map(tier => (
                            <option key={tier} value={tier}>{t(`subscriptionTiers.${tier}`)}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button className={`sa-toggle ${u.isActive ? 'sa-toggle--active' : 'sa-toggle--inactive'}`} onClick={() => handleToggleActive(u)}>
                          {u.isActive ? t('superAdmin.active') : t('superAdmin.inactive')}
                        </button>
                      </td>
                      <td>
                        <div className="sa-actions">
                          <button className="sa-icon-btn" onClick={() => setConfirm({ type: 'account', id: u.id, name: u.name })}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {venueUsers.length === 0 && <div className="sa-empty">{t('superAdmin.noAccounts')}</div>}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modal?.type === 'place' && (
        <Modal title={modal.data ? t('superAdmin.modalEditVenue') : t('superAdmin.modalNewVenue')} onClose={() => setModal(null)}>
          <PlaceForm initial={modal.data} onSave={handleSavePlace} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'stats' && (
        <Modal title={`${t('venueAdmin.statsTitle')} — ${modal.data.name}`} onClose={() => setModal(null)}>
          <PlaceStats placeId={modal.data.id} />
        </Modal>
      )}
      {modal?.type === 'event' && (
        <Modal title={modal.data ? t('superAdmin.modalEditEvent') : t('superAdmin.modalNewEvent')} onClose={() => setModal(null)}>
          <EventForm initial={modal.data} places={places} onSave={handleSaveEvent} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'banner' && (
        <Modal title={modal.data ? t('superAdmin.modalEditBanner') : t('superAdmin.modalNewBanner')} onClose={() => setModal(null)}>
          <BannerForm initial={modal.data} onSave={handleSaveBanner} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'account' && (
        <Modal title={t('superAdmin.modalNewAccount')} onClose={() => setModal(null)}>
          <AccountForm places={places} onSave={handleSaveAccount} onClose={() => setModal(null)} />
        </Modal>
      )}
      {confirm && (
        <Modal title={t('common.confirmTitle')} onClose={() => setConfirm(null)} size="sm">
          <div style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-2)' }}>
            {t('superAdmin.confirmDelete', confirm.name)}
            {confirm.type === 'place' && <p style={{ marginTop: 8, color: 'var(--error)' }}>{t('superAdmin.confirmDeleteVenueNote')}</p>}
          </div>
          <div className="sa-modal__foot">
            <button className="btn btn-outline" onClick={() => setConfirm(null)}>{t('common.cancel')}</button>
            <button className="btn btn-danger" onClick={handleConfirm}>{t('common.delete')}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
