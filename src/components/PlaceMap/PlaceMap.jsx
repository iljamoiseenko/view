import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './PlaceMap.css'

const markerIcon = L.divIcon({
  className: 'place-map__marker',
  html: '<span class="place-map__pin"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
})

export default function PlaceMap({ lat, lng, name, address }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || lat == null || lng == null) return

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 16,
      scrollWheelZoom: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    L.marker([lat, lng], { icon: markerIcon })
      .addTo(map)
      .bindPopup(name || address || '')

    return () => map.remove()
  }, [lat, lng, name, address])

  if (lat == null || lng == null) return null

  return (
    <div className="place-map">
      <div ref={containerRef} className="place-map__canvas" />
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
