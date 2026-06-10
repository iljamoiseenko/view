import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { PLACE_TYPES, EVENT_TYPES, CITIES, CUISINE_LIST, MARKS } from '../../data/initialData'
import { api } from '../../api/client'
import './VenueAdminPage.css'

const EMPTY_EVENT = {
  title: '', description: '', date: '', time: '19:00',
  type: 'live_music', price: 0, image: '',
}

// ── Photo input with file upload + URL fallback ──────────────────────────────
function PhotoInput({ value, onChange, placeholder }) {
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
    } catch {
      // silently fall through
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="va-photo-input">
      {value && (
        <div className="va-photo-preview">
          <img src={value} alt="" />
          <button type="button" className="va-photo-remove" onClick={() => onChange('')}>✕</button>
        </div>
      )}
      <div className="va-photo-controls">
        <input
          className="input va-photo-url"
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || 'https://...'}
        />
        <button
          type="button"
          className="va-photo-upload-btn"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? '...' : '↑ Файл'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>
    </div>
  )
}

// ── Event Modal ──────────────────────────────────────────────────────────────
function EventModal({ initial, placeId, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_EVENT, placeId, ...initial })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="va-modal-overlay" onClick={onClose}>
      <div className="va-modal" onClick={e => e.stopPropagation()}>
        <div className="va-modal__head">
          <h2>{initial?.id ? 'Редагувати подію' : 'Нова подія'}</h2>
          <button className="va-modal__close" onClick={onClose}>✕</button>
        </div>
        <form className="va-modal__form" onSubmit={e => { e.preventDefault(); onSave({ ...form, price: Number(form.price) }) }}>
          <div className="va-modal-body">
            <div className="va-field-group">
              <div className="va-field va-field--full">
                <label className="va-label">Назва *</label>
                <input className="input" required value={form.title}
                  onChange={e => set('title', e.target.value)} placeholder="Назва події" />
              </div>
            </div>

            <div className="va-field-group">
              <div className="va-field">
                <label className="va-label">Тип *</label>
                <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
                  {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="va-field">
                <label className="va-label">Ціна (грн, 0 = FREE)</label>
                <input className="input" type="number" min="0" value={form.price}
                  onChange={e => set('price', e.target.value)} />
              </div>
            </div>

            <div className="va-field-group">
              <div className="va-field">
                <label className="va-label">Дата *</label>
                <input className="input" type="date" required value={form.date}
                  onChange={e => set('date', e.target.value)} />
              </div>
              <div className="va-field">
                <label className="va-label">Час *</label>
                <input className="input" type="time" required value={form.time}
                  onChange={e => set('time', e.target.value)} />
              </div>
            </div>

            <div className="va-field-group">
              <div className="va-field va-field--full">
                <label className="va-label">Опис *</label>
                <textarea className="input textarea" rows={3} required value={form.description}
                  onChange={e => set('description', e.target.value)} placeholder="Опишіть подію..." />
              </div>
            </div>

            <div className="va-field-group">
              <div className="va-field va-field--full">
                <label className="va-label">Фото події</label>
                <PhotoInput value={form.image} onChange={v => set('image', v)} />
              </div>
            </div>
          </div>
          <div className="va-modal__foot">
            <button type="button" className="btn btn-outline" onClick={onClose}>Скасувати</button>
            <button type="submit" className="btn btn-dark">
              {initial?.id ? 'Зберегти' : 'Додати подію'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main VenueAdminPage ──────────────────────────────────────────────────────
export default function VenueAdminPage() {
  const { currentUser, logout } = useAuth()
  const { places, events, updatePlace, addEvent, updateEvent, deleteEvent } = useApp()
  const navigate = useNavigate()

  const place = places.find(p => p.id === currentUser?.placeId)
  const myEvents = events.filter(e => e.placeId === currentUser?.placeId)
    .sort((a, b) => a.date.localeCompare(b.date))

  const [tab, setTab] = useState('place')
  const [eventModal, setEventModal] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [saved, setSaved] = useState(false)
  const [wasFirstPublish, setWasFirstPublish] = useState(false)

  const [placeForm, setPlaceForm] = useState(() => {
    if (!place) return {}
    return {
      ...place,
      photos: place.photos?.length ? place.photos : [''],
      tags: Array.isArray(place.tags) ? place.tags.join(', ') : '',
      marks: Array.isArray(place.marks) ? place.marks : [],
    }
  })

  const setField = (k, v) => setPlaceForm(f => ({ ...f, [k]: v }))
  const setPhoto = (i, v) => {
    const p = [...(placeForm.photos || [''])]
    p[i] = v
    setField('photos', p)
  }

  const handleSavePlace = async (e) => {
    e.preventDefault()
    const firstPublish = !place.published
    const data = {
      ...placeForm,
      photos: (placeForm.photos || []).filter(Boolean),
      tags: placeForm.tags ? placeForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      rating: placeForm.rating ? parseFloat(placeForm.rating) : undefined,
    }
    const updated = await updatePlace(place.id, data)
    setPlaceForm(f => ({ ...f, ...updated, tags: Array.isArray(updated.tags) ? updated.tags.join(', ') : '', marks: Array.isArray(updated.marks) ? updated.marks : [] }))
    setWasFirstPublish(firstPublish)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleSaveEvent = async (data) => {
    if (data.id) await updateEvent(data.id, data)
    else await addEvent(data)
    setEventModal(null)
  }

  const handleDeleteEvent = async () => {
    if (deleteConfirm) await deleteEvent(deleteConfirm.id)
    setDeleteConfirm(null)
  }

  const handleLogout = () => { logout(); navigate('/') }

  if (!place) {
    return (
      <div className="container" style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2>Заклад не знайдено</h2>
        <p style={{ color: 'var(--text-2)', marginTop: 8 }}>Зверніться до адміністратора View.</p>
      </div>
    )
  }

  return (
    <div className="va-page">
      {/* Topbar */}
      <div className="va-topbar">
        <div className="container va-topbar__inner">
          <div className="va-topbar__info">
            <span className="va-topbar__logo">VIEW</span>
            <span className="va-topbar__sep">·</span>
            <span className="va-topbar__name">{place.name}</span>
          </div>
          <div className="va-topbar__actions">
            <Link to={`/place/${place.id}`} className="btn btn-outline btn-sm text-white" target="_blank">
              Переглянути сторінку
            </Link>
            <button className="va-logout" onClick={handleLogout}>Вийти</button>
          </div>
        </div>
      </div>

      {/* Unpublished banner */}
      {!place.published && (
        <div className="va-unpublished-banner">
          <div className="container va-unpublished-banner__inner">
            <span className="va-unpublished-banner__dot" />
            <span>Ваш заклад ще не опублікований — він не відображається у загальному списку. Заповніть інформацію та натисніть «Зберегти зміни».</span>
          </div>
        </div>
      )}

      <div className="container va-body">
        {/* Tabs */}
        <div className="va-tabs">
          <button className={`va-tab ${tab === 'place' ? 'active' : ''}`} onClick={() => setTab('place')}>
            Мій заклад
          </button>
          <button className={`va-tab ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>
            Мої події
            <span className="va-tab__count">{myEvents.length}</span>
          </button>
        </div>

        {/* Tab: Place */}
        {tab === 'place' && (
          <div className="va-section">
            <div className="va-section__head">
              <h2>Редагування закладу</h2>
            </div>
            <form onSubmit={handleSavePlace}>

              {/* ── Group 1: Основна інформація ── */}
              <div className="va-form-section">
                <div className="va-form-section__title">Основна інформація</div>
                <div className="va-form-grid">
                  <div className="va-field va-field--full">
                    <label className="va-label">Назва *</label>
                    <input className="input" required value={placeForm.name || ''}
                      onChange={e => setField('name', e.target.value)} />
                  </div>
                  <div className="va-field">
                    <label className="va-label">Тип</label>
                    <select className="input" value={placeForm.type || 'restaurant'}
                      onChange={e => setField('type', e.target.value)}>
                      {Object.entries(PLACE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="va-field">
                    <label className="va-label">Місто</label>
                    <select className="input" value={placeForm.city || ''}
                      onChange={e => setField('city', e.target.value)}>
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="va-field va-field--full">
                    <label className="va-label">Адреса *</label>
                    <input className="input" required value={placeForm.address || ''}
                      onChange={e => setField('address', e.target.value)} />
                  </div>
                  <div className="va-field va-field--full">
                    <label className="va-label">Опис *</label>
                    <textarea className="input textarea" rows={4} required
                      value={placeForm.description || ''}
                      onChange={e => setField('description', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* ── Group 2: Контакти та деталі ── */}
              <div className="va-form-section">
                <div className="va-form-section__title">Контакти та деталі</div>
                <div className="va-form-grid">
                  <div className="va-field">
                    <label className="va-label">Телефон</label>
                    <input className="input" value={placeForm.phone || ''}
                      onChange={e => setField('phone', e.target.value)} placeholder="+380 XX XXX-XX-XX" />
                  </div>
                  <div className="va-field">
                    <label className="va-label">Кухня</label>
                    {(() => {
                      const knownCuisines = CUISINE_LIST.filter(c => c !== 'Інше')
                      const isCustom = placeForm.cuisine && !knownCuisines.includes(placeForm.cuisine)
                      const selectVal = isCustom ? 'Інше' : (placeForm.cuisine || '')
                      return <>
                        <select className="input" value={selectVal}
                          onChange={e => setField('cuisine', e.target.value === 'Інше' ? '__custom__' : e.target.value)}>
                          <option value="">— Оберіть —</option>
                          {CUISINE_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {(selectVal === 'Інше' || placeForm.cuisine === '__custom__') && (
                          <input className="input" style={{marginTop:6}}
                            placeholder="Введіть свій варіант"
                            value={isCustom ? placeForm.cuisine : ''}
                            onChange={e => setField('cuisine', e.target.value)} />
                        )}
                      </>
                    })()}
                  </div>
                  <div className="va-field">
                    <label className="va-label">Години роботи</label>
                    <input className="input" value={placeForm.workingHours || ''}
                      onChange={e => setField('workingHours', e.target.value)}
                      placeholder="Пн–Нд: 10:00 – 22:00" />
                  </div>
                  <div className="va-field">
                    <label className="va-label">Сайт</label>
                    <input className="input" type="url" value={placeForm.website || ''}
                      onChange={e => setField('website', e.target.value)} placeholder="https://" />
                  </div>
                  <div className="va-field va-field--full">
                    <label className="va-label">Теги (через кому)</label>
                    <input className="input" value={placeForm.tags || ''}
                      onChange={e => setField('tags', e.target.value)} placeholder="піца, вино, романтика" />
                  </div>
                </div>
              </div>

              {/* ── Group: Відмітки ── */}
              <div className="va-form-section">
                <div className="va-form-section__title">Відмітки закладу</div>
                <p className="va-marks-hint">Відмітки допомагають гостям знайти ваш заклад через тематичні банери на головній сторінці.</p>
                <div className="va-marks">
                  {MARKS.map(m => {
                    const checked = Array.isArray(placeForm.marks) && placeForm.marks.includes(m.slug)
                    return (
                      <label key={m.slug} className={`va-mark-check ${checked ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setField('marks', checked
                            ? placeForm.marks.filter(s => s !== m.slug)
                            : [...(placeForm.marks || []), m.slug]
                          )}
                        />
                        <span className="va-mark-check__icon">{m.icon}</span>
                        <span>{m.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* ── Group 3: Фотографії ── */}
              <div className="va-form-section">
                <div className="va-form-section__title">Фотографії</div>
                <div className="va-photos-list">
                  {(placeForm.photos || ['']).map((ph, i) => (
                    <div key={i} className="va-photo-row">
                      <div className="va-photo-row__num">{i + 1}</div>
                      <div className="va-photo-row__input">
                        <PhotoInput
                          value={ph}
                          onChange={v => setPhoto(i, v)}
                          placeholder="Вставте URL або завантажте файл"
                        />
                      </div>
                      {(placeForm.photos || []).length > 1 && (
                        <button type="button" className="va-rm-photo"
                          onClick={() => setField('photos', placeForm.photos.filter((_, j) => j !== i))}>
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn-outline btn-sm va-add-photo"
                    onClick={() => setField('photos', [...(placeForm.photos || []), ''])}>
                    + Додати фото
                  </button>
                </div>
              </div>

              <div className="va-form-footer">
                <button type="submit" className="btn btn-dark">Зберегти зміни</button>
              </div>
            </form>
          </div>
        )}

        {/* Tab: Events */}
        {tab === 'events' && (
          <div className="va-section">
            <div className="va-section__head">
              <h2>Мої події</h2>
              <button className="btn btn-dark btn-sm" onClick={() => setEventModal({})}>
                + Нова подія
              </button>
            </div>

            {myEvents.length === 0 && (
              <div className="va-empty">
                <p>У вас ще немає подій. Додайте першу!</p>
              </div>
            )}

            {myEvents.length > 0 && (
              <div className="va-table-wrap">
                <table className="va-table">
                  <thead>
                    <tr>
                      <th>Назва</th>
                      <th>Тип</th>
                      <th>Дата</th>
                      <th>Час</th>
                      <th>Ціна</th>
                      <th>Дії</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myEvents.map(ev => (
                      <tr key={ev.id}>
                        <td className="va-table__main">{ev.title}</td>
                        <td>
                          <span className={`badge badge-event-${ev.type}`}>
                            {EVENT_TYPES[ev.type]}
                          </span>
                        </td>
                        <td>{ev.date}</td>
                        <td>{ev.time}</td>
                        <td>{ev.price === 0 ? <span className="va-free">FREE</span> : `${ev.price} грн`}</td>
                        <td>
                          <div className="va-actions">
                            <button className="va-btn-icon" onClick={() => setEventModal(ev)}>✏️</button>
                            <button className="va-btn-icon" onClick={() => setDeleteConfirm(ev)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {eventModal !== null && (
        <EventModal
          initial={eventModal.id ? eventModal : null}
          placeId={place.id}
          onSave={handleSaveEvent}
          onClose={() => setEventModal(null)}
        />
      )}

      {/* Save toast */}
      {saved && (
        <div className="va-toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          {wasFirstPublish ? 'Заклад опубліковано та збережено' : 'Зміни збережено'}
        </div>
      )}

      {deleteConfirm && (
        <div className="va-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="va-modal va-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="va-modal__head">
              <h2>Видалити подію?</h2>
              <button className="va-modal__close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', fontSize: 14, color: 'var(--text-2)' }}>
              <strong>«{deleteConfirm.title}»</strong> буде видалено назавжди.
            </div>
            <div className="va-modal__foot">
              <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Скасувати</button>
              <button className="btn btn-danger" onClick={handleDeleteEvent}>Видалити</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
