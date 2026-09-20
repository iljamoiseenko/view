import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../api/client'
import { computeFreeSlots } from '../../utils/tableSlots'
import { BOOKING_OCCASIONS } from '../../data/initialData'
import { kyivDateString } from '../../utils/kyivDate'
import './TableBookingPage.css'

const EMPTY_FORM = { guestName: '', guestPhone: '', partySize: 2, occasion: '', note: '', website: '' }

function today() {
  return kyivDateString()
}

export default function TableBookingPage() {
  const { placeId } = useParams()
  const { places } = useApp()
  const { currentUser } = useAuth()
  const { t } = useLanguage()
  const isGuestAccount = currentUser?.role === 'user'

  const place = places.find(p => p.id === placeId)

  const [floorsLoading, setFloorsLoading] = useState(true)
  const [floors, setFloors] = useState([])
  const [activeFloorId, setActiveFloorId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [layout, setLayout] = useState(null)
  const [objects, setObjects] = useState([])
  const [date, setDate] = useState(today())
  const [bookings, setBookings] = useState([])
  const [availLoading, setAvailLoading] = useState(false)

  const [selectedTable, setSelectedTable] = useState(null)
  const [selectedTime, setSelectedTime] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [successBooking, setSuccessBooking] = useState(null)

  useEffect(() => {
    if (!placeId) return
    api.get(`/table-booking/${placeId}/floors`)
      .then(list => {
        setFloors(list)
        if (list.length > 0) setActiveFloorId(list[0].id)
      })
      .catch(() => {})
      .finally(() => setFloorsLoading(false))
  }, [placeId])

  useEffect(() => {
    if (!activeFloorId) return
    setLoading(true)
    api.get(`/table-booking/floor/${activeFloorId}`)
      .then(({ layout: l, objects: o }) => { setLayout(l); setObjects(o || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeFloorId])

  useEffect(() => {
    if (!placeId || !layout) return
    setAvailLoading(true)
    api.get(`/table-booking/${placeId}/availability?date=${encodeURIComponent(date)}`)
      .then(({ bookings: rows }) => setBookings(rows || []))
      .catch(() => setBookings([]))
      .finally(() => setAvailLoading(false))
  }, [placeId, layout, date])

  const bookingsByTable = useMemo(() => {
    const m = {}
    bookings.forEach(b => { (m[b.tableId] ??= []).push(b) })
    return m
  }, [bookings])

  const freeSlotsByTable = useMemo(() => {
    const m = {}
    objects.forEach(o => {
      if (o.kind === 'table') m[o.id] = computeFreeSlots(o, bookingsByTable[o.id] || [])
    })
    return m
  }, [objects, bookingsByTable])

  const openTable = (obj) => {
    if (obj.kind !== 'table' || !obj.isBookable) return
    if ((freeSlotsByTable[obj.id] || []).length === 0) return
    setSelectedTable(obj)
    setSelectedTime(null)
    setForm(isGuestAccount ? { ...EMPTY_FORM, guestName: currentUser.name || '', guestPhone: currentUser.phone || '' } : EMPTY_FORM)
    setSubmitError('')
    setSuccessBooking(null)
  }

  const closeModal = () => { setSelectedTable(null); setSelectedTime(null); setSuccessBooking(null) }

  const submitBooking = async (e) => {
    e.preventDefault()
    if (!selectedTable || !selectedTime) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const created = await api.post(`/table-booking/${placeId}/bookings`, {
        tableId: selectedTable.id,
        date,
        time: selectedTime,
        guestName: form.guestName,
        guestPhone: form.guestPhone,
        partySize: Number(form.partySize) || 1,
        occasion: form.occasion || null,
        note: form.note || null,
        website: form.website, // honeypot — real guests never see or fill this
      })
      setSuccessBooking(created)
      setBookings(prev => [...prev, { tableId: selectedTable.id, time: selectedTime, durationMinutes: selectedTable.slotMinutes || 90 }])
    } catch (err) {
      if (err.message === 'TABLE_ALREADY_BOOKED') {
        setSubmitError(t('tableBooking.errorTaken'))
        setSelectedTime(null)
      } else if (err.message === 'RATE_LIMITED') {
        setSubmitError(t('tableBooking.errorRateLimited'))
      } else if (err.message === 'PHONE_BOOKING_LIMIT') {
        setSubmitError(t('tableBooking.errorPhoneLimit'))
      } else if (err.message === 'INVALID_PHONE') {
        setSubmitError(t('tableBooking.errorInvalidPhone'))
      } else {
        setSubmitError(t('tableBooking.errorGeneric'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!place) {
    return (
      <div className="container tbk-notfound">
        <h2>{t('tableBooking.venueNotFound')}</h2>
        <Link to="/" className="btn btn-dark">{t('placeDetail.toHome')}</Link>
      </div>
    )
  }

  const selectedTableFreeSlots = selectedTable ? (freeSlotsByTable[selectedTable.id] || []) : []

  return (
    <div className="tbk-page">
      <div className="tbk-hero">
        <div className="container tbk-hero__inner">
          <Link to={`/place/${place.id}`} className="tbk-back">← {t('tableBooking.backToVenue')}</Link>
          <div className="tbk-hero__main">
            {place.photos?.[0] && (
              <img className="tbk-hero__photo" src={place.photos[0]} alt={place.name} />
            )}
            <div className="tbk-hero__info">
              <span className="tbk-hero__badge">{t('tableBooking.title')}</span>
              <h1 className="tbk-hero__name">{place.name}</h1>
              {place.description && <p className="tbk-hero__desc">{place.description}</p>}
              {place.tags?.length > 0 && (
                <div className="tbk-hero__tags">
                  {place.tags.map(tag => <span key={tag} className="tbk-hero__tag">#{tag}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container tbk-body">
        <div className="tbk-account-bar">
          {isGuestAccount ? (
            <>
              <span>{t('tableBooking.loggedInAs', currentUser.name)}</span>
              <Link to="/my-bookings" className="tbk-account-bar__link">{t('tableBooking.viewMyBookings')}</Link>
            </>
          ) : !currentUser ? (
            <>
              <span>{t('tableBooking.loginPrompt')}</span>
              <Link to="/login" className="tbk-account-bar__link">{t('tableBooking.loginPromptLink')}</Link>
            </>
          ) : null}
        </div>
        {place.tableBookingPaused ? (
          <div className="empty-state">
            <h3>{t('tableBooking.pausedTitle')}</h3>
            <p>{t('tableBooking.pausedText')}</p>
          </div>
        ) : floorsLoading ? (
          <p className="tbk-loading">…</p>
        ) : floors.length === 0 ? (
          <div className="empty-state">
            <h3>{t('tableBooking.noLayoutTitle')}</h3>
            <p>{t('tableBooking.noLayoutText')}</p>
          </div>
        ) : (
          <>
            {floors.length > 1 && (
              <div className="tbk-floors">
                {floors.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className={`tbk-floor-tab ${f.id === activeFloorId ? 'active' : ''}`}
                    onClick={() => setActiveFloorId(f.id)}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}

            <div className="tbk-controls">
              <label className="tbk-date">
                <span>{t('tableBooking.pickDate')}</span>
                <input type="date" className="input" value={date} min={today()} onChange={e => setDate(e.target.value)} />
              </label>
              <div className="tbk-legend">
                <span className="tbk-legend__item"><i className="tbk-swatch tbk-swatch--free" />{t('tableBooking.legendFree')}</span>
                <span className="tbk-legend__item"><i className="tbk-swatch tbk-swatch--booked" />{t('tableBooking.legendBooked')}</span>
                <span className="tbk-legend__item"><i className="tbk-swatch tbk-swatch--selected" />{t('tableBooking.legendSelected')}</span>
              </div>
            </div>

            {loading || !layout ? (
              <p className="tbk-loading">…</p>
            ) : (
            <div className="tbk-canvas-wrap">
              <div className={`tbk-canvas ${availLoading ? 'is-loading' : ''}`} style={{ width: layout.width, height: layout.height, background: layout.background }}>
                {objects.map(o => {
                  const isTable = o.kind === 'table'
                  const freeSlots = isTable ? (freeSlotsByTable[o.id] || []) : []
                  const isFullyBooked = isTable && o.isBookable && freeSlots.length === 0
                  const isBookable = isTable && o.isBookable
                  const isSelected = selectedTable?.id === o.id
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className={`tbk-obj tbk-obj--${o.kind} tbk-obj--${o.shape} ${isFullyBooked ? 'is-booked' : ''} ${!isBookable && isTable ? 'is-disabled' : ''} ${isSelected ? 'is-selected' : ''}`}
                      style={{ left: o.x, top: o.y, width: o.width, height: o.height, backgroundColor: (isFullyBooked || isSelected) ? undefined : o.color || undefined }}
                      onClick={() => openTable(o)}
                      disabled={!isTable || !isBookable || isFullyBooked}
                    >
                      <span className="tbk-obj__label">{o.label}</span>
                      {isTable && o.seats != null && <span className="tbk-obj__seats">{t('tableBooking.seatsLabel', o.seats)}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
            )}
          </>
        )}
      </div>

      {selectedTable && (
        <div className="tbk-modal-overlay" onClick={closeModal}>
          <div className="tbk-modal" onClick={e => e.stopPropagation()}>
            <button type="button" className="tbk-modal__x" onClick={closeModal} aria-label={t('tableBooking.close')}>×</button>
            {successBooking ? (
              <div className="tbk-success">
                <div className="tbk-success__icon">✓</div>
                <h3>{t('tableBooking.successTitle')}</h3>
                <p>{t('tableBooking.successText', selectedTable.label, `${date} ${selectedTime}`)}</p>
                {successBooking.telegramLink && (
                  <a href={successBooking.telegramLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline tbk-success__telegram">
                    {t('tableBooking.telegramManageBtn')}
                  </a>
                )}
                <button type="button" className="btn btn-dark" onClick={closeModal}>{t('tableBooking.close')}</button>
              </div>
            ) : (
              <form onSubmit={submitBooking}>
                <h3 className="tbk-modal__title">{t('tableBooking.modalTitle', selectedTable.label)}</h3>
                {submitError && <p className="tbk-modal__error">{submitError}</p>}

                <p className="tbk-slots__label">{t('tableBooking.pickTime')}</p>
                {selectedTableFreeSlots.length === 0 && (
                  <p className="tbk-slots__empty">{t('tableBooking.noSlotsHint')}</p>
                )}
                <div className="tbk-slots">
                  {selectedTableFreeSlots.map(slot => (
                    <button
                      key={slot}
                      type="button"
                      className={`tbk-slot ${selectedTime === slot ? 'is-active' : ''}`}
                      onClick={() => setSelectedTime(slot)}
                    >
                      {slot}
                    </button>
                  ))}
                </div>

                {selectedTime && (
                  <>
                    <label className="tbk-field">
                      <span>{t('tableBooking.fieldName')}</span>
                      <input className="input" required value={form.guestName} onChange={e => setForm(f => ({ ...f, guestName: e.target.value }))} />
                    </label>
                    <label className="tbk-field">
                      <span>{t('tableBooking.fieldPhone')}</span>
                      <input className="input" required type="tel" placeholder="+380 XX XXX-XX-XX" value={form.guestPhone} onChange={e => setForm(f => ({ ...f, guestPhone: e.target.value }))} />
                    </label>
                    <label className="tbk-field">
                      <span>{t('tableBooking.fieldPartySize')}</span>
                      <input className="input" type="number" min="1" max={selectedTable.seats || 20} value={form.partySize} onChange={e => setForm(f => ({ ...f, partySize: e.target.value }))} />
                    </label>
                    <label className="tbk-field">
                      <span>{t('tableBooking.fieldOccasion')}</span>
                      <select className="input" value={form.occasion} onChange={e => setForm(f => ({ ...f, occasion: e.target.value }))}>
                        <option value="">{t('tableBooking.occasionPlaceholder')}</option>
                        {BOOKING_OCCASIONS.map(key => (
                          <option key={key} value={key}>{t(`tableBooking.occasions.${key}`)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="tbk-field">
                      <span>{t('tableBooking.fieldNote')}</span>
                      <textarea className="input" rows={2} placeholder={t('tableBooking.notePh')} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                    </label>
                    {/* Honeypot — hidden from real visitors via CSS, not a form attribute,
                        so a bot filling every field it can find still catches it. Kept out
                        of the tab order, and named/labeled to avoid matching any browser
                        autofill category (a field literally named/labeled "website" got
                        silently filled from saved autofill profiles for real guests, making
                        every booking look like spam and get silently dropped). */}
                    <label className="tbk-honeypot" aria-hidden="true">
                      <span>Leave blank</span>
                      <input
                        type="text"
                        name="hp_field_a1x9"
                        id="hp_field_a1x9"
                        tabIndex={-1}
                        autoComplete="off"
                        value={form.website}
                        onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                      />
                    </label>
                  </>
                )}

                <div className="tbk-modal__actions">
                  <button type="submit" className="btn btn-dark tbk-modal__submit" disabled={submitting || !selectedTime}>
                    {submitting ? t('tableBooking.submitting') : t('tableBooking.submit')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
