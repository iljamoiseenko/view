import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../api/client'
import './TableLayoutEditorPage.css'

const DEFAULT_LAYOUT = { name: '', width: 900, height: 650, background: '#F7F7F7' }

// Sizes are whole multiples of GRID_SIZE (below) so a freshly added object
// already lines up on the grid instead of sitting 3.5 squares wide.
const SIZE_BY_KIND = {
  table_round: { width: 80, height: 80 },
  table_rect: { width: 120, height: 80 },
  label: { width: 140, height: 60 },
}

// What the native color input shows while an object has no custom color set —
// matches the CSS defaults in TableLayoutEditorPage.css so the swatch doesn't
// lie about the object's actual current look.
const DEFAULT_COLOR_BY_KIND = { table: '#F7F7F7', label: '#DCE4F5' }

function newId() {
  return `new:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function nextTableNumber(objects) {
  const numbers = objects
    .filter(o => o.kind === 'table')
    .map(o => Number(/(\d+)\s*$/.exec(o.label ?? '')?.[1] ?? NaN))
    .filter(n => Number.isFinite(n))
  return (numbers.length > 0 ? Math.max(...numbers) : 0) + 1
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max)
}

// Matches the faint grid line spacing drawn on the canvas — Alt/Option while
// dragging or resizing temporarily turns snapping off for free placement.
const GRID_SIZE = 20

function snap(v, enabled) {
  return enabled ? Math.round(v / GRID_SIZE) * GRID_SIZE : v
}

export default function TableLayoutEditorPage() {
  const { currentUser } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const placeId = currentUser?.placeId

  const [floorsLoading, setFloorsLoading] = useState(true)
  const [floors, setFloors] = useState([])
  const [activeFloorId, setActiveFloorId] = useState(null)
  const [creatingFloor, setCreatingFloor] = useState(false)
  const [floorsError, setFloorsError] = useState('')

  const [loading, setLoading] = useState(false)
  const [layout, setLayout] = useState(DEFAULT_LAYOUT)
  const [objects, setObjects] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  const reloadFloors = useCallback((selectId) => {
    if (!placeId) return
    setFloorsLoading(true)
    return api.get(`/table-booking/${placeId}/floors`)
      .then(list => {
        setFloors(list)
        if (list.length === 0) {
          setActiveFloorId(null)
        } else if (selectId && list.some(f => f.id === selectId)) {
          setActiveFloorId(selectId)
        } else if (!list.some(f => f.id === activeFloorId)) {
          setActiveFloorId(list[0].id)
        }
        return list
      })
      .catch(() => {})
      .finally(() => setFloorsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId])

  useEffect(() => { reloadFloors() }, [reloadFloors])

  useEffect(() => {
    if (!activeFloorId) { setObjects([]); return }
    setLoading(true)
    api.get(`/table-booking/floor/${activeFloorId}`)
      .then(({ layout: l, objects: o }) => {
        setLayout({ name: l.name, width: l.width, height: l.height, background: l.background })
        setObjects(o || [])
        setSelectedId(null)
        setDirty(false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeFloorId])

  const selected = objects.find(o => o.id === selectedId) || null

  const markDirty = () => setDirty(true)

  const switchFloor = (id) => {
    if (id === activeFloorId) return
    if (dirty && !window.confirm(t('tableEditor.confirmLeave'))) return
    setActiveFloorId(id)
  }

  const [showAddFloor, setShowAddFloor] = useState(false)
  const [newFloorName, setNewFloorName] = useState('')

  const submitAddFloor = async (e) => {
    e.preventDefault()
    const name = newFloorName.trim()
    if (!name) return
    setCreatingFloor(true)
    setFloorsError('')
    try {
      const created = await api.post(`/table-booking/${placeId}/floors`, { name })
      await reloadFloors(created.id)
      setShowAddFloor(false)
      setNewFloorName('')
    } catch {
      setFloorsError(t('tableEditor.errorGeneric'))
    } finally {
      setCreatingFloor(false)
    }
  }

  const deleteFloor = async () => {
    const floor = floors.find(f => f.id === activeFloorId)
    if (!floor) return
    if (!window.confirm(t('tableEditor.deleteFloorConfirm', floor.name))) return
    try {
      const token = localStorage.getItem('view_token')
      const res = await fetch(`/api/table-booking/floor/${floor.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.error === 'TABLE_HAS_BOOKINGS') {
          setFloorsError(t('tableEditor.errorFloorHasBookings', (data.tables || []).join(', ')))
        } else {
          setFloorsError(t('tableEditor.errorGeneric'))
        }
        return
      }
      setDirty(false)
      await reloadFloors()
    } catch {
      setFloorsError(t('tableEditor.errorGeneric'))
    }
  }

  const addObject = (kindKey) => {
    const size = SIZE_BY_KIND[kindKey]
    const isLabel = kindKey === 'label'
    const shape = kindKey === 'table_round' ? 'round' : 'rect'
    const count = objects.length
    const offset = (count % 6) * GRID_SIZE * 2
    const obj = {
      id: newId(),
      kind: isLabel ? 'label' : 'table',
      shape,
      x: clamp(40 + offset, 0, Math.max(0, layout.width - size.width)),
      y: clamp(40 + offset, 0, Math.max(0, layout.height - size.height)),
      width: size.width,
      height: size.height,
      label: isLabel ? t('tableEditor.defaultZoneLabel') : t('tableEditor.defaultTableLabel', nextTableNumber(objects)),
      seats: isLabel ? null : 2,
      isBookable: !isLabel,
      availableFrom: '10:00',
      availableTo: '23:00',
      slotMinutes: 90,
      color: null,
    }
    setObjects(prev => [...prev, obj])
    setSelectedId(obj.id)
    markDirty()
  }

  const updateSelected = (patch) => {
    if (!selectedId) return
    setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, ...patch } : o))
    markDirty()
  }

  const deleteSelected = () => {
    if (!selectedId) return
    setObjects(prev => prev.filter(o => o.id !== selectedId))
    setSelectedId(null)
    markDirty()
  }

  const duplicateSelected = () => {
    if (!selected) return
    const clone = { ...selected, id: newId(), x: clamp(selected.x + GRID_SIZE * 2, 0, layout.width - selected.width), y: clamp(selected.y + GRID_SIZE * 2, 0, layout.height - selected.height) }
    if (clone.kind === 'table') clone.label = t('tableEditor.defaultTableLabel', nextTableNumber(objects))
    setObjects(prev => [...prev, clone])
    setSelectedId(clone.id)
    markDirty()
  }

  // Listeners are attached synchronously inside the mousedown handler itself
  // (not via a useEffect keyed on state) so the very first mousemove right
  // after pressing down is never missed while React schedules a re-render.
  const startInteraction = (mode, obj, e) => {
    e.stopPropagation()
    if (mode === 'move') setSelectedId(obj.id)
    const startX = e.clientX
    const startY = e.clientY
    const orig = { x: obj.x, y: obj.y, width: obj.width, height: obj.height }

    const onMove = (ev) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      const snapOn = !ev.altKey
      setObjects(prev => prev.map(o => {
        if (o.id !== obj.id) return o
        if (mode === 'move') {
          const maxX = Math.max(0, layout.width - o.width)
          const maxY = Math.max(0, layout.height - o.height)
          const x = clamp(snap(Math.round(orig.x + dx), snapOn), 0, maxX)
          const y = clamp(snap(Math.round(orig.y + dy), snapOn), 0, maxY)
          return { ...o, x, y }
        }
        if (mode === 'resize-br') {
          // Bottom-right handle — top-left corner stays put, size grows down/right,
          // capped at the room's own edges (not an arbitrary fixed size) so a wide
          // hall can still fit a wall-length "БАР"/"СЦЕНА" zone.
          const width = clamp(snap(Math.round(orig.width + dx), snapOn), GRID_SIZE, layout.width - orig.x)
          const height = clamp(snap(Math.round(orig.height + dy), snapOn), GRID_SIZE, layout.height - orig.y)
          return { ...o, width, height }
        }
        // resize-tl — bottom-right corner stays put, top-left corner is what you drag.
        const right = orig.x + orig.width
        const bottom = orig.y + orig.height
        const x = clamp(snap(Math.round(orig.x + dx), snapOn), 0, right - GRID_SIZE)
        const y = clamp(snap(Math.round(orig.y + dy), snapOn), 0, bottom - GRID_SIZE)
        return { ...o, x, y, width: right - x, height: bottom - y }
      }))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setDirty(true)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onObjectMouseDown = (e, obj) => startInteraction('move', obj, e)
  const onResizeBRMouseDown = (e, obj) => startInteraction('resize-br', obj, e)
  const onResizeTLMouseDown = (e, obj) => startInteraction('resize-tl', obj, e)

  const handleSave = useCallback(async () => {
    if (!activeFloorId) return
    setSaving(true)
    setSaveError('')
    try {
      const token = localStorage.getItem('view_token')
      const res = await fetch(`/api/table-booking/floor/${activeFloorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: layout.name, width: layout.width, height: layout.height, background: layout.background, objects }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.error === 'SUBSCRIPTION_REQUIRED') {
          setSaveError(t('tableEditor.errorSubRequired'))
        } else if (data.error === 'TABLE_HAS_BOOKINGS') {
          setSaveError(t('tableEditor.errorHasBookings', (data.tables || []).join(', ')))
          // The server rejected the delete, so the table still exists there —
          // resync local state instead of leaving it looking gone.
          const fresh = await api.get(`/table-booking/floor/${activeFloorId}`).catch(() => null)
          if (fresh?.layout) {
            setLayout({ name: fresh.layout.name, width: fresh.layout.width, height: fresh.layout.height, background: fresh.layout.background })
            setObjects(fresh.objects || [])
            setSelectedId(null)
            setDirty(false)
          }
        } else {
          setSaveError(t('tableEditor.errorGeneric'))
        }
        return
      }
      setLayout({ name: data.layout.name, width: data.layout.width, height: data.layout.height, background: data.layout.background })
      setObjects(data.objects)
      setSelectedId(null)
      setDirty(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
      reloadFloors(activeFloorId)
    } catch {
      setSaveError(t('tableEditor.errorGeneric'))
    } finally {
      setSaving(false)
    }
  }, [activeFloorId, layout, objects, t, reloadFloors])

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const goBack = () => {
    if (dirty && !window.confirm(t('tableEditor.confirmLeave'))) return
    navigate('/venue')
  }

  if (!placeId) return null
  if (floorsLoading) return <div className="container tle-loading">…</div>

  return (
    <div className="tle-page">
      <div className="container tle-head">
        <button type="button" className="tle-back" onClick={goBack}>{t('tableEditor.back')}</button>
        <h1 className="tle-title">{t('tableEditor.title')}</h1>
        <div className="tle-head__actions">
          {dirty && !saving && <span className="tle-unsaved">{t('tableEditor.unsavedHint')}</span>}
          {savedFlash && <span className="tle-saved">{t('tableEditor.saved')}</span>}
          {activeFloorId && (
            <button type="button" className="btn btn-dark" onClick={handleSave} disabled={saving}>
              {saving ? t('tableEditor.saving') : t('tableEditor.save')}
            </button>
          )}
        </div>
      </div>

      {(saveError || floorsError) && <div className="container"><p className="tle-error">{saveError || floorsError}</p></div>}

      <div className="container tle-mobile-notice">{t('tableEditor.mobileOnly')}</div>

      <div className="tle-desktop-only">
        {floors.length > 0 && (
          <div className="container tle-floors">
            {floors.map(f => (
              <button
                key={f.id}
                type="button"
                className={`tle-floor-tab ${f.id === activeFloorId ? 'active' : ''}`}
                onClick={() => switchFloor(f.id)}
              >
                {f.name}
              </button>
            ))}
            {showAddFloor ? (
              <form className="tle-floor-add-form" onSubmit={submitAddFloor}>
                <input
                  className="input"
                  autoFocus
                  placeholder={t('tableEditor.newFloorNamePh')}
                  value={newFloorName}
                  onChange={e => setNewFloorName(e.target.value)}
                />
                <button type="submit" className="btn btn-dark btn-sm" disabled={creatingFloor || !newFloorName.trim()}>
                  {creatingFloor ? t('tableEditor.creatingFloor') : t('common.add')}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setShowAddFloor(false); setNewFloorName('') }}>
                  {t('common.cancel')}
                </button>
              </form>
            ) : (
              <button type="button" className="tle-floor-add" onClick={() => setShowAddFloor(true)}>
                {t('tableEditor.addFloor')}
              </button>
            )}
            {activeFloorId && (
              <div className="tle-floors__actions">
                <button type="button" className="tle-icon-btn tle-danger" title={t('tableEditor.deleteFloor')} onClick={deleteFloor}>🗑</button>
              </div>
            )}
          </div>
        )}

        {floors.length === 0 ? (
          <div className="container">
            <div className="empty-state">
              <h3>{t('tableEditor.noFloorsTitle')}</h3>
              <p>{t('tableEditor.noFloorsText')}</p>
              {showAddFloor ? (
                <form className="tle-floor-add-form tle-floor-add-form--centered" onSubmit={submitAddFloor}>
                  <input
                    className="input"
                    autoFocus
                    placeholder={t('tableEditor.newFloorNamePh')}
                    value={newFloorName}
                    onChange={e => setNewFloorName(e.target.value)}
                  />
                  <button type="submit" className="btn btn-dark" disabled={creatingFloor || !newFloorName.trim()}>
                    {creatingFloor ? t('tableEditor.creatingFloor') : t('common.add')}
                  </button>
                </form>
              ) : (
                <button type="button" className="btn btn-dark" onClick={() => setShowAddFloor(true)}>
                  {t('tableEditor.createFirstFloor')}
                </button>
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="container tle-loading">…</div>
        ) : (
          <>
            <div className="container tle-toolbar">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => addObject('table_round')}>{t('tableEditor.addTableRound')}</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => addObject('table_rect')}>{t('tableEditor.addTableRect')}</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => addObject('label')}>{t('tableEditor.addLabel')}</button>
              <span className="tle-toolbar__snap-hint">{t('tableEditor.snapHint')}</span>
              <div className="tle-toolbar__size">
                <label>{t('tableEditor.floorNameLabel')}</label>
                <input type="text" className="tle-toolbar__name" value={layout.name} onChange={e => { setLayout(l => ({ ...l, name: e.target.value })); markDirty() }} />
                <label>{t('tableEditor.widthLabel')}</label>
                <input type="number" min="300" step="10" value={layout.width} onChange={e => { setLayout(l => ({ ...l, width: Number(e.target.value) || l.width })); markDirty() }} />
                <label>{t('tableEditor.heightLabel')}</label>
                <input type="number" min="300" step="10" value={layout.height} onChange={e => { setLayout(l => ({ ...l, height: Number(e.target.value) || l.height })); markDirty() }} />
              </div>
            </div>

            <div className="container tle-body">
              <div className="tle-canvas-wrap">
                <div
                  className="tle-canvas"
                  style={{ width: layout.width, height: layout.height, backgroundColor: layout.background }}
                  onMouseDown={() => setSelectedId(null)}
                >
                  {objects.length === 0 && <p className="tle-canvas__empty">{t('tableEditor.emptyHint')}</p>}
                  {objects.map(o => (
                    <div
                      key={o.id}
                      className={`tle-obj tle-obj--${o.kind} tle-obj--${o.shape} ${selectedId === o.id ? 'is-selected' : ''}`}
                      style={{ left: o.x, top: o.y, width: o.width, height: o.height, backgroundColor: o.color || undefined }}
                      onMouseDown={e => onObjectMouseDown(e, o)}
                    >
                      <span className="tle-obj__label">{o.label}</span>
                      {o.kind === 'table' && o.seats != null && <span className="tle-obj__seats">{o.seats}</span>}
                      {selectedId === o.id && (
                        <>
                          <span className="tle-obj__resize tle-obj__resize--tl" onMouseDown={e => onResizeTLMouseDown(e, o)} />
                          <span className="tle-obj__resize tle-obj__resize--br" onMouseDown={e => onResizeBRMouseDown(e, o)} />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="tle-props">
                {selected ? (
                  <>
                    <h3 className="tle-props__title">{t('tableEditor.propsTitle')}</h3>
                    <label className="tle-props__field">
                      <span>{t('tableEditor.propsLabel')}</span>
                      <input className="input" value={selected.label || ''} onChange={e => updateSelected({ label: e.target.value })} />
                    </label>
                    <label className="tle-props__field">
                      <span>{t('tableEditor.propsColor')}</span>
                      <div className="tle-props__color-row">
                        <input
                          type="color"
                          className="tle-props__color-input"
                          value={selected.color || DEFAULT_COLOR_BY_KIND[selected.kind]}
                          onChange={e => updateSelected({ color: e.target.value })}
                        />
                        {selected.color && (
                          <button type="button" className="tle-props__color-reset" onClick={() => updateSelected({ color: null })}>
                            {t('tableEditor.propsColorReset')}
                          </button>
                        )}
                      </div>
                    </label>
                    {selected.kind === 'table' && (
                      <>
                        <label className="tle-props__field">
                          <span>{t('tableEditor.propsSeats')}</span>
                          <input className="input" type="number" min="1" max="50" value={selected.seats || 1} onChange={e => updateSelected({ seats: Number(e.target.value) || 1 })} />
                        </label>
                        <label className="tle-props__field">
                          <span>{t('tableEditor.propsShape')}</span>
                          <select className="input" value={selected.shape} onChange={e => updateSelected({ shape: e.target.value })}>
                            <option value="round">{t('tableEditor.propsShapeRound')}</option>
                            <option value="rect">{t('tableEditor.propsShapeRect')}</option>
                          </select>
                        </label>
                        <label className="tle-props__checkbox">
                          <input type="checkbox" checked={selected.isBookable} onChange={e => updateSelected({ isBookable: e.target.checked })} />
                          <span>{t('tableEditor.propsBookable')}</span>
                        </label>
                        <div className="tle-props__field-row">
                          <label className="tle-props__field">
                            <span>{t('tableEditor.propsAvailableFrom')}</span>
                            <input className="input" type="time" value={selected.availableFrom || '10:00'} onChange={e => updateSelected({ availableFrom: e.target.value })} />
                          </label>
                          <label className="tle-props__field">
                            <span>{t('tableEditor.propsAvailableTo')}</span>
                            <input className="input" type="time" value={selected.availableTo || '23:00'} onChange={e => updateSelected({ availableTo: e.target.value })} />
                          </label>
                        </div>
                        <label className="tle-props__field">
                          <span>{t('tableEditor.propsSlotMinutes')}</span>
                          <select className="input" value={selected.slotMinutes || 90} onChange={e => updateSelected({ slotMinutes: Number(e.target.value) })}>
                            <option value={30}>30 {t('tableEditor.minutesShort')}</option>
                            <option value={60}>60 {t('tableEditor.minutesShort')}</option>
                            <option value={90}>90 {t('tableEditor.minutesShort')}</option>
                            <option value={120}>120 {t('tableEditor.minutesShort')}</option>
                            <option value={150}>150 {t('tableEditor.minutesShort')}</option>
                            <option value={180}>180 {t('tableEditor.minutesShort')}</option>
                          </select>
                        </label>
                      </>
                    )}
                    <div className="tle-props__actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={duplicateSelected}>{t('tableEditor.duplicate')}</button>
                      <button type="button" className="btn btn-outline btn-sm tle-danger" onClick={deleteSelected}>{t('tableEditor.delete')}</button>
                    </div>
                  </>
                ) : (
                  <p className="tle-props__hint">{t('tableEditor.selectHint')}</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
