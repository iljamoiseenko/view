import { useState, useEffect, useMemo } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../api/client'
import { computeFreeSlots } from '../../utils/tableSlots'
import { BOOKING_OCCASIONS } from '../../data/initialData'
import { kyivDateString, kyivMinutesNow } from '../../utils/kyivDate'
import './BookingCalendarView.css'

function today() {
  return kyivDateString()
}

const EMPTY_MANUAL_FORM = { floorId: '', tableId: '', date: '', time: null, guestName: '', guestPhone: '', partySize: 2, occasion: '', note: '' }

// Read-only floor map(s) + booking list for a single day, embedded in the
// venue's "Бронювання столів" tab once at least one floor exists — lets the
// owner see who's booked what, on every floor/terrace, without leaving the dashboard.
export default function BookingCalendarView({ placeId, tableBookingPaused, onTogglePaused }) {
  const { t } = useLanguage()
  const [date, setDate] = useState(today())
  const [floors, setFloors] = useState([])
  const [activeFloorId, setActiveFloorId] = useState(null)
  const [floorObjectsById, setFloorObjectsById] = useState({})
  const [floorsLoading, setFloorsLoading] = useState(true)
  const [bookings, setBookings] = useState([])
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState(null)
  const [cancellingAll, setCancellingAll] = useState(false)
  const [highlightId, setHighlightId] = useState(null)
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualLockedTable, setManualLockedTable] = useState(false)
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL_FORM)
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [manualError, setManualError] = useState('')
  const [pauseSaving, setPauseSaving] = useState(false)
  const [showHoursPanel, setShowHoursPanel] = useState(false)
  const [hoursForm, setHoursForm] = useState({ availableFrom: '10:00', availableTo: '23:00', slotMinutes: 90 })
  const [hoursSaving, setHoursSaving] = useState(false)
  const [hoursSaved, setHoursSaved] = useState(false)
  const [hoursError, setHoursError] = useState('')

  const reloadFloorObjects = (opts = {}) => {
    if (!placeId) return Promise.resolve()
    if (!opts.silent) setFloorsLoading(true)
    return api.get(`/table-booking/${placeId}/floors`)
      .then(async (list) => {
        setFloors(list)
        if (list.length > 0) setActiveFloorId(prev => (list.some(f => f.id === prev) ? prev : list[0].id))
        const results = await Promise.all(
          list.map(f => api.get(`/table-booking/floor/${f.id}`).catch(() => ({ objects: [] })))
        )
        const map = {}
        results.forEach((r, i) => { map[list[i].id] = r.objects || [] })
        setFloorObjectsById(map)
      })
      .catch(() => {})
      .finally(() => { if (!opts.silent) setFloorsLoading(false) })
  }

  useEffect(() => { reloadFloorObjects() }, [placeId])

  // Silent by default — only the very first load shows the loading state, a
  // background poll shouldn't flash the list away while the owner is reading it.
  const reloadBookings = (opts = {}) => {
    if (!placeId) return
    if (!opts.silent) setBookingsLoading(true)
    api.get(`/table-booking/${placeId}/bookings`)
      .then(setBookings)
      .catch(() => {})
      .finally(() => setBookingsLoading(false))
  }

  useEffect(reloadBookings, [placeId])

  // Keep the map/list current without a manual refresh: poll every 15s while
  // this tab is open, plus an immediate refetch whenever the browser tab
  // regains focus (covers "left it open, came back later").
  const BOOKING_POLL_MS = 15000
  useEffect(() => {
    if (!placeId) return
    const interval = setInterval(() => reloadBookings({ silent: true }), BOOKING_POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') reloadBookings({ silent: true }) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId])

  const bookingsForDate = useMemo(
    () => bookings.filter(b => b.date === date).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [bookings, date]
  )
  const bookingCountByTable = useMemo(() => {
    const m = {}
    bookingsForDate.forEach(b => { m[b.tableId] = (m[b.tableId] || 0) + 1 })
    return m
  }, [bookingsForDate])
  const tableLabelById = useMemo(() => {
    const m = {}
    Object.values(floorObjectsById).forEach(objs => objs.forEach(o => { m[o.id] = o.label }))
    return m
  }, [floorObjectsById])

  const activeFloor = floors.find(f => f.id === activeFloorId)
  const activeObjects = floorObjectsById[activeFloorId] || []

  // Prefill the bulk hours form from whatever the first table already has,
  // once — so opening the panel shows real current values instead of
  // hardcoded defaults, without fighting the owner's own edits afterward.
  useEffect(() => {
    const firstTable = Object.values(floorObjectsById).flat().find(o => o.kind === 'table')
    if (firstTable) {
      setHoursForm({
        availableFrom: firstTable.availableFrom || '10:00',
        availableTo: firstTable.availableTo || '23:00',
        slotMinutes: firstTable.slotMinutes || 90,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorsLoading])

  const applyHoursToAllTables = async () => {
    setHoursError('')
    setHoursSaving(true)
    setHoursSaved(false)
    try {
      await api.put(`/table-booking/${placeId}/tables/hours`, hoursForm)
      await reloadFloorObjects({ silent: true })
      setHoursSaved(true)
      setTimeout(() => setHoursSaved(false), 2000)
    } catch (err) {
      if (err.message === 'INVALID_HOURS_RANGE') setHoursError(t('venueAdmin.hoursErrorRange'))
      else setHoursError(t('venueAdmin.hoursErrorGeneric'))
    } finally {
      setHoursSaving(false)
    }
  }

  // ── Manual booking (staff took a phone call) — also doubles as the "click a
  // table to see who's in it, and book it" flow: openManualModal(tableId)
  // locks the floor/table pickers to that table and shows its existing
  // bookings for the chosen date above the add-booking form. ─────────────────
  const bookingsForModalTable = useMemo(
    () => bookings.filter(b => b.tableId === manualForm.tableId && b.date === manualForm.date),
    [bookings, manualForm.tableId, manualForm.date]
  )
  const manualModalTableLabel = manualForm.tableId ? (tableLabelById[manualForm.tableId] || '—') : ''

  const manualFloorObjects = floorObjectsById[manualForm.floorId] || []
  const manualTables = manualFloorObjects.filter(o => o.kind === 'table' && o.isBookable)
  const manualTable = manualTables.find(t => t.id === manualForm.tableId) || null
  const manualFreeSlots = useMemo(() => {
    if (!manualTable || !manualForm.date) return []
    const bookingsForTable = bookings.filter(b => b.tableId === manualTable.id && b.date === manualForm.date)
    const minMinutes = manualForm.date === today() ? kyivMinutesNow() : 0
    return computeFreeSlots(manualTable, bookingsForTable, minMinutes)
  }, [manualTable, manualForm.date, bookings])

  // Pass a tableId when opening from a click on the canvas — locks the
  // floor/table pickers to it. Called with no args from the "+ Додати
  // бронювання" header button, which leaves them free to choose.
  const openManualModal = (tableId) => {
    const floorId = activeFloorId || floors[0]?.id || ''
    const firstTable = (floorObjectsById[floorId] || []).find(o => o.kind === 'table' && o.isBookable)
    setManualForm({ ...EMPTY_MANUAL_FORM, floorId, tableId: tableId || firstTable?.id || '', date })
    setManualLockedTable(!!tableId)
    setManualError('')
    setShowManualModal(true)
  }

  const togglePaused = async () => {
    if (!onTogglePaused) return
    setPauseSaving(true)
    try {
      await onTogglePaused(!tableBookingPaused)
    } finally {
      setPauseSaving(false)
    }
  }

  const submitManualBooking = async (e) => {
    e.preventDefault()
    if (!manualForm.tableId || !manualForm.time) return
    setManualSubmitting(true)
    setManualError('')
    try {
      const created = await api.post(`/table-booking/${placeId}/bookings/manual`, {
        tableId: manualForm.tableId,
        date: manualForm.date,
        time: manualForm.time,
        guestName: manualForm.guestName,
        guestPhone: manualForm.guestPhone,
        partySize: Number(manualForm.partySize) || 1,
        occasion: manualForm.occasion || null,
        note: manualForm.note || null,
      })
      setBookings(prev => [...prev, created])
      setShowManualModal(false)
    } catch (err) {
      if (err.message === 'TABLE_ALREADY_BOOKED') setManualError(t('venueAdmin.bookingManualErrorTaken'))
      else if (err.message === 'INVALID_PHONE') setManualError(t('venueAdmin.bookingManualErrorPhone'))
      else setManualError(t('venueAdmin.bookingManualErrorGeneric'))
    } finally {
      setManualSubmitting(false)
    }
  }

  const cancelBooking = async (booking) => {
    if (!window.confirm(t('venueAdmin.bookingCancelConfirm', booking.guestName || t('venueAdmin.bookingGuestFallback')))) return
    setCancellingId(booking.id)
    try {
      await api.delete(`/table-booking/bookings/${booking.id}`)
      setBookings(prev => prev.filter(b => b.id !== booking.id))
    } catch {
      // silently fail — the row stays, owner can retry
    } finally {
      setCancellingId(null)
    }
  }

  // Quick cleanup if spam/prank bookings get through anyway — wipes every
  // booking on the selected date across all floors in one go.
  const cancelAllForDate = async () => {
    if (bookingsForDate.length === 0) return
    if (!window.confirm(t('venueAdmin.bookingCancelAllConfirm', bookingsForDate.length))) return
    setCancellingAll(true)
    const ids = bookingsForDate.map(b => b.id)
    const results = await Promise.allSettled(ids.map(id => api.delete(`/table-booking/bookings/${id}`)))
    const failedIds = new Set(ids.filter((_, i) => results[i].status === 'rejected'))
    setBookings(prev => prev.filter(b => !ids.includes(b.id) || failedIds.has(b.id)))
    setCancellingAll(false)
  }

  if (floorsLoading) return <div className="vbk"><p className="vbk__empty">{t('venueAdmin.bookingListLoading')}</p></div>

  return (
    <div className="vbk">
      <div className="vbk__head">
        <h3 className="vbk__title">
          {t('venueAdmin.bookingMapTitle')}
          <span className="vbk__live" title={t('venueAdmin.bookingLiveHint')}>
            <span className="vbk__live-dot" />
            {t('venueAdmin.bookingLive')}
          </span>
        </h3>
        <div className="vbk__head-row">
          <label className="vbk__date">
            <span>{t('venueAdmin.bookingDateLabel')}</span>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <div className="vbk__legend">
            <span className="vbk__legend-item"><i className="vbk__swatch vbk__swatch--free" />{t('venueAdmin.bookingLegendFree')}</span>
            <span className="vbk__legend-item"><i className="vbk__swatch vbk__swatch--booked" />{t('venueAdmin.bookingLegendBooked')}</span>
          </div>
          <button type="button" className="btn btn-dark btn-sm" onClick={() => openManualModal()}>
            {t('venueAdmin.bookingManualAddBtn')}
          </button>
        </div>
      </div>

      <div className="vbk__floors">
        {floors.length > 1 && floors.map(f => (
          <button
            key={f.id}
            type="button"
            className={`vbk__floor-tab ${f.id === activeFloorId ? 'active' : ''}`}
            onClick={() => setActiveFloorId(f.id)}
          >
            {f.name}
          </button>
        ))}
        <button type="button" className="vbk__floor-tab vbk__hours-toggle" onClick={() => setShowHoursPanel(v => !v)}>
          ⚙️ {t('venueAdmin.settingsToggle')}
        </button>
      </div>

      {showHoursPanel && (
        <div className="vbk__hours-panel">
          <label className="vbk__pause" title={t('venueAdmin.pauseBookingsHint')}>
            <input
              type="checkbox"
              checked={!!tableBookingPaused}
              disabled={pauseSaving || !onTogglePaused}
              onChange={togglePaused}
            />
            {t('venueAdmin.pauseBookingsLabel')}
          </label>

          <p className="vbk__hours-hint">{t('venueAdmin.hoursPanelHint')}</p>
          {hoursError && <p className="tle-error">{hoursError}</p>}
          <div className="vbk__hours-fields">
            <label className="tle-props__field">
              <span>{t('tableEditor.propsAvailableFrom')}</span>
              <input
                type="time"
                className="input"
                value={hoursForm.availableFrom}
                onChange={e => setHoursForm(f => ({ ...f, availableFrom: e.target.value }))}
              />
            </label>
            <label className="tle-props__field">
              <span>{t('tableEditor.propsAvailableTo')}</span>
              <input
                type="time"
                className="input"
                value={hoursForm.availableTo}
                onChange={e => setHoursForm(f => ({ ...f, availableTo: e.target.value }))}
              />
            </label>
            <label className="tle-props__field">
              <span>{t('tableEditor.propsSlotMinutes')}</span>
              <input
                type="number"
                className="input"
                min="15"
                max="480"
                step="15"
                value={hoursForm.slotMinutes}
                onChange={e => setHoursForm(f => ({ ...f, slotMinutes: e.target.value }))}
              />
            </label>
          </div>
          <button type="button" className="btn btn-dark btn-sm" disabled={hoursSaving} onClick={applyHoursToAllTables}>
            {hoursSaving ? t('venueAdmin.hoursSaving') : hoursSaved ? t('venueAdmin.hoursSaved') : t('venueAdmin.hoursApplyBtn')}
          </button>
        </div>
      )}

      {activeFloor && (
        <div className="vbk__canvas-wrap">
          <div className="vbk__canvas" style={{ width: activeFloor.width, height: activeFloor.height, background: activeFloor.background }}>
            {activeObjects.map(o => {
              const isTable = o.kind === 'table'
              const count = isTable ? (bookingCountByTable[o.id] || 0) : 0
              const clickable = isTable && o.isBookable
              return (
                <div
                  key={o.id}
                  className={`vbk-obj vbk-obj--${o.kind} vbk-obj--${o.shape} ${count > 0 ? 'is-booked' : ''} ${clickable ? 'is-clickable' : ''} ${highlightId && bookingsForDate.find(b => b.id === highlightId)?.tableId === o.id ? 'is-highlight' : ''}`}
                  style={{ left: o.x, top: o.y, width: o.width, height: o.height, backgroundColor: count > 0 ? undefined : o.color || undefined }}
                  onClick={() => { if (clickable) openManualModal(o.id) }}
                >
                  <span className="vbk-obj__label">{o.label}</span>
                  {count > 0 && <span className="vbk-obj__count" title={t('venueAdmin.bookingCountHint', count)}>{count}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="vbk__list">
        {bookingsLoading ? (
          <p className="vbk__empty">{t('venueAdmin.bookingListLoading')}</p>
        ) : bookingsForDate.length === 0 ? (
          <p className="vbk__empty">{t('venueAdmin.bookingListEmpty')}</p>
        ) : (
          <>
          <div className="vbk__list-head">
            <button
              type="button"
              className="btn btn-outline btn-sm vbk__cancel"
              disabled={cancellingAll}
              onClick={cancelAllForDate}
            >
              {cancellingAll ? t('venueAdmin.bookingCancelling') : t('venueAdmin.bookingCancelAllBtn')}
            </button>
          </div>
          <div className="va-table-wrap">
            <table className="va-table">
              <thead>
                <tr>
                  <th>{t('venueAdmin.thTable')}</th>
                  <th>{t('venueAdmin.thTime')}</th>
                  <th>{t('venueAdmin.thGuest')}</th>
                  <th>{t('venueAdmin.thPhone')}</th>
                  <th>{t('venueAdmin.thGuests')}</th>
                  <th>{t('venueAdmin.thActions')}</th>
                </tr>
              </thead>
              <tbody>
                {bookingsForDate.map(b => (
                  <tr
                    key={b.id}
                    onMouseEnter={() => setHighlightId(b.id)}
                    onMouseLeave={() => setHighlightId(null)}
                  >
                    <td className="va-table__main">{tableLabelById[b.tableId] || '—'}</td>
                    <td>{b.time || '—'}</td>
                    <td>
                      {b.guestName || '—'}
                      {b.source === 'phone' && <span className="vbk__source-badge" title={t('venueAdmin.bookingSourcePhone')}>📞</span>}
                    </td>
                    <td>{b.guestPhone ? <a href={`tel:${b.guestPhone}`} className="vbk__phone">{b.guestPhone}</a> : '—'}</td>
                    <td>{b.partySize}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm vbk__cancel"
                        disabled={cancellingId === b.id}
                        onClick={() => cancelBooking(b)}
                      >
                        {cancellingId === b.id ? t('venueAdmin.bookingCancelling') : t('venueAdmin.bookingCancelBtn')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {showManualModal && (
        <div className="va-modal-overlay" onClick={() => setShowManualModal(false)}>
          <div className="va-modal va-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="va-modal__head">
              <h2>{manualLockedTable ? t('venueAdmin.bookingPopupTitle', manualModalTableLabel) : t('venueAdmin.bookingManualTitle')}</h2>
              <button type="button" className="va-modal__close" onClick={() => setShowManualModal(false)}>✕</button>
            </div>
            <form onSubmit={submitManualBooking} className="va-modal__form">
              <div className="va-modal-body">
                {bookingsForModalTable.length > 0 ? (
                  <div className="vbk-popup vbk-popup--in-modal">
                    {bookingsForModalTable.map(b => (
                      <div key={b.id} className="vbk-popup__row">
                        <div className="vbk-popup__time">{b.time || '—'}</div>
                        <div className="vbk-popup__info">
                          <div className="vbk-popup__guest">
                            {b.guestName || '—'}
                            {b.source === 'phone' && <span className="vbk__source-badge" title={t('venueAdmin.bookingSourcePhone')}>📞</span>}
                          </div>
                          {b.guestPhone && <a href={`tel:${b.guestPhone}`} className="vbk__phone">{b.guestPhone}</a>}
                          <div className="vbk-popup__meta">
                            {t('venueAdmin.bookingPopupGuests', b.partySize)}
                            {b.occasion && <span> · {t(`tableBooking.occasions.${b.occasion}`)}</span>}
                            {b.note && <span> · {b.note}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm vbk__cancel"
                          disabled={cancellingId === b.id}
                          onClick={() => cancelBooking(b)}
                        >
                          {cancellingId === b.id ? t('venueAdmin.bookingCancelling') : t('venueAdmin.bookingCancelBtn')}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="vbk__empty" style={{ padding: '0 0 12px' }}>{t('venueAdmin.tablePopupNoBookings')}</p>
                )}

                {manualError && <p className="tle-error">{manualError}</p>}

                {!manualLockedTable && floors.length > 1 && (
                  <label className="tle-props__field">
                    <span>{t('venueAdmin.bookingManualFloor')}</span>
                    <select
                      className="input"
                      value={manualForm.floorId}
                      onChange={e => {
                        const floorId = e.target.value
                        const firstTable = (floorObjectsById[floorId] || []).find(o => o.kind === 'table' && o.isBookable)
                        setManualForm(f => ({ ...f, floorId, tableId: firstTable?.id || '', time: null }))
                      }}
                    >
                      {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </label>
                )}

                {!manualLockedTable && (
                  <label className="tle-props__field">
                    <span>{t('venueAdmin.bookingManualTable')}</span>
                    <select
                      className="input"
                      value={manualForm.tableId}
                      onChange={e => setManualForm(f => ({ ...f, tableId: e.target.value, time: null }))}
                    >
                      {manualTables.length === 0 && <option value="">{t('venueAdmin.bookingManualNoTables')}</option>}
                      {manualTables.map(tbl => (
                        <option key={tbl.id} value={tbl.id}>{tbl.label} ({t('venueAdmin.bookingPopupGuests', tbl.seats || 1)})</option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="tle-props__field">
                  <span>{t('venueAdmin.bookingDateLabel')}</span>
                  <input
                    type="date"
                    className="input"
                    min={today()}
                    value={manualForm.date}
                    onChange={e => setManualForm(f => ({ ...f, date: e.target.value, time: null }))}
                  />
                </label>

                {manualTable && (
                  <div className="tle-props__field">
                    <span>{t('venueAdmin.bookingManualTime')}</span>
                    {manualFreeSlots.length === 0 ? (
                      <p className="vbk__empty" style={{ padding: '8px 0' }}>{t('venueAdmin.bookingManualNoSlots')}</p>
                    ) : (
                      <div className="tbk-slots">
                        {manualFreeSlots.map(slot => (
                          <button
                            key={slot}
                            type="button"
                            className={`tbk-slot ${manualForm.time === slot ? 'is-active' : ''}`}
                            onClick={() => setManualForm(f => ({ ...f, time: slot }))}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {manualForm.time && (
                  <>
                    <label className="tle-props__field">
                      <span>{t('venueAdmin.bookingManualGuestName')}</span>
                      <input className="input" value={manualForm.guestName} onChange={e => setManualForm(f => ({ ...f, guestName: e.target.value }))} />
                    </label>
                    <label className="tle-props__field">
                      <span>{t('venueAdmin.bookingManualGuestPhone')}</span>
                      <input className="input" type="tel" placeholder="+380 XX XXX-XX-XX" value={manualForm.guestPhone} onChange={e => setManualForm(f => ({ ...f, guestPhone: e.target.value }))} />
                    </label>
                    <label className="tle-props__field">
                      <span>{t('tableBooking.fieldPartySize')}</span>
                      <input className="input" type="number" min="1" max={manualTable?.seats || 20} value={manualForm.partySize} onChange={e => setManualForm(f => ({ ...f, partySize: e.target.value }))} />
                    </label>
                    <label className="tle-props__field">
                      <span>{t('tableBooking.fieldOccasion')}</span>
                      <select className="input" value={manualForm.occasion} onChange={e => setManualForm(f => ({ ...f, occasion: e.target.value }))}>
                        <option value="">{t('tableBooking.occasionPlaceholder')}</option>
                        {BOOKING_OCCASIONS.map(key => (
                          <option key={key} value={key}>{t(`tableBooking.occasions.${key}`)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="tle-props__field">
                      <span>{t('tableBooking.fieldNote')}</span>
                      <textarea className="input" rows={2} placeholder={t('tableBooking.notePh')} value={manualForm.note} onChange={e => setManualForm(f => ({ ...f, note: e.target.value }))} />
                    </label>
                  </>
                )}
              </div>
              <div className="va-modal__foot">
                <button type="button" className="btn btn-outline" onClick={() => setShowManualModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-dark" disabled={manualSubmitting || !manualForm.time}>
                  {manualSubmitting ? t('tableBooking.submitting') : t('venueAdmin.bookingManualSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
