import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import './SearchableSelect.css'

// A `<select>` replacement with a text filter — for option lists too long to
// scan (e.g. every venue in the app). The dropdown is portaled to <body> and
// positioned via the control's own bounding rect (not CSS position:absolute)
// so it isn't clipped by a scrolling/overflow:hidden modal body, which is
// exactly the context this was first built for (SuperAdminPage's forms).
export default function SearchableSelect({ options, value, onChange, placeholder = '', searchPlaceholder, noResultsText = '—', className = '' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [coords, setCoords] = useState(null)
  const controlRef = useRef(null)
  const panelRef = useRef(null)
  const inputRef = useRef(null)

  const selected = options.find(o => o.value === value)
  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options

  // Re-measure whenever the panel opens or its content height changes (the
  // filtered list growing/shrinking can flip which side has room to fit it).
  useLayoutEffect(() => {
    if (!open || !controlRef.current) return
    const rect = controlRef.current.getBoundingClientRect()
    const panelHeight = panelRef.current?.offsetHeight || 300
    const spaceBelow = window.innerHeight - rect.bottom
    const openAbove = spaceBelow < panelHeight + 12 && rect.top > panelHeight + 12
    setCoords({
      left: rect.left,
      width: rect.width,
      top: openAbove ? undefined : rect.bottom + 6,
      bottom: openAbove ? window.innerHeight - rect.top + 6 : undefined,
    })
  }, [open, filtered.length])

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (e) => {
      if (controlRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    // A scroll anywhere (the modal body, the page) can move the control out
    // from under a fixed-position panel — simplest correct fix is to close.
    const close = () => setOpen(false)
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setQuery('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  return (
    <>
      <button
        type="button"
        ref={controlRef}
        className={`sselect__control ${className}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className={`sselect__value ${!selected ? 'sselect__value--placeholder' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="sselect__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && coords && createPortal(
        <div
          ref={panelRef}
          className="sselect__panel"
          style={{ left: coords.left, width: coords.width, top: coords.top, bottom: coords.bottom }}
        >
          <input
            ref={inputRef}
            type="text"
            className="sselect__search"
            placeholder={searchPlaceholder || placeholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') setOpen(false)
              else if (e.key === 'Enter' && filtered.length > 0) { onChange(filtered[0].value); setOpen(false) }
            }}
          />
          <div className="sselect__options">
            {filtered.length === 0 ? (
              <div className="sselect__empty">{noResultsText}</div>
            ) : filtered.map(o => (
              <button
                type="button"
                key={o.value || '__empty__'}
                className={`sselect__option ${o.value === value ? 'active' : ''}`}
                onClick={() => { onChange(o.value); setOpen(false) }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
