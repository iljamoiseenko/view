import './PlaceMap.css'

export default function PlaceMap({ lat, lng, name, address }) {
  if (lat == null || lng == null) return null

  const label = encodeURIComponent(name || address || `${lat},${lng}`)

  return (
    <div className="place-map">
      <iframe
        className="place-map__canvas"
        title={name || 'Мапа'}
        src={`https://maps.google.com/maps?q=${lat},${lng}(${label})&z=16&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <a
        className="place-map__link"
        href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
        target="_blank"
        rel="noreferrer"
      >
        Прокласти маршрут
      </a>
    </div>
  )
}
