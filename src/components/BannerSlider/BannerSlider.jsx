import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import './BannerSlider.css'

export default function BannerSlider({ banners }) {
  const active = banners.filter(b => b.active)
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const navigate = useNavigate()
  const timerRef = useRef(null)

  const next = useCallback(() => setCurrent(c => (c + 1) % active.length), [active.length])
  const prev = useCallback(() => setCurrent(c => (c - 1 + active.length) % active.length), [active.length])

  useEffect(() => {
    if (active.length <= 1 || paused) return
    timerRef.current = setInterval(next, 5000)
    return () => clearInterval(timerRef.current)
  }, [active.length, paused, next])

  // Reset index when banners change
  useEffect(() => { setCurrent(0) }, [active.length])

  if (active.length === 0) return null

  const banner = active[current]

  return (
    <div
      className="bslider"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {active.map((b, i) => (
        <div
          key={b.id}
          className={`bslider__slide ${i === current ? 'active' : ''}`}
          style={b.image
            ? { backgroundImage: `url(${b.image})` }
            : { background: b.bgColor || '#1a1a1a' }
          }
          onClick={() => navigate(`/special/${b.linkSlug}`)}
          role="button"
          aria-label={b.title}
        >
          <div className="bslider__overlay" />
          <div className="bslider__content">
            {b.subtitle && <p className="bslider__subtitle">{b.subtitle}</p>}
            <h2 className="bslider__title">{b.title}</h2>
            <span className="bslider__cta">
              Дивитись
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </span>
          </div>
        </div>
      ))}

      {/* Arrows */}
      {active.length > 1 && (
        <>
          <button
            className="bslider__arrow bslider__arrow--prev"
            onClick={e => { e.stopPropagation(); prev() }}
            aria-label="Попередній"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <button
            className="bslider__arrow bslider__arrow--next"
            onClick={e => { e.stopPropagation(); next() }}
            aria-label="Наступний"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>

          {/* Dots */}
          <div className="bslider__dots">
            {active.map((_, i) => (
              <button
                key={i}
                className={`bslider__dot ${i === current ? 'active' : ''}`}
                onClick={e => { e.stopPropagation(); setCurrent(i) }}
                aria-label={`Слайд ${i + 1}`}
              />
            ))}
          </div>

          {/* Progress bar */}
          {!paused && (
            <div key={`${current}-${paused}`} className="bslider__progress" />
          )}
        </>
      )}
    </div>
  )
}
