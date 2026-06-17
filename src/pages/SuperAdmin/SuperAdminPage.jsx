import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { api } from '../../api/client'
import { PLACE_TYPES, EVENT_TYPES, CITIES, CUISINE_LIST, MARKS } from '../../data/initialData'
import './SuperAdminPage.css'

const EMPTY_PLACE = {
  name: '', type: 'restaurant', city: 'Харків', address: '',
  description: '', cuisine: '', phone: '', workingHours: '',
  website: '', photos: [''], tags: '', marks: [], rating: '',
}
const EMPTY_EVENT = {
  placeId: '', title: '', description: '', date: '',
  time: '19:00', type: 'live_music', price: 0, image: '',
}
const EMPTY_ACCOUNT = { name: '', username: '', password: '', placeId: '' }
const EMPTY_BANNER = {
  title: '', subtitle: '', image: '', linkSlug: MARKS[0]?.slug || '',
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
          {uploading ? '...' : '↑ Файл'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>
    </div>
  )
}

// ── Place Form ───────────────────────────────────────────────────────────────
function PlaceForm({ initial, onSave, onClose }) {
  const [f, setF] = useState({
    ...EMPTY_PLACE,
    ...initial,
    photos: initial?.photos?.length ? initial.photos : [''],
    tags: Array.isArray(initial?.tags) ? initial.tags.join(', ') : (initial?.tags || ''),
    marks: Array.isArray(initial?.marks) ? initial.marks : [],
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const setPhoto = (i, v) => { const a = [...f.photos]; a[i] = v; set('photos', a) }
  const toggleMark = (slug) => {
    set('marks', f.marks.includes(slug) ? f.marks.filter(m => m !== slug) : [...f.marks, slug])
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
        <div className="sa-col2"><label className="sa-label">Назва *</label>
          <input className="input" required value={f.name} onChange={e => set('name', e.target.value)} /></div>
        <div><label className="sa-label">Тип</label>
          <select className="input" value={f.type} onChange={e => set('type', e.target.value)}>
            {Object.entries(PLACE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="sa-label">Місто</label>
          <select className="input" value={f.city} onChange={e => set('city', e.target.value)}>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="sa-col2"><label className="sa-label">Адреса *</label>
          <input className="input" required value={f.address} onChange={e => set('address', e.target.value)} /></div>
        <div><label className="sa-label">Кухня</label>
          <input className="input" list="sa-cuisine" value={f.cuisine} onChange={e => set('cuisine', e.target.value)} />
          <datalist id="sa-cuisine">{CUISINE_LIST.map(c => <option key={c} value={c} />)}</datalist></div>
        <div><label className="sa-label">Рейтинг</label>
          <input className="input" type="number" min="1" max="5" step="0.1" value={f.rating} onChange={e => set('rating', e.target.value)} /></div>
        <div><label className="sa-label">Телефон</label>
          <input className="input" value={f.phone} onChange={e => set('phone', e.target.value)} /></div>
        <div><label className="sa-label">Години роботи</label>
          <input className="input" value={f.workingHours} onChange={e => set('workingHours', e.target.value)} placeholder="Пн–Нд: 10:00–22:00" /></div>
        <div className="sa-col2"><label className="sa-label">Сайт</label>
          <input className="input" type="url" value={f.website} onChange={e => set('website', e.target.value)} placeholder="https://" /></div>
        <div className="sa-col2"><label className="sa-label">Опис *</label>
          <textarea className="input textarea" rows={3} required value={f.description} onChange={e => set('description', e.target.value)} /></div>
        <div className="sa-col2"><label className="sa-label">Теги (через кому)</label>
          <input className="input" value={f.tags} onChange={e => set('tags', e.target.value)} placeholder="піца, вино, романтика" /></div>
        {/* Marks */}
        <div className="sa-col2">
          <label className="sa-label">Відмітки закладу</label>
          <div className="sa-marks">
            {MARKS.map(m => (
              <label key={m.slug} className={`sa-mark-check ${f.marks.includes(m.slug) ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={f.marks.includes(m.slug)}
                  onChange={() => toggleMark(m.slug)}
                />
                <span>{m.icon} {m.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="sa-col2">
          <label className="sa-label">Фото (URL або завантаження)</label>
          {f.photos.map((ph, i) => (
            <div key={i} className="sa-photo-row">
              <input className="input" value={ph} placeholder="https://..." onChange={e => setPhoto(i, e.target.value)} />
              {f.photos.length > 1 && <button type="button" className="sa-rm-btn" onClick={() => set('photos', f.photos.filter((_, j) => j !== i))}>✕</button>}
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => set('photos', [...f.photos, ''])}>+ Додати фото</button>
        </div>
      </div>
      <div className="sa-modal__foot">
        <button type="button" className="btn btn-outline" onClick={onClose}>Скасувати</button>
        <button type="submit" className="btn btn-dark">{initial?.id ? 'Зберегти' : 'Додати'}</button>
      </div>
    </form>
  )
}

// ── Event Form ───────────────────────────────────────────────────────────────
function EventForm({ initial, places, onSave, onClose }) {
  const [f, setF] = useState({ ...EMPTY_EVENT, placeId: places[0]?.id || '', ...initial })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ ...f, price: Number(f.price) }) }} className="sa-form">
      <div className="sa-grid">
        <div className="sa-col2"><label className="sa-label">Заклад *</label>
          <select className="input" required value={f.placeId} onChange={e => set('placeId', e.target.value)}>
            {places.map(p => <option key={p.id} value={p.id}>{p.name} ({p.city})</option>)}</select></div>
        <div className="sa-col2"><label className="sa-label">Назва *</label>
          <input className="input" required value={f.title} onChange={e => set('title', e.target.value)} /></div>
        <div><label className="sa-label">Тип</label>
          <select className="input" value={f.type} onChange={e => set('type', e.target.value)}>
            {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="sa-label">Ціна (0 = FREE)</label>
          <input className="input" type="number" min="0" value={f.price} onChange={e => set('price', e.target.value)} /></div>
        <div><label className="sa-label">Дата *</label>
          <input className="input" type="date" required value={f.date} onChange={e => set('date', e.target.value)} /></div>
        <div><label className="sa-label">Час *</label>
          <input className="input" type="time" required value={f.time} onChange={e => set('time', e.target.value)} /></div>
        <div className="sa-col2"><label className="sa-label">Опис *</label>
          <textarea className="input textarea" rows={3} required value={f.description} onChange={e => set('description', e.target.value)} /></div>
        <div className="sa-col2"><label className="sa-label">Зображення (URL)</label>
          <input className="input" type="url" value={f.image} onChange={e => set('image', e.target.value)} placeholder="https://..." /></div>
      </div>
      <div className="sa-modal__foot">
        <button type="button" className="btn btn-outline" onClick={onClose}>Скасувати</button>
        <button type="submit" className="btn btn-dark">{initial?.id ? 'Зберегти' : 'Додати'}</button>
      </div>
    </form>
  )
}

// ── Account Form ─────────────────────────────────────────────────────────────
function AccountForm({ places, onSave, onClose }) {
  const [f, setF] = useState({ ...EMPTY_ACCOUNT, placeId: places[0]?.id || '' })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f) }} className="sa-form">
      <div className="sa-grid">
        <div className="sa-col2"><label className="sa-label">Назва закладу *</label>
          <input className="input" required value={f.name} onChange={e => set('name', e.target.value)} placeholder="Кав'ярня Центр" /></div>
        <div className="sa-col2"><label className="sa-label">Логін *</label>
          <input className="input" required value={f.username} onChange={e => set('username', e.target.value)} placeholder="kaviarnya_tsentr" /></div>
        <div className="sa-col2"><label className="sa-label">Пароль *</label>
          <input className="input" required value={f.password} onChange={e => set('password', e.target.value)} minLength={6} placeholder="мін. 6 символів" /></div>
        <div className="sa-col2"><label className="sa-label">Прив'язати до закладу</label>
          <select className="input" value={f.placeId} onChange={e => set('placeId', e.target.value)}>
            <option value="">— Вибрати заклад —</option>
            {places.map(p => <option key={p.id} value={p.id}>{p.name} ({p.city})</option>)}
          </select></div>
      </div>
      <div className="sa-modal__foot">
        <button type="button" className="btn btn-outline" onClick={onClose}>Скасувати</button>
        <button type="submit" className="btn btn-dark">Створити акаунт</button>
      </div>
    </form>
  )
}

// ── Banner Form ───────────────────────────────────────────────────────────────
function BannerForm({ initial, onSave, onClose }) {
  const [f, setF] = useState({ ...EMPTY_BANNER, ...initial })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f) }} className="sa-form">
      <div className="sa-grid">
        <div className="sa-col2">
          <label className="sa-label">Зображення банера</label>
          <ImageInput value={f.image} onChange={v => set('image', v)} placeholder="https://... або завантажте файл" />
        </div>
        <div className="sa-col2">
          <label className="sa-label">Заголовок *</label>
          <input className="input" required value={f.title} onChange={e => set('title', e.target.value)} placeholder="Де дивитись ЧС з футболу" />
        </div>
        <div className="sa-col2">
          <label className="sa-label">Підзаголовок</label>
          <input className="input" value={f.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder="Найкращі місця для перегляду" />
        </div>
        <div>
          <label className="sa-label">Категорія (посилання) *</label>
          <select className="input" required value={f.linkSlug} onChange={e => set('linkSlug', e.target.value)}>
            {MARKS.map(m => (
              <option key={m.slug} value={m.slug}>{m.icon} {m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="sa-label">Колір фону (якщо без фото)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={f.bgColor} onChange={e => set('bgColor', e.target.value)} style={{ width: 44, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
            <input className="input" value={f.bgColor} onChange={e => set('bgColor', e.target.value)} style={{ flex: 1 }} placeholder="#1a1a1a" />
          </div>
        </div>
        <div>
          <label className="sa-label">Порядок сортування</label>
          <input className="input" type="number" min="0" value={f.sortOrder} onChange={e => set('sortOrder', Number(e.target.value))} />
        </div>
        {/* Banner preview */}
        {(f.image || f.title) && (
          <div className="sa-col2">
            <label className="sa-label">Попередній перегляд</label>
            <div className="sa-banner-preview" style={f.image ? { backgroundImage: `url(${f.image})` } : { background: f.bgColor }}>
              <div className="sa-banner-preview__overlay" />
              <div className="sa-banner-preview__content">
                {f.subtitle && <p className="sa-banner-preview__sub">{f.subtitle}</p>}
                <h3 className="sa-banner-preview__title">{f.title || 'Заголовок банера'}</h3>
                <span className="sa-banner-preview__cta">Дивитись →</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="sa-modal__foot">
        <button type="button" className="btn btn-outline" onClick={onClose}>Скасувати</button>
        <button type="submit" className="btn btn-dark">{initial?.id ? 'Зберегти' : 'Додати банер'}</button>
      </div>
    </form>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const { currentUser, logout } = useAuth()
  const { places, events, banners, addPlace, updatePlace, deletePlace, addEvent, updateEvent, deleteEvent, addBanner, updateBanner, deleteBanner } = useApp()
  const navigate = useNavigate()

  const [tab, setTab] = useState('places')
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [venueUsers, setVenueUsers] = useState([])

  useEffect(() => {
    api.get('/users').then(users => setVenueUsers(users.filter(u => u.role === 'venue'))).catch(() => {})
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

  const handleToggleActive = async (u) => {
    const updated = await api.put(`/users/${u.id}`, { isActive: !u.isActive })
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

  return (
    <div className="sa-page">
      <div className="sa-topbar">
        <div className="container sa-topbar__inner">
          <div className="sa-topbar__brand">
            <span className="sa-topbar__logo">VIEW</span>
            <span className="sa-topbar__role">Суперадмін</span>
          </div>
          <div className="sa-topbar__stats">
            <span>{places.length} закладів</span>
            <span>·</span>
            <span>{events.length} подій</span>
            <span>·</span>
            <span>{banners.length} банерів</span>
            <span>·</span>
            <span>{venueUsers.length} акаунтів</span>
          </div>
          <button className="sa-logout" onClick={() => { logout(); navigate('/') }}>Вийти</button>
        </div>
      </div>

      <div className="container sa-body">
        <div className="sa-tabs">
          {[
            { v: 'places',   l: 'Заклади',  c: places.length },
            { v: 'events',   l: 'Події',    c: events.length },
            { v: 'banners',  l: 'Банери',   c: banners.length },
            { v: 'accounts', l: 'Акаунти',  c: venueUsers.length },
          ].map(t => (
            <button key={t.v} className={`sa-tab ${tab === t.v ? 'active' : ''}`} onClick={() => setTab(t.v)}>
              {t.l} <span className="sa-tab__count">{t.c}</span>
            </button>
          ))}
        </div>

        {/* ── PLACES ── */}
        {tab === 'places' && (
          <div className="sa-section">
            <div className="sa-section__head">
              <h2>Заклади</h2>
              <button className="btn btn-dark btn-sm" onClick={() => setModal({ type: 'place', data: null })}>+ Додати</button>
            </div>
            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead><tr>
                  <th>Фото</th><th>Назва</th><th>Тип</th><th>Місто</th>
                  <th>Відмітки</th><th>★</th><th>Подій</th><th>Дії</th>
                </tr></thead>
                <tbody>
                  {places.map(p => (
                    <tr key={p.id}>
                      <td><img src={p.photos?.[0] || 'https://picsum.photos/seed/d/60/40'} alt="" className="sa-thumb" /></td>
                      <td>
                        <span className="sa-main">{p.name}</span>
                        <span className="sa-sub">{p.address}</span>
                      </td>
                      <td><span className={`badge badge-${p.type}`}>{PLACE_TYPES[p.type] || p.type}</span></td>
                      <td>{p.city}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {Array.isArray(p.marks) && p.marks.map(slug => {
                            const m = MARKS.find(x => x.slug === slug)
                            return m ? <span key={slug} className="sa-mark-badge">{m.icon}</span> : null
                          })}
                        </div>
                      </td>
                      <td>{p.rating ? `${p.rating}` : '—'}</td>
                      <td className="sa-center">{events.filter(e => e.placeId === p.id).length}</td>
                      <td>
                        <div className="sa-actions">
                          <button className="sa-icon-btn" onClick={() => setModal({ type: 'place', data: p })}>✏️</button>
                          <button className="sa-icon-btn" onClick={() => setConfirm({ type: 'place', id: p.id, name: p.name })}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {places.length === 0 && <div className="sa-empty">Заклади відсутні</div>}
            </div>
          </div>
        )}

        {/* ── EVENTS ── */}
        {tab === 'events' && (
          <div className="sa-section">
            <div className="sa-section__head">
              <h2>Події</h2>
              <button className="btn btn-dark btn-sm" onClick={() => setModal({ type: 'event', data: null })} disabled={places.length === 0}>
                + Додати
              </button>
            </div>
            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead><tr>
                  <th>Назва</th><th>Тип</th><th>Заклад</th>
                  <th>Дата</th><th>Час</th><th>Ціна</th><th>Дії</th>
                </tr></thead>
                <tbody>
                  {[...events].sort((a, b) => a.date.localeCompare(b.date)).map(ev => (
                    <tr key={ev.id}>
                      <td className="sa-main">{ev.title}</td>
                      <td><span className={`badge badge-event-${ev.type}`}>{EVENT_TYPES[ev.type]}</span></td>
                      <td className="sa-muted">{getPlaceName(ev.placeId)}</td>
                      <td>{ev.date}</td>
                      <td>{ev.time}</td>
                      <td>{ev.price === 0 ? <span className="sa-free">FREE</span> : `${ev.price} грн`}</td>
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
              {events.length === 0 && <div className="sa-empty">Подій немає</div>}
            </div>
          </div>
        )}

        {/* ── BANNERS ── */}
        {tab === 'banners' && (
          <div className="sa-section">
            <div className="sa-section__head">
              <h2>Банери на головній</h2>
              <button className="btn btn-dark btn-sm" onClick={() => setModal({ type: 'banner', data: null })}>+ Додати банер</button>
            </div>
            {banners.length === 0 ? (
              <div className="sa-empty">
                <p>Банери відсутні. Додайте перший банер — він з'явиться на головній сторінці.</p>
              </div>
            ) : (
              <div className="sa-banners-list">
                {[...banners].sort((a, b) => a.sortOrder - b.sortOrder).map(b => {
                  const mark = MARKS.find(m => m.slug === b.linkSlug)
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
                            {mark ? `${mark.icon} ${mark.label}` : b.linkSlug}
                          </span>
                          <span className="sa-sub">Порядок: {b.sortOrder}</span>
                        </div>
                      </div>
                      <div className="sa-banner-row__actions">
                        <button
                          className={`sa-toggle ${b.active ? 'sa-toggle--active' : 'sa-toggle--inactive'}`}
                          onClick={() => handleToggleBanner(b)}
                        >
                          {b.active ? 'Активний' : 'Вимкнено'}
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
              <h2>Акаунти закладів</h2>
              <button className="btn btn-dark btn-sm" onClick={() => setModal({ type: 'account', data: null })}>+ Створити</button>
            </div>
            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead><tr>
                  <th>Назва</th><th>Логін</th><th>Пароль</th><th>Заклад</th><th>Статус</th><th>Дії</th>
                </tr></thead>
                <tbody>
                  {venueUsers.map(u => (
                    <tr key={u.id}>
                      <td><span className="sa-main">{u.name}</span></td>
                      <td><code style={{fontSize:13}}>{u.username || u.email}</code></td>
                      <td><code style={{fontSize:13, color: u.plainPass ? 'var(--text)' : 'var(--text-3)'}}>{u.plainPass || '—'}</code></td>
                      <td className="sa-muted">{getPlaceName(u.placeId)}</td>
                      <td>
                        <button className={`sa-toggle ${u.isActive ? 'sa-toggle--active' : 'sa-toggle--inactive'}`} onClick={() => handleToggleActive(u)}>
                          {u.isActive ? 'Активний' : 'Вимкнено'}
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
              {venueUsers.length === 0 && <div className="sa-empty">Акаунти відсутні</div>}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modal?.type === 'place' && (
        <Modal title={modal.data ? 'Редагувати заклад' : 'Новий заклад'} onClose={() => setModal(null)}>
          <PlaceForm initial={modal.data} onSave={handleSavePlace} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'event' && (
        <Modal title={modal.data ? 'Редагувати подію' : 'Нова подія'} onClose={() => setModal(null)}>
          <EventForm initial={modal.data} places={places} onSave={handleSaveEvent} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'banner' && (
        <Modal title={modal.data ? 'Редагувати банер' : 'Новий банер'} onClose={() => setModal(null)}>
          <BannerForm initial={modal.data} onSave={handleSaveBanner} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'account' && (
        <Modal title="Новий акаунт закладу" onClose={() => setModal(null)}>
          <AccountForm places={places} onSave={handleSaveAccount} onClose={() => setModal(null)} />
        </Modal>
      )}
      {confirm && (
        <Modal title="Підтвердження" onClose={() => setConfirm(null)} size="sm">
          <div style={{ padding: '16px 24px', fontSize: 14, color: 'var(--text-2)' }}>
            Видалити <strong>«{confirm.name}»</strong>?
            {confirm.type === 'place' && <p style={{ marginTop: 8, color: 'var(--error)' }}>Всі події цього закладу також будуть видалені.</p>}
          </div>
          <div className="sa-modal__foot">
            <button className="btn btn-outline" onClick={() => setConfirm(null)}>Скасувати</button>
            <button className="btn btn-danger" onClick={handleConfirm}>Видалити</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
