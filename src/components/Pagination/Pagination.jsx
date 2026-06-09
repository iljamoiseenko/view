import './Pagination.css'

export default function Pagination({ total, page, perPage, onChange }) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null

  const from = (page - 1) * perPage + 1
  const to   = Math.min(page * perPage, total)

  // Build page numbers array with ellipsis
  const pages = []
  const delta = 2
  const left  = page - delta
  const right = page + delta

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= left && i <= right)) {
      pages.push(i)
    } else if (i === left - 1 || i === right + 1) {
      pages.push('...')
    }
  }

  return (
    <div className="pagination">
      <span className="pagination__info">{from}–{to} з {total}</span>

      <div className="pagination__controls">
        <button
          className="pagination__btn"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          aria-label="Попередня сторінка"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>

        {pages.map((p, i) =>
          p === '...'
            ? <span key={`dots-${i}`} className="pagination__dots">…</span>
            : (
              <button
                key={p}
                className={`pagination__btn pagination__num ${p === page ? 'active' : ''}`}
                onClick={() => onChange(p)}
              >
                {p}
              </button>
            )
        )}

        <button
          className="pagination__btn"
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Наступна сторінка"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
