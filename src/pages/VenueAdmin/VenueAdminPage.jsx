import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../api/client'
import { PLACE_TYPES, EVENT_TYPES, CITIES, CUISINE_LIST, TICKET_TYPES, COLLECTIONS, SUBSCRIPTION_TIERS } from '../../data/initialData'
import { getEventTypeLabel } from '../../utils/eventType'
import './VenueAdminPage.css'

const EMPTY_LOGIN_FORM = { currentPassword: '', username: '' }
const EMPTY_PASSWORD_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' }

const EMPTY_EVENT = {
  title: '', description: '', date: '', time: '19:00',
  type: 'live_music', price: 0, image: '', customType: '',
}

// ── Photo input with file upload + URL fallback ──────────────────────────────
function PhotoInput({ value, onChange, placeholder }) {
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
          {uploading ? '...' : t('venueAdmin.uploadFile')}
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

// ── Cuisine select with a free-text "Інше" option ────────────────────────────
// "custom mode" is tracked separately from the value itself — otherwise clearing
// the free-text field to '' looks identical to "nothing selected" and the field
// disappears, forcing the user back to the dropdown to re-enter custom mode.
function CuisineSelect({ value, onChange }) {
  const { t } = useLanguage()
  const knownCuisines = CUISINE_LIST.filter(c => c !== 'Інше')
  const [customMode, setCustomMode] = useState(!!value && !knownCuisines.includes(value))

  const selectVal = customMode ? 'Інше' : (value || '')

  return (
    <>
      <select className="input" value={selectVal}
        onChange={e => {
          if (e.target.value === 'Інше') {
            setCustomMode(true)
            onChange('')
          } else {
            setCustomMode(false)
            onChange(e.target.value)
          }
        }}>
        <option value="">{t('venueAdmin.chooseOption')}</option>
        {CUISINE_LIST.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      {customMode && (
        <input className="input" style={{ marginTop: 6 }}
          placeholder={t('venueAdmin.customCuisinePh')}
          value={value || ''}
          onChange={e => onChange(e.target.value)} />
      )}
    </>
  )
}

// ── Event Modal ──────────────────────────────────────────────────────────────
function EventModal({ initial, placeId, onSave, onClose }) {
  const { t } = useLanguage()
  const [form, setForm] = useState({ ...EMPTY_EVENT, placeId, ...initial })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="va-modal-overlay" onClick={onClose}>
      <div className="va-modal" onClick={e => e.stopPropagation()}>
        <div className="va-modal__head">
          <h2>{initial?.id ? t('venueAdmin.modalEditEvent') : t('venueAdmin.modalNewEvent')}</h2>
          <button className="va-modal__close" onClick={onClose}>✕</button>
        </div>
        <form className="va-modal__form" onSubmit={e => { e.preventDefault(); onSave({ ...form, price: Number(form.price) }) }}>
          <div className="va-modal-body">
            <div className="va-field-group">
              <div className="va-field va-field--full">
                <label className="va-label">{t('venueAdmin.fieldName')}</label>
                <input className="input" required value={form.title}
                  onChange={e => set('title', e.target.value)} placeholder={t('venueAdmin.eventNamePh')} />
              </div>
            </div>

            <div className="va-field-group">
              <div className="va-field">
                <label className="va-label">{t('venueAdmin.fieldEventType')}</label>
                <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
                  {Object.keys(EVENT_TYPES).map(k => <option key={k} value={k}>{t(`eventTypes.${k}`)}</option>)}
                </select>
                {form.type === 'other' && (
                  <input className="input" style={{ marginTop: 6 }}
                    placeholder={t('venueAdmin.customTypePh')}
                    value={form.customType || ''}
                    onChange={e => set('customType', e.target.value)} />
                )}
              </div>
              <div className="va-field">
                <label className="va-label">{t('venueAdmin.fieldPrice')}</label>
                <input className="input" type="number" min="0" value={form.price}
                  onChange={e => set('price', e.target.value)} />
              </div>
            </div>

            <div className="va-field-group">
              <div className="va-field">
                <label className="va-label">{t('venueAdmin.fieldEventDate')}</label>
                <input className="input" type="date" required value={form.date}
                  onChange={e => set('date', e.target.value)} />
              </div>
              <div className="va-field">
                <label className="va-label">{t('venueAdmin.fieldEventTime')}</label>
                <input className="input" type="time" required value={form.time}
                  onChange={e => set('time', e.target.value)} />
              </div>
            </div>

            <div className="va-field-group">
              <div className="va-field va-field--full">
                <label className="va-label">{t('venueAdmin.fieldEventDesc')}</label>
                <textarea className="input textarea" rows={3} required value={form.description}
                  onChange={e => set('description', e.target.value)} placeholder={t('venueAdmin.eventDescPh')} />
              </div>
            </div>

            <div className="va-field-group">
              <div className="va-field va-field--full">
                <label className="va-label">{t('venueAdmin.fieldEventPhoto')}</label>
                <PhotoInput value={form.image} onChange={v => set('image', v)} />
              </div>
            </div>
          </div>
          <div className="va-modal__foot">
            <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-dark">
              {initial?.id ? t('venueAdmin.saveEvent') : t('venueAdmin.addEventBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main VenueAdminPage ──────────────────────────────────────────────────────
export default function VenueAdminPage() {
  const { currentUser, logout, refreshCurrentUser } = useAuth()
  const { places, events, updatePlace, addEvent, updateEvent, deleteEvent } = useApp()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const place = places.find(p => p.id === currentUser?.placeId)
  const myEvents = events.filter(e => e.placeId === currentUser?.placeId)
    .sort((a, b) => a.date.localeCompare(b.date))

  const [tab, setTab] = useState('place')
  const [thankYouVisible, setThankYouVisible] = useState(searchParams.get('payment') === 'return')
  const [paymentPending, setPaymentPending] = useState(searchParams.get('payment') === 'return')
  const [paymentActivated, setPaymentActivated] = useState(false)

  // Returned from WayForPay — poll a few times for the webhook to land and activate the plan
  useEffect(() => {
    if (searchParams.get('payment') !== 'return') return
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      const user = await refreshCurrentUser().catch(() => null)
      if (user?.subscriptionStatus === 'active') {
        clearInterval(poll)
        setPaymentPending(false)
        setPaymentActivated(true)
        setSearchParams({}, { replace: true })
      } else if (attempts >= 6) {
        clearInterval(poll)
        setPaymentPending(false)
        setSearchParams({}, { replace: true })
      }
    }, 3000)
    return () => clearInterval(poll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleContinueToAccount = () => {
    setThankYouVisible(false)
    setTab('subscription')
  }

  const ONBOARDING_STEPS = 4
  const [onboardingVisible, setOnboardingVisible] = useState(searchParams.get('onboarding') === '1')
  const [onboardingStep, setOnboardingStep] = useState(1)
  const [onboardingSaving, setOnboardingSaving] = useState(false)

  const finishOnboarding = () => {
    setOnboardingVisible(false)
    setSearchParams({}, { replace: true })
    setTab('place')
  }

  const saveOnboardingStep = async () => {
    if (!place) return
    let data = null
    if (onboardingStep === 1) {
      data = { name: placeForm.name, type: placeForm.type, customType: placeForm.customType, city: placeForm.city, address: placeForm.address, cuisine: placeForm.cuisine }
    } else if (onboardingStep === 2) {
      data = { photos: (placeForm.photos || []).filter(Boolean) }
    } else if (onboardingStep === 3) {
      data = {
        instagramUrl: placeForm.instagramUrl, facebookUrl: placeForm.facebookUrl, tiktokUrl: placeForm.tiktokUrl,
        threadsUrl: placeForm.threadsUrl, telegramUrl: placeForm.telegramUrl, youtubeUrl: placeForm.youtubeUrl,
        collections: placeForm.collections || [],
      }
    }
    if (!data) return
    setOnboardingSaving(true)
    try {
      const updated = await updatePlace(place.id, data)
      setPlaceForm(f => ({ ...f, ...updated, tags: Array.isArray(updated.tags) ? updated.tags.join(', ') : '', collections: Array.isArray(updated.collections) ? updated.collections : [] }))
    } catch {
      // best-effort — the full editor is always there to fix it later
    } finally {
      setOnboardingSaving(false)
    }
  }

  const handleOnboardingNext = async () => {
    await saveOnboardingStep()
    if (onboardingStep < ONBOARDING_STEPS) setOnboardingStep(s => s + 1)
    else finishOnboarding()
  }

  const handleOnboardingSkip = () => {
    if (onboardingStep < ONBOARDING_STEPS) setOnboardingStep(s => s + 1)
    else finishOnboarding()
  }

  const [eventModal, setEventModal] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [saved, setSaved] = useState(false)
  const [wasFirstPublish, setWasFirstPublish] = useState(false)

  const [accountTab, setAccountTab] = useState('login')
  const [loginForm, setLoginForm] = useState(EMPTY_LOGIN_FORM)
  const [loginError, setLoginError] = useState('')
  const [loginSaving, setLoginSaving] = useState(false)
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [accountSaved, setAccountSaved] = useState(false)

  const [placeForm, setPlaceForm] = useState(() => {
    if (!place) return {}
    return {
      ...place,
      photos: place.photos?.length ? place.photos : [''],
      tags: Array.isArray(place.tags) ? place.tags.join(', ') : '',
      collections: Array.isArray(place.collections) ? place.collections : [],
    }
  })

  // places load asynchronously — hydrate the form once the venue's data arrives
  const placeFormInitialized = useRef(!!place)
  useEffect(() => {
    if (place && !placeFormInitialized.current) {
      placeFormInitialized.current = true
      setPlaceForm({
        ...place,
        photos: place.photos?.length ? place.photos : [''],
        tags: Array.isArray(place.tags) ? place.tags.join(', ') : '',
        collections: Array.isArray(place.collections) ? place.collections : [],
      })
    }
  }, [place])

  const isTicketType = TICKET_TYPES.includes(placeForm.type)

  const [boostQuota, setBoostQuota] = useState(null)
  const [boosting, setBoosting] = useState(false)
  const [boostError, setBoostError] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [checkingOutTier, setCheckingOutTier] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const hasActiveSub = currentUser?.subscriptionStatus === 'active'

  useEffect(() => {
    if (!place?.id) return
    api.get(`/places/${place.id}/boost-quota`).then(setBoostQuota).catch(() => {})
  }, [place?.id])

  const handleBoost = async () => {
    if (!place) return
    setBoosting(true)
    setBoostError('')
    try {
      const updated = await api.post(`/places/${place.id}/boost`, {})
      setPlaceForm(f => ({ ...f, topUntil: updated.topUntil, boostedAt: updated.boostedAt }))
      const quota = await api.get(`/places/${place.id}/boost-quota`)
      setBoostQuota(quota)
    } catch (err) {
      setBoostError(err.message)
    } finally {
      setBoosting(false)
    }
  }

  const handleCancelPlan = async () => {
    if (!window.confirm(t('venueAdmin.cancelPlanConfirm'))) return
    setCancelling(true)
    setCancelError('')
    try {
      await api.post('/subscriptions/cancel', {})
      await refreshCurrentUser()
    } catch (err) {
      setCancelError(err.message || t('venueAdmin.cancelPlanError'))
    } finally {
      setCancelling(false)
    }
  }

  const handleChoosePlan = async (tierKey) => {
    setCheckingOutTier(tierKey)
    setCheckoutError('')
    try {
      const { action, fields } = await api.post('/subscriptions/checkout', { tier: tierKey })
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = action
      Object.entries(fields).forEach(([key, value]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = value
        form.appendChild(input)
      })
      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      setCheckoutError(err.message)
      setCheckingOutTier(null)
    }
  }

  const setField = (k, v) => setPlaceForm(f => ({ ...f, [k]: v }))
  const setPhoto = (i, v) => {
    const p = [...(placeForm.photos || [''])]
    p[i] = v
    setField('photos', p)
  }

  const setMainPhoto = (i) => {
    if (i === 0) return
    const p = [...(placeForm.photos || [])]
    const [main] = p.splice(i, 1)
    setField('photos', [main, ...p])
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
    setPlaceForm(f => ({ ...f, ...updated, tags: Array.isArray(updated.tags) ? updated.tags.join(', ') : '', collections: Array.isArray(updated.collections) ? updated.collections : [] }))
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

  const setLoginField = (k, v) => setLoginForm(f => ({ ...f, [k]: v }))
  const setPasswordField = (k, v) => setPasswordForm(f => ({ ...f, [k]: v }))

  const showAccountSaved = () => {
    setAccountSaved(true)
    setTimeout(() => setAccountSaved(false), 3000)
  }

  const handleSaveLogin = async (e) => {
    e.preventDefault()
    setLoginError('')

    const newUsername = loginForm.username.trim()
    if (!loginForm.currentPassword) return setLoginError(t('venueAdmin.errCurrentPasswordRequired'))
    if (!newUsername) return setLoginError(t('venueAdmin.errNothingToChange'))

    setLoginSaving(true)
    try {
      await api.put(`/users/${currentUser.id}`, {
        currentPassword: loginForm.currentPassword,
        username: newUsername,
      })
      setLoginForm(EMPTY_LOGIN_FORM)
      showAccountSaved()
    } catch (err) {
      setLoginError(err.message)
    } finally {
      setLoginSaving(false)
    }
  }

  const handleSavePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')

    const newPassword = passwordForm.newPassword
    if (!passwordForm.currentPassword) return setPasswordError(t('venueAdmin.errCurrentPasswordRequired'))
    if (!newPassword) return setPasswordError(t('venueAdmin.errNothingToChange'))
    if (newPassword.length < 6) return setPasswordError(t('venueAdmin.errPasswordLen'))
    if (newPassword !== passwordForm.confirmPassword) return setPasswordError(t('venueAdmin.errPasswordMismatch'))

    setPasswordSaving(true)
    try {
      await api.put(`/users/${currentUser.id}`, {
        currentPassword: passwordForm.currentPassword,
        password: newPassword,
      })
      setPasswordForm(EMPTY_PASSWORD_FORM)
      showAccountSaved()
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setPasswordSaving(false)
    }
  }

  if (!place) {
    return (
      <div className="container" style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2>{t('venueAdmin.notFoundTitle')}</h2>
        <p style={{ color: 'var(--text-2)', marginTop: 8 }}>{t('venueAdmin.notFoundText')}</p>
      </div>
    )
  }

  if (thankYouVisible) {
    const state = paymentActivated ? 'active' : (paymentPending ? 'pending' : 'delayed')
    return (
      <div className="va-thankyou">
        <div className="va-thankyou__card">
          <div className={`va-thankyou__icon va-thankyou__icon--${state}`}>
            {state === 'pending' ? <span className="va-thankyou__spinner" /> : (state === 'active' ? '✓' : '!')}
          </div>
          <h1 className="va-thankyou__title">{t(`venueAdmin.thankYou${state === 'active' ? '' : state === 'pending' ? 'Pending' : 'Delayed'}Title`)}</h1>
          <p className="va-thankyou__text">{t(`venueAdmin.thankYou${state === 'active' ? '' : state === 'pending' ? 'Pending' : 'Delayed'}Text`)}</p>
          <button className="btn btn-dark va-thankyou__btn" onClick={handleContinueToAccount}>
            {t('venueAdmin.thankYouBtn')}
          </button>
        </div>
      </div>
    )
  }

  if (onboardingVisible) {
    const progress = Math.round((onboardingStep / ONBOARDING_STEPS) * 100)
    return (
      <div className="va-onboarding">
        <div className="va-onboarding__card">
          <div className="va-onboarding__head">
            <span className="va-onboarding__logo">VIEW</span>
            <span className="va-onboarding__step-of">{t('venueAdmin.onboardingStepOf', onboardingStep, ONBOARDING_STEPS)}</span>
          </div>
          <div className="va-onboarding__progress-track">
            <div className="va-onboarding__progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="va-onboarding__progress-pct">{progress}%</div>

          <div key={onboardingStep} className="va-onboarding__step">
            {onboardingStep === 1 && (
              <>
                <h1 className="va-onboarding__title">{t('venueAdmin.onboardingStep1Title')}</h1>
                <p className="va-onboarding__sub">{t('venueAdmin.onboardingStep1Sub')}</p>
                <div className="va-field-group">
                  <div className="va-field va-field--full">
                    <label className="va-label">{t('venueAdmin.fieldName')}</label>
                    <input className="input"
                      value={placeForm.name === 'Мій заклад' ? '' : (placeForm.name || '')}
                      placeholder={t('venueAdmin.onboardingNamePh')}
                      onChange={e => setField('name', e.target.value)} />
                  </div>
                </div>
                <div className="va-field-group">
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldType')}</label>
                    <select className="input" value={placeForm.type || 'restaurant'} onChange={e => setField('type', e.target.value)}>
                      {Object.keys(PLACE_TYPES).map(k => <option key={k} value={k}>{t(`placeTypes.${k}`)}</option>)}
                    </select>
                    {placeForm.type === 'other' && (
                      <input className="input" style={{ marginTop: 6 }}
                        placeholder={t('venueAdmin.customTypePh')}
                        value={placeForm.customType || ''}
                        onChange={e => setField('customType', e.target.value)} />
                    )}
                  </div>
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldCity')}</label>
                    <select className="input" value={placeForm.city || ''} onChange={e => setField('city', e.target.value)}>
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="va-field-group">
                  <div className="va-field va-field--full">
                    <label className="va-label">{t('venueAdmin.fieldAddress')}</label>
                    <input className="input" value={placeForm.address || ''} onChange={e => setField('address', e.target.value)} />
                  </div>
                </div>
                {!TICKET_TYPES.includes(placeForm.type) && (
                  <div className="va-field-group">
                    <div className="va-field va-field--full">
                      <label className="va-label">{t('venueAdmin.fieldCuisine')}</label>
                      <CuisineSelect value={placeForm.cuisine} onChange={v => setField('cuisine', v)} />
                    </div>
                  </div>
                )}
              </>
            )}

            {onboardingStep === 2 && (
              <>
                <h1 className="va-onboarding__title">{t('venueAdmin.onboardingStep2Title')}</h1>
                <p className="va-onboarding__sub">{t('venueAdmin.onboardingStep2Sub')}</p>
                <div className="va-photos-list">
                  {(placeForm.photos || ['']).map((ph, i) => (
                    <div key={i} className="va-photo-row">
                      <div className="va-photo-row__num">{i + 1}</div>
                      <div className="va-photo-row__input">
                        <PhotoInput value={ph} onChange={v => setPhoto(i, v)} placeholder={t('venueAdmin.photoUrlPh')} />
                      </div>
                      {i === 0 ? (
                        <span className="va-photo-main-badge">{t('venueAdmin.mainPhoto')}</span>
                      ) : (
                        <button type="button" className="va-photo-set-main" onClick={() => setMainPhoto(i)} title={t('venueAdmin.setMainTitle')}>
                          {t('venueAdmin.setMainPhoto')}
                        </button>
                      )}
                      {(placeForm.photos || []).length > 1 && (
                        <button type="button" className="va-rm-photo" onClick={() => setField('photos', placeForm.photos.filter((_, j) => j !== i))}>✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn-outline btn-sm va-add-photo" onClick={() => setField('photos', [...(placeForm.photos || []), ''])}>
                    {t('venueAdmin.addPhoto')}
                  </button>
                </div>
              </>
            )}

            {onboardingStep === 3 && (
              <>
                <h1 className="va-onboarding__title">{t('venueAdmin.onboardingStep3Title')}</h1>
                <p className="va-onboarding__sub">{t('venueAdmin.onboardingStep3Sub')}</p>
                <div className="va-form-grid">
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldInstagram')}</label>
                    <input className="input" type="url" value={placeForm.instagramUrl || ''} onChange={e => setField('instagramUrl', e.target.value)} placeholder="https://instagram.com/..." />
                  </div>
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldFacebook')}</label>
                    <input className="input" type="url" value={placeForm.facebookUrl || ''} onChange={e => setField('facebookUrl', e.target.value)} placeholder="https://facebook.com/..." />
                  </div>
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldTiktok')}</label>
                    <input className="input" type="url" value={placeForm.tiktokUrl || ''} onChange={e => setField('tiktokUrl', e.target.value)} placeholder="https://tiktok.com/@..." />
                  </div>
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldTelegram')}</label>
                    <input className="input" type="url" value={placeForm.telegramUrl || ''} onChange={e => setField('telegramUrl', e.target.value)} placeholder="https://t.me/..." />
                  </div>
                </div>
                <div className="va-onboarding__collections-title">{t('venueAdmin.sectionCollections')}</div>
                <div className="va-marks">
                  {COLLECTIONS.map(c => {
                    const checked = Array.isArray(placeForm.collections) && placeForm.collections.includes(c.slug)
                    return (
                      <label key={c.slug} className={`va-mark-check ${checked ? 'checked' : ''}`}>
                        <input type="checkbox" checked={checked} onChange={() => setField('collections', checked
                          ? placeForm.collections.filter(s => s !== c.slug)
                          : [...(placeForm.collections || []), c.slug])} />
                        <span className="va-mark-check__icon">{c.icon}</span>
                        <span>{t(`collectionsList.${c.slug}`)}</span>
                      </label>
                    )
                  })}
                </div>
              </>
            )}

            {onboardingStep === 4 && (
              <>
                <h1 className="va-onboarding__title">{t('venueAdmin.onboardingStep4Title')}</h1>
                <p className="va-onboarding__sub">{t('venueAdmin.onboardingStep4Sub')}</p>
                <div className="va-plans va-onboarding__plans">
                  {Object.keys(SUBSCRIPTION_TIERS).map(tierKey => {
                    const tierInfo = SUBSCRIPTION_TIERS[tierKey]
                    const isPopular = tierKey === 'standard'
                    return (
                      <div key={tierKey} className={`va-plan-card ${isPopular ? 'popular' : ''}`}>
                        {isPopular && <span className="va-plan-card__badge">{t('venueAdmin.popularBadge')}</span>}
                        <div className="va-plan-card__name">{t(`subscriptionTiers.${tierKey}`)}</div>
                        <div className="va-plan-card__price">
                          <span className="va-plan-card__price-amount">${tierInfo.price}</span>
                          <span className="va-plan-card__price-period">{t('venueAdmin.perMonth')}</span>
                        </div>
                        <ul className="va-plan-card__features">
                          <li><span className="va-plan-card__check">✓</span>{tierInfo.eventsPerMonth ? t('venueAdmin.eventsLimitText', tierInfo.eventsPerMonth) : t('venueAdmin.eventsUnlimitedText')}</li>
                          <li><span className="va-plan-card__check">✓</span>{t('venueAdmin.boostsLimitText', tierInfo.boostsPerMonth)}</li>
                        </ul>
                        <button type="button" className="btn btn-dark va-plan-card__btn" disabled={!!checkingOutTier} onClick={() => handleChoosePlan(tierKey)}>
                          {t('venueAdmin.choosePlanBtn')}
                        </button>
                      </div>
                    )
                  })}
                </div>
                {checkoutError && <p className="va-plans-notice va-plans-notice--error">{checkoutError}</p>}
              </>
            )}
          </div>

          <div className="va-onboarding__actions">
            <button type="button" className="va-onboarding__skip" onClick={handleOnboardingSkip}>
              {onboardingStep < ONBOARDING_STEPS ? t('venueAdmin.onboardingSkip') : t('venueAdmin.onboardingSkipToDashboard')}
            </button>
            {onboardingStep < ONBOARDING_STEPS && (
              <button type="button" className="btn btn-dark va-onboarding__next" onClick={handleOnboardingNext} disabled={onboardingSaving}>
                {onboardingSaving ? t('venueAdmin.onboardingSaving') : t('venueAdmin.onboardingNext')}
              </button>
            )}
          </div>
        </div>
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
              {t('venueAdmin.viewPage')}
            </Link>
            <button className="va-logout" onClick={handleLogout}>{t('venueAdmin.logout')}</button>
          </div>
        </div>
      </div>

      {/* Unpublished banner */}
      {!place.published && (
        <div className="va-unpublished-banner">
          <div className="container va-unpublished-banner__inner">
            <span className="va-unpublished-banner__dot" />
            <span>{t('venueAdmin.unpublishedBanner')}</span>
          </div>
        </div>
      )}

      <div className="container va-body">
        {/* Nav */}
        <div className="va-nav">
          <button className={`va-nav-item ${tab === 'place' ? 'active' : ''}`} onClick={() => setTab('place')}>
            {t('venueAdmin.tabVenue')}
          </button>
          <button className={`va-nav-item ${tab === 'boost' ? 'active' : ''}`} onClick={() => setTab('boost')}>
            {t('venueAdmin.tabBoost')}
          </button>
          <button className={`va-nav-item ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>
            {t('venueAdmin.tabEvents')}
            <span className="va-nav-item__count">{myEvents.length}</span>
          </button>
          <button className={`va-nav-item ${tab === 'account' ? 'active' : ''}`} onClick={() => setTab('account')}>
            {t('venueAdmin.tabAccount')}
          </button>
          <button className={`va-nav-item ${tab === 'subscription' ? 'active' : ''}`} onClick={() => setTab('subscription')}>
            {t('venueAdmin.tabSubscription')}
          </button>
        </div>

        <div className="va-content">
        {/* Tab: Boost */}
        {tab === 'boost' && (
          <>
            <div className="va-boost-card">
              <div className="va-boost-card__info">
                <div className="va-boost-card__title">🚀 {t('venueAdmin.sectionBoost')}</div>
                <p className="va-boost-card__hint">{t('venueAdmin.boostHint')}</p>
                {boostQuota && (
                  boostQuota.limit === 0 ? (
                    <p className="va-boost-card__locked">{t('venueAdmin.boostLocked')} — {t('venueAdmin.boostLockedHint')}</p>
                  ) : (
                    <p className="va-boost-card__quota">{t('venueAdmin.boostQuotaText', boostQuota.used, boostQuota.limit)}</p>
                  )
                )}
                {boostError && <p className="va-boost-card__error">{boostError}</p>}
              </div>
              <div className="va-boost-card__action">
                {boostQuota?.topUntil && boostQuota.topUntil > Date.now() ? (
                  <span className="va-boost-card__active">
                    {t('venueAdmin.boostActiveUntil', new Date(boostQuota.topUntil).toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-dark"
                    onClick={handleBoost}
                    disabled={boosting || !boostQuota || boostQuota.limit === 0 || boostQuota.remaining <= 0}
                  >
                    {t('venueAdmin.boostButton')}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tab: Place */}
        {tab === 'place' && (
          <>
            <div className="va-section">
            <div className="va-section__head">
              <h2>{t('venueAdmin.editVenueTitle')}</h2>
            </div>
            <form onSubmit={handleSavePlace}>

              {/* ── Group 1: Основна інформація ── */}
              <div className="va-form-section">
                <div className="va-form-section__title">{t('venueAdmin.sectionMain')}</div>
                <div className="va-form-grid">
                  <div className="va-field va-field--full">
                    <label className="va-label">{t('venueAdmin.fieldName')}</label>
                    <input className="input" required value={placeForm.name || ''}
                      onChange={e => setField('name', e.target.value)} />
                  </div>
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldType')}</label>
                    <select className="input" value={placeForm.type || 'restaurant'}
                      onChange={e => setField('type', e.target.value)}>
                      {Object.keys(PLACE_TYPES).map(k => <option key={k} value={k}>{t(`placeTypes.${k}`)}</option>)}
                    </select>
                    {placeForm.type === 'other' && (
                      <input className="input" style={{ marginTop: 6 }}
                        placeholder={t('venueAdmin.customTypePh')}
                        value={placeForm.customType || ''}
                        onChange={e => setField('customType', e.target.value)} />
                    )}
                  </div>
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldCity')}</label>
                    <select className="input" value={placeForm.city || ''}
                      onChange={e => setField('city', e.target.value)}>
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="va-field va-field--full">
                    <label className="va-label">{t('venueAdmin.fieldAddress')}</label>
                    <input className="input" required value={placeForm.address || ''}
                      onChange={e => setField('address', e.target.value)} />
                  </div>
                  <div className="va-field va-field--full">
                    <label className="va-label">{t('venueAdmin.fieldDescription')}</label>
                    <textarea className="input textarea" rows={4} required
                      value={placeForm.description || ''}
                      onChange={e => setField('description', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* ── Group 2: Контакти та деталі ── */}
              <div className="va-form-section">
                <div className="va-form-section__title">{t('venueAdmin.sectionContacts')}</div>
                <div className="va-form-grid">
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldPhone')}</label>
                    <input className="input" value={placeForm.phone || ''}
                      onChange={e => setField('phone', e.target.value)} placeholder={t('venueAdmin.phonePh')} />
                  </div>
                  {!isTicketType && (
                    <div className="va-field">
                      <label className="va-label">{t('venueAdmin.fieldCuisine')}</label>
                      <CuisineSelect value={placeForm.cuisine} onChange={v => setField('cuisine', v)} />
                    </div>
                  )}
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldWorkingHours')}</label>
                    <input className="input" value={placeForm.workingHours || ''}
                      onChange={e => setField('workingHours', e.target.value)}
                      placeholder={t('venueAdmin.workingHoursPh')} />
                  </div>
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldWebsite')}</label>
                    <input className="input" type="url" value={placeForm.website || ''}
                      onChange={e => setField('website', e.target.value)} placeholder="https://" />
                  </div>
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldMenuUrl')}</label>
                    <input className="input" type="url" value={placeForm.menuUrl || ''}
                      onChange={e => setField('menuUrl', e.target.value)} placeholder={t('venueAdmin.menuUrlPh')} />
                  </div>
                  <div className="va-field va-field--full">
                    <label className="va-label">{t('venueAdmin.fieldTags')}</label>
                    <input className="input" value={placeForm.tags || ''}
                      onChange={e => setField('tags', e.target.value)} placeholder={t('venueAdmin.tagsPh')} />
                  </div>
                </div>
              </div>

              {/* ── Group: Бронювання / Квитки ── */}
              {!isTicketType && (
                <div className="va-form-section">
                  <div className="va-form-section__title">{t('venueAdmin.sectionBooking')}</div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={!!placeForm.bookingEnabled}
                      onChange={e => setField('bookingEnabled', e.target.checked)}
                    />
                    <span className="toggle-switch__track" />
                    <span className="toggle-switch__label">{t('venueAdmin.bookingToggle')}</span>
                  </label>
                  {placeForm.bookingEnabled && (
                    <div className="va-field" style={{ marginTop: 14, maxWidth: 320 }}>
                      <label className="va-label">{t('venueAdmin.fieldBookingPhone')}</label>
                      <input className="input" type="tel" required={!!placeForm.bookingEnabled}
                        value={placeForm.bookingPhone || ''}
                        onChange={e => setField('bookingPhone', e.target.value)}
                        placeholder={t('venueAdmin.phonePh')} />
                    </div>
                  )}
                </div>
              )}
              {isTicketType && (
                <div className="va-form-section">
                  <div className="va-form-section__title">{t('venueAdmin.sectionTickets')}</div>
                  <div className="va-field" style={{ maxWidth: 400 }}>
                    <label className="va-label">{t('venueAdmin.fieldTicketsUrl')}</label>
                    <input className="input" type="url"
                      value={placeForm.ticketsUrl || ''}
                      onChange={e => setField('ticketsUrl', e.target.value)}
                      placeholder={t('venueAdmin.ticketsUrlPh')} />
                  </div>
                </div>
              )}

              {/* ── Group: Соціальні мережі ── */}
              <div className="va-form-section">
                <div className="va-form-section__title">{t('venueAdmin.sectionSocials')}</div>
                <div className="va-form-grid">
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldInstagram')}</label>
                    <input className="input" type="url" value={placeForm.instagramUrl || ''}
                      onChange={e => setField('instagramUrl', e.target.value)} placeholder="https://instagram.com/..." />
                  </div>
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldFacebook')}</label>
                    <input className="input" type="url" value={placeForm.facebookUrl || ''}
                      onChange={e => setField('facebookUrl', e.target.value)} placeholder="https://facebook.com/..." />
                  </div>
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldTiktok')}</label>
                    <input className="input" type="url" value={placeForm.tiktokUrl || ''}
                      onChange={e => setField('tiktokUrl', e.target.value)} placeholder="https://tiktok.com/@..." />
                  </div>
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldThreads')}</label>
                    <input className="input" type="url" value={placeForm.threadsUrl || ''}
                      onChange={e => setField('threadsUrl', e.target.value)} placeholder="https://threads.net/@..." />
                  </div>
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldTelegram')}</label>
                    <input className="input" type="url" value={placeForm.telegramUrl || ''}
                      onChange={e => setField('telegramUrl', e.target.value)} placeholder="https://t.me/..." />
                  </div>
                  <div className="va-field">
                    <label className="va-label">{t('venueAdmin.fieldYoutube')}</label>
                    <input className="input" type="url" value={placeForm.youtubeUrl || ''}
                      onChange={e => setField('youtubeUrl', e.target.value)} placeholder="https://youtube.com/@..." />
                  </div>
                </div>
              </div>

              {/* ── Group: Зручності ── */}
              <div className="va-form-section">
                <div className="va-form-section__title">{t('venueAdmin.sectionAmenities')}</div>
                <div className="va-amenities">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={!!placeForm.petsFriendly}
                      onChange={e => setField('petsFriendly', e.target.checked)}
                    />
                    <span className="toggle-switch__track" />
                    <span className="toggle-switch__label">{t('venueAdmin.petsFriendlyToggle')}</span>
                  </label>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={!!placeForm.kidsRoom}
                      onChange={e => setField('kidsRoom', e.target.checked)}
                    />
                    <span className="toggle-switch__track" />
                    <span className="toggle-switch__label">{t('venueAdmin.kidsRoomToggle')}</span>
                  </label>
                </div>
              </div>

              {/* ── Group: Підбірки ── */}
              <div className="va-form-section">
                <div className="va-form-section__title">{t('venueAdmin.sectionCollections')}</div>
                <p className="va-marks-hint">{t('venueAdmin.collectionsHint')}</p>
                <div className="va-marks">
                  {COLLECTIONS.map(c => {
                    const checked = Array.isArray(placeForm.collections) && placeForm.collections.includes(c.slug)
                    return (
                      <label key={c.slug} className={`va-mark-check ${checked ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setField('collections', checked
                            ? placeForm.collections.filter(s => s !== c.slug)
                            : [...(placeForm.collections || []), c.slug]
                          )}
                        />
                        <span className="va-mark-check__icon">{c.icon}</span>
                        <span>{t(`collectionsList.${c.slug}`)}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* ── Group 3: Фотографії ── */}
              <div className="va-form-section">
                <div className="va-form-section__title">{t('venueAdmin.sectionPhotos')}</div>
                <div className="va-photos-list">
                  {(placeForm.photos || ['']).map((ph, i) => (
                    <div key={i} className="va-photo-row">
                      <div className="va-photo-row__num">{i + 1}</div>
                      <div className="va-photo-row__input">
                        <PhotoInput
                          value={ph}
                          onChange={v => setPhoto(i, v)}
                          placeholder={t('venueAdmin.photoUrlPh')}
                        />
                      </div>
                      {i === 0 ? (
                        <span className="va-photo-main-badge">{t('venueAdmin.mainPhoto')}</span>
                      ) : (
                        <button type="button" className="va-photo-set-main"
                          onClick={() => setMainPhoto(i)}
                          title={t('venueAdmin.setMainTitle')}>
                          {t('venueAdmin.setMainPhoto')}
                        </button>
                      )}
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
                    {t('venueAdmin.addPhoto')}
                  </button>
                </div>
              </div>

              <div className="va-form-footer">
                <button type="submit" className="btn btn-dark">{t('venueAdmin.saveChanges')}</button>
              </div>
            </form>
            </div>
          </>
        )}

        {/* Tab: Events */}
        {tab === 'events' && (
          <div className="va-section">
            <div className="va-section__head">
              <h2>{t('venueAdmin.myEventsTitle')}</h2>
              {hasActiveSub && (
                <button className="btn btn-dark btn-sm" onClick={() => setEventModal({})}>
                  {t('venueAdmin.newEvent')}
                </button>
              )}
            </div>

            {!hasActiveSub && (
              <div className="va-sub-required">
                <p className="va-sub-required__title">{t('venueAdmin.subRequiredTitle')}</p>
                <p className="va-sub-required__text">{t('venueAdmin.subRequiredText')}</p>
                <button className="btn btn-dark" onClick={() => setTab('subscription')}>
                  {t('venueAdmin.subRequiredBtn')}
                </button>
              </div>
            )}

            {myEvents.length === 0 && hasActiveSub && (
              <div className="va-empty">
                <p>{t('venueAdmin.noEventsText')}</p>
              </div>
            )}

            {myEvents.length > 0 && (
              <div className="va-table-wrap">
                <table className="va-table">
                  <thead>
                    <tr>
                      <th>{t('venueAdmin.thTitle')}</th>
                      <th>{t('venueAdmin.thType')}</th>
                      <th>{t('venueAdmin.thDate')}</th>
                      <th>{t('venueAdmin.thTime')}</th>
                      <th>{t('venueAdmin.thPrice')}</th>
                      <th>{t('venueAdmin.thActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myEvents.map(ev => (
                      <tr key={ev.id}>
                        <td className="va-table__main">{ev.title}</td>
                        <td>
                          <span className={`badge badge-event-${ev.type}`}>
                            {getEventTypeLabel(ev, t)}
                          </span>
                        </td>
                        <td>{ev.date}</td>
                        <td>{ev.time}</td>
                        <td>{ev.price === 0 ? <span className="va-free">{t('common.free')}</span> : `${ev.price} ${t('common.currency')}`}</td>
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

        {/* Tab: Account */}
        {tab === 'account' && (
          <div className="va-section">
            <div className="va-section__head">
              <h2>{t('venueAdmin.accountTitle')}</h2>
            </div>

            <div className="va-subtabs">
              <button className={`va-subtab ${accountTab === 'login' ? 'active' : ''}`} onClick={() => setAccountTab('login')}>
                {t('venueAdmin.subTabLogin')}
              </button>
              <button className={`va-subtab ${accountTab === 'password' ? 'active' : ''}`} onClick={() => setAccountTab('password')}>
                {t('venueAdmin.subTabPassword')}
              </button>
            </div>

            {accountTab === 'login' && (
              <form onSubmit={handleSaveLogin}>
                <div className="va-form-section">
                  <p className="va-marks-hint">{t('venueAdmin.loginHint')}</p>
                  <div className="va-form-grid">
                    <div className="va-field">
                      <label className="va-label">{t('venueAdmin.fieldCurrentPassword')}</label>
                      <input className="input" type="password" required
                        value={loginForm.currentPassword}
                        onChange={e => setLoginField('currentPassword', e.target.value)} />
                    </div>
                    <div className="va-field">
                      <label className="va-label">{t('venueAdmin.fieldNewUsername')}</label>
                      <input className="input" required value={loginForm.username}
                        onChange={e => setLoginField('username', e.target.value)} />
                    </div>
                  </div>
                  {loginError && <p className="va-account-error">{loginError}</p>}
                </div>
                <div className="va-form-footer">
                  <button type="submit" className="btn btn-dark" disabled={loginSaving}>
                    {t('venueAdmin.saveAccount')}
                  </button>
                </div>
              </form>
            )}

            {accountTab === 'password' && (
              <form onSubmit={handleSavePassword}>
                <div className="va-form-section">
                  <p className="va-marks-hint">{t('venueAdmin.passwordHint')}</p>
                  <div className="va-form-grid">
                    <div className="va-field">
                      <label className="va-label">{t('venueAdmin.fieldCurrentPassword')}</label>
                      <input className="input" type="password" required
                        value={passwordForm.currentPassword}
                        onChange={e => setPasswordField('currentPassword', e.target.value)} />
                    </div>
                    <div />
                    <div className="va-field">
                      <label className="va-label">{t('venueAdmin.fieldNewPassword')}</label>
                      <input className="input" type="password" required value={passwordForm.newPassword}
                        onChange={e => setPasswordField('newPassword', e.target.value)}
                        placeholder={t('venueAdmin.newPasswordPh')} />
                    </div>
                    <div className="va-field">
                      <label className="va-label">{t('venueAdmin.fieldConfirmPassword')}</label>
                      <input className="input" type="password" required value={passwordForm.confirmPassword}
                        onChange={e => setPasswordField('confirmPassword', e.target.value)} />
                    </div>
                  </div>
                  {passwordError && <p className="va-account-error">{passwordError}</p>}
                </div>
                <div className="va-form-footer">
                  <button type="submit" className="btn btn-dark" disabled={passwordSaving}>
                    {t('venueAdmin.saveAccount')}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab: Subscription */}
        {tab === 'subscription' && (
          <div className="va-section">
            <div className="va-section__head">
              <h2>{t('venueAdmin.subscriptionTitle')}</h2>
            </div>
            <div style={{ padding: '20px 28px 0' }}>
              <p className="va-plans-sub">{t('venueAdmin.subscriptionSub')}</p>
              {hasActiveSub && currentUser?.subscriptionRenewsAt && (
                <p className="va-plans-renewal">
                  {t('venueAdmin.subscriptionActiveUntil', new Date(currentUser.subscriptionRenewsAt).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }))}
                  {' · '}
                  {t('venueAdmin.nextChargeOn', new Date(currentUser.subscriptionRenewsAt).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }))}
                </p>
              )}
            </div>
            <div className="va-plans">
              {Object.keys(SUBSCRIPTION_TIERS).map(tierKey => {
                const tierInfo = SUBSCRIPTION_TIERS[tierKey]
                const isCurrent = hasActiveSub && currentUser?.subscriptionTier === tierKey
                const isPopular = tierKey === 'standard'
                return (
                  <div key={tierKey} className={`va-plan-card ${isCurrent ? 'current' : ''} ${isPopular ? 'popular' : ''}`}>
                    {isPopular && <span className="va-plan-card__badge">{t('venueAdmin.popularBadge')}</span>}
                    {isCurrent && !isPopular && <span className="va-plan-card__badge va-plan-card__badge--current">{t('venueAdmin.currentPlanBadge')}</span>}
                    <div className="va-plan-card__name">{t(`subscriptionTiers.${tierKey}`)}</div>
                    <div className="va-plan-card__price">
                      <span className="va-plan-card__price-amount">${tierInfo.price}</span>
                      <span className="va-plan-card__price-period">{t('venueAdmin.perMonth')}</span>
                    </div>
                    <ul className="va-plan-card__features">
                      <li>
                        <span className="va-plan-card__check">✓</span>
                        {tierInfo.eventsPerMonth ? t('venueAdmin.eventsLimitText', tierInfo.eventsPerMonth) : t('venueAdmin.eventsUnlimitedText')}
                      </li>
                      <li>
                        <span className="va-plan-card__check">✓</span>
                        {t('venueAdmin.boostsLimitText', tierInfo.boostsPerMonth)}
                      </li>
                    </ul>
                    <button
                      type="button"
                      className={`btn ${isCurrent ? 'btn-outline' : 'btn-dark'} va-plan-card__btn`}
                      disabled={isCurrent || !!checkingOutTier}
                      onClick={() => handleChoosePlan(tierKey)}
                    >
                      {isCurrent ? t('venueAdmin.currentPlanBtn') : t('venueAdmin.choosePlanBtn')}
                    </button>
                  </div>
                )
              })}
            </div>
            {checkoutError && <p className="va-plans-notice va-plans-notice--error">{checkoutError}</p>}
            {hasActiveSub && (
              <div style={{ padding: '0 28px 28px' }}>
                <button type="button" className="btn btn-outline" disabled={cancelling} onClick={handleCancelPlan}>
                  {cancelling ? t('venueAdmin.cancelPlanLoading') : t('venueAdmin.cancelPlanBtn')}
                </button>
                {cancelError && <p className="va-plans-notice va-plans-notice--error">{cancelError}</p>}
              </div>
            )}
          </div>
        )}
        </div>
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
          {wasFirstPublish ? t('venueAdmin.publishedToast') : t('venueAdmin.savedToast')}
        </div>
      )}

      {accountSaved && (
        <div className="va-toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          {t('venueAdmin.accountSaved')}
        </div>
      )}

      {deleteConfirm && (
        <div className="va-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="va-modal va-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="va-modal__head">
              <h2>{t('venueAdmin.deleteEventTitle')}</h2>
              <button className="va-modal__close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', fontSize: 14, color: 'var(--text-2)' }}>
              {t('venueAdmin.deleteEventText', deleteConfirm.title)}
            </div>
            <div className="va-modal__foot">
              <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</button>
              <button className="btn btn-danger" onClick={handleDeleteEvent}>{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
