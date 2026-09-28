import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { api } from '../../api/client'
import { unionOutline, zoneCentroid } from '../../utils/mergedZoneShape'
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

// Two rects "touch" if they overlap or their edges are within `tolerance` px
// of each other — a couple of px slack absorbs sub-pixel/rounding gaps from
// dragging, without also matching rects that are merely nearby.
function rectsTouch(a, b, tolerance = 3) {
  const aRight = a.x + a.width, aBottom = a.y + a.height
  const bRight = b.x + b.width, bBottom = b.y + b.height
  return !(aRight + tolerance < b.x || bRight + tolerance < a.x || aBottom + tolerance < b.y || bBottom + tolerance < a.y)
}

// An already-merged object has no single x/y/width/height footprint anymore —
// it's the union of its `parts`. Everything that needs "the rectangles this
// object actually occupies" (touch detection, the union outline) goes through
// this instead of reading x/y/width/height directly.
function objectRects(o) {
  return o.parts && o.parts.length > 1 ? o.parts : [{ x: o.x, y: o.y, width: o.width, height: o.height }]
}

function objectsTouch(a, b) {
  return objectRects(a).some(ra => objectRects(b).some(rb => rectsTouch(ra, rb)))
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
  const [searchParams] = useSearchParams()
  const isSuperadmin = currentUser?.role === 'superadmin'
  // A superadmin has no venue of their own — they instead target whichever
  // place they came here to demo/build a layout for, passed as ?placeId=
  // (see the "🪑 Демо" link in SuperAdminPage's places table).
  const placeId = isSuperadmin ? searchParams.get('placeId') : currentUser?.placeId

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
  // Offered after dragging/resizing a label/zone next to another one — lets
  // the user fuse two touching zones (e.g. an L-shaped bar) into one object.
  const [mergePrompt, setMergePrompt] = useState(null)

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
        setMergePrompt(null)
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
    setMergePrompt(null)
    markDirty()
  }

  const duplicateSelected = () => {
    if (!selected) return
    const x = clamp(selected.x + GRID_SIZE * 2, 0, layout.width - selected.width)
    const y = clamp(selected.y + GRID_SIZE * 2, 0, layout.height - selected.height)
    const clone = { ...selected, id: newId(), x, y }
    // Shift every part by the same amount the bounding box actually moved
    // (not just +GRID_SIZE*2) so a merged Г-shape keeps its exact form even
    // when clamped against the room's edge.
    if (selected.parts && selected.parts.length > 1) {
      const dx = x - selected.x, dy = y - selected.y
      clone.parts = selected.parts.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }))
    }
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
    setMergePrompt(null)
    const startX = e.clientX
    const startY = e.clientY
    const orig = { x: obj.x, y: obj.y, width: obj.width, height: obj.height }
    const origParts = obj.parts && obj.parts.length > 1 ? obj.parts : null
    // Tracks the object's own rect(s) as it's dragged/resized, so onUp can
    // check them against touching neighbors without waiting on React state
    // to flush. For a merged object this is its parts (shifted as one unit);
    // for a plain object it's just its own bounding rect.
    let latestRects = objectRects(obj)

    const onMove = (ev) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      const snapOn = !ev.altKey
      setObjects(prev => prev.map(o => {
        if (o.id !== obj.id) return o
        let next
        if (mode === 'move') {
          const maxX = Math.max(0, layout.width - o.width)
          const maxY = Math.max(0, layout.height - o.height)
          const x = clamp(snap(Math.round(orig.x + dx), snapOn), 0, maxX)
          const y = clamp(snap(Math.round(orig.y + dy), snapOn), 0, maxY)
          next = { ...o, x, y }
          // A merged object moves as a rigid whole — shift every part by the
          // exact amount the (clamped, snapped) bounding box moved.
          if (origParts) {
            const px = x - orig.x, py = y - orig.y
            next.parts = origParts.map(p => ({ ...p, x: p.x + px, y: p.y + py }))
          }
        } else if (mode === 'resize-br') {
          // Bottom-right handle — top-left corner stays put, size grows down/right,
          // capped at the room's own edges (not an arbitrary fixed size) so a wide
          // hall can still fit a wall-length "БАР"/"СЦЕНА" zone. Merged (multi-part)
          // objects don't expose resize handles, so this branch never runs for them.
          const width = clamp(snap(Math.round(orig.width + dx), snapOn), GRID_SIZE, layout.width - orig.x)
          const height = clamp(snap(Math.round(orig.height + dy), snapOn), GRID_SIZE, layout.height - orig.y)
          next = { ...o, width, height }
        } else {
          // resize-tl — bottom-right corner stays put, top-left corner is what you drag.
          const right = orig.x + orig.width
          const bottom = orig.y + orig.height
          const x = clamp(snap(Math.round(orig.x + dx), snapOn), 0, right - GRID_SIZE)
          const y = clamp(snap(Math.round(orig.y + dy), snapOn), 0, bottom - GRID_SIZE)
          next = { ...o, x, y, width: right - x, height: bottom - y }
        }
        latestRects = objectRects(next)
        return next
      }))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setDirty(true)
      // Only labels/zones (not tables) get the merge offer — touching tables
      // are a normal, intentional layout, not two halves of one object.
      if (obj.kind === 'label') {
        const candidate = objects.find(o => o.id !== obj.id && o.kind === 'label' && latestRects.some(r => objectRects(o).some(or => rectsTouch(r, or))))
        if (candidate) setMergePrompt({ aId: obj.id, bId: candidate.id })
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const mergePromptRects = mergePrompt
    ? (() => {
        const a = objects.find(o => o.id === mergePrompt.aId)
        const b = objects.find(o => o.id === mergePrompt.bId)
        return a && b ? { a, b } : null
      })()
    : null

  const confirmMerge = () => {
    if (!mergePromptRects) { setMergePrompt(null); return }
    const { a, b } = mergePromptRects
    // The merged shape's actual footprint is every rectangle either object
    // already occupied — re-merging an already-merged zone just grows this
    // list, so a Г can become a П/T without losing its earlier seam-erasing.
    const parts = [...objectRects(a), ...objectRects(b)]
    const x = Math.min(...parts.map(p => p.x))
    const y = Math.min(...parts.map(p => p.y))
    const right = Math.max(...parts.map(p => p.x + p.width))
    const bottom = Math.max(...parts.map(p => p.y + p.height))
    const merged = {
      ...a,
      id: newId(),
      x, y,
      width: right - x,
      height: bottom - y,
      parts,
      label: a.label === b.label ? a.label : [a.label, b.label].filter(Boolean).join(' '),
      color: a.color || b.color || null,
    }
    setObjects(prev => [...prev.filter(o => o.id !== a.id && o.id !== b.id), merged])
    setSelectedId(merged.id)
    setMergePrompt(null)
    markDirty()
  }

  const dismissMerge = () => setMergePrompt(null)

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
    navigate(isSuperadmin ? '/admin' : '/venue')
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
          <a href={`/book/${placeId}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
            {t('tableEditor.viewAsGuest')}
          </a>
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
                  {objects.map(o => {
                    const isMerged = o.parts && o.parts.length > 1
                    const centroid = isMerged ? zoneCentroid(o.parts) : null
                    const label = (
                      <span
                        className={`tle-obj__label ${isMerged ? 'tle-obj__label--merged' : o.width <= 40 ? 'tle-obj__label--narrow' : ''}`}
                        style={centroid ? { left: centroid.x - o.x, top: centroid.y - o.y } : undefined}
                      >
                        {o.label}
                      </span>
                    )
                    return (
                      <div
                        key={o.id}
                        className={`tle-obj tle-obj--${o.kind} tle-obj--${o.shape} ${isMerged ? 'is-merged' : ''} ${selectedId === o.id ? 'is-selected' : ''}`}
                        style={{ left: o.x, top: o.y, width: o.width, height: o.height, backgroundColor: isMerged ? undefined : o.color || undefined }}
                        onMouseDown={e => onObjectMouseDown(e, o)}
                      >
                        {isMerged && (
                          <svg className="tle-obj__outline" viewBox={`0 0 ${o.width} ${o.height}`} preserveAspectRatio="none">
                            {unionOutline(o.parts).map((loop, i) => (
                              <polygon key={i} points={loop.map(([px, py]) => `${px - o.x},${py - o.y}`).join(' ')} fill={o.color || '#DCE4F5'} />
                            ))}
                          </svg>
                        )}
                        {label}
                        {o.kind === 'table' && o.seats != null && <span className="tle-obj__seats">{o.seats}</span>}
                        {selectedId === o.id && !isMerged && (
                          <>
                            <span className="tle-obj__resize tle-obj__resize--tl" onMouseDown={e => onResizeTLMouseDown(e, o)} />
                            <span className="tle-obj__resize tle-obj__resize--br" onMouseDown={e => onResizeBRMouseDown(e, o)} />
                          </>
                        )}
                      </div>
                    )
                  })}
                  {mergePromptRects && (
                    <div
                      className="tle-merge-prompt"
                      style={{ left: Math.min(mergePromptRects.a.x, mergePromptRects.b.x) + (Math.max(mergePromptRects.a.x + mergePromptRects.a.width, mergePromptRects.b.x + mergePromptRects.b.width) - Math.min(mergePromptRects.a.x, mergePromptRects.b.x)) / 2, top: Math.min(mergePromptRects.a.y, mergePromptRects.b.y) }}
                      onMouseDown={e => e.stopPropagation()}
                    >
                      <span>{t('tableEditor.mergeHint')}</span>
                      <button type="button" className="btn btn-dark btn-sm" onClick={confirmMerge}>{t('tableEditor.mergeConfirm')}</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={dismissMerge}>{t('tableEditor.mergeCancel')}</button>
                    </div>
                  )}
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
