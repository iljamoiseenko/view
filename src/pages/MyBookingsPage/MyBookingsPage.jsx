import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../api/client'
import { kyivDateString } from '../../utils/kyivDate'
import './MyBookingsPage.css'

function today() {
  return kyivDateString()
}

export default function MyBookingsPage() {
  const { t } = useLanguage()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState(null)

  useEffect(() => {
    api.get('/table-booking/my/bookings')
      .then(setBookings)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const { upcoming, past } = useMemo(() => {
    const now = today()
    const sorted = [...bookings]
    return {
      upcoming: sorted.filter(b => b.date >= now).sort((a, b) => a.date === b.date ? (a.time || '').localeCompare(b.time || '') : a.date.localeCompare(b.date)),
      past: sorted.filter(b => b.date < now),
    }
  }, [bookings])

  const cancelBooking = async (booking) => {
    if (!window.confirm(t('myBookings.cancelConfirm', booking.placeName))) return
    setCancellingId(booking.id)
    try {
      await api.delete(`/table-booking/bookings/${booking.id}`)
      setBookings(prev => prev.filter(b => b.id !== booking.id))
    } catch {
      // silently fail — the row stays, guest can retry
    } finally {
      setCancellingId(null)
    }
  }

  const renderRow = (b, cancellable) => (
    <div key={b.id} className="mb-row">
      <div className="mb-row__date">
        <span className="mb-row__day">{b.date}</span>
        <span className="mb-row__time">{b.time || '—'}</span>
      </div>
      <div className="mb-row__info">
        <Link to={`/place/${b.placeId}`} className="mb-row__place">{b.placeName}</Link>
        <span className="mb-row__meta">
          {b.placeCity}{b.tableLabel ? ` · ${b.tableLabel}` : ''} · {t('venueAdmin.bookingPopupGuests', b.partySize)}
          {b.occasion && ` · ${t(`tableBooking.occasions.${b.occasion}`)}`}
        </span>
        {b.note && <span className="mb-row__note">{b.note}</span>}
      </div>
      {cancellable && (
        <button
          type="button"
          className="btn btn-outline btn-sm mb-row__cancel"
          disabled={cancellingId === b.id}
          onClick={() => cancelBooking(b)}
        >
          {cancellingId === b.id ? t('venueAdmin.bookingCancelling') : t('myBookings.cancelBtn')}
        </button>
      )}
    </div>
  )

  return (
    <div className="mb-page">
      <div className="container mb-inner">
        <h1 className="mb-title">{t('myBookings.title')}</h1>

        {loading ? (
          <p className="mb-empty">…</p>
        ) : bookings.length === 0 ? (
          <div className="empty-state">
            <h3>{t('myBookings.emptyTitle')}</h3>
            <p>{t('myBookings.emptyText')}</p>
            <Link to="/" className="btn btn-dark">{t('placeDetail.toHome')}</Link>
          </div>
        ) : (
          <>
            <section className="mb-section">
              <h2 className="mb-section__title">{t('myBookings.upcoming')}</h2>
              {upcoming.length === 0 ? (
                <p className="mb-empty">{t('myBookings.noUpcoming')}</p>
              ) : (
                <div className="mb-list">{upcoming.map(b => renderRow(b, true))}</div>
              )}
            </section>

            {past.length > 0 && (
              <section className="mb-section">
                <h2 className="mb-section__title">{t('myBookings.past')}</h2>
                <div className="mb-list mb-list--past">{past.map(b => renderRow(b, false))}</div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
