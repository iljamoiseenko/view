// Free geocoding via OpenStreetMap Nominatim — no API key required.
// Usage policy: https://operations.osmfoundation.org/policies/nominatim/ (max 1 req/sec, valid User-Agent)
const fetch = globalThis.fetch || require('node-fetch')

async function geocodeAddress(address, city) {
  if (!address) return null
  const query = [address, city, 'Ukraine'].filter(Boolean).join(', ')
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { 'User-Agent': 'ViewApp/1.0 (https://github.com/iljamoiseenko/view)' } })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.[0]) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch (err) {
    console.error('[geocode] failed:', err.message)
    return null
  }
}

module.exports = { geocodeAddress }
