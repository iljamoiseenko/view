const { APP_URL, toAbsoluteUrl } = require('./seo')

// Mirrors src/data/initialData.js's PLACE_TYPES keys — duplicated for the
// same reason as seoPages.js's COLLECTION_SLUGS (that file is an ES module
// the CommonJS server can't require). Falls back to the generic
// LocalBusiness/FoodEstablishment types below for anything not listed here,
// so an unmapped type still produces valid markup, just less specific.
const SCHEMA_TYPE_BY_PLACE_TYPE = {
  restaurant: 'Restaurant',
  cafe: 'CafeOrCoffeeShop',
  coffee: 'CafeOrCoffeeShop',
  bar: 'BarOrPub',
  pub: 'BarOrPub',
  lounge: 'BarOrPub',
  rooftop: 'BarOrPub',
  wine_bar: 'BarOrPub',
  cocktail_bar: 'BarOrPub',
  hookah: 'BarOrPub',
  fast_food: 'FastFoodRestaurant',
  food_court: 'FoodEstablishment',
  bakery: 'Bakery',
  dessert: 'Bakery',
}

// working_hours is a single free-text field covering every day (e.g.
// "13:00 - 22:00"), not a per-day schedule — only emit openingHours when it
// actually matches that simple shape, rather than guessing at anything else
// an admin might have typed in there.
function parseOpeningHours(workingHours) {
  const m = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(String(workingHours || '').trim())
  return m ? `Mo-Su ${m[1]}-${m[2]}` : null
}

function placeJsonLd(place) {
  const photos = JSON.parse(place.photos || '[]')
  const openingHours = parseOpeningHours(place.working_hours)

  return {
    '@context': 'https://schema.org',
    '@type': SCHEMA_TYPE_BY_PLACE_TYPE[place.type] || 'LocalBusiness',
    name: place.name,
    url: `${APP_URL}/place/${place.id}`,
    ...(photos.length > 0 && { image: photos.map(toAbsoluteUrl) }),
    ...(place.description && { description: place.description }),
    ...(place.phone && { telephone: place.phone }),
    ...(place.address && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: place.address,
        addressLocality: place.city,
        addressCountry: 'UA',
      },
    }),
    ...(place.lat != null && place.lng != null && {
      geo: { '@type': 'GeoCoordinates', latitude: place.lat, longitude: place.lng },
    }),
    ...(openingHours && { openingHours }),
    ...(place.cuisine && { servesCuisine: place.cuisine }),
  }
}

// `place` is the venue row if the event has one (for its address/name),
// null for a standalone event that only carries its own free-text address.
function eventJsonLd(event, place) {
  const isAllDay = event.time === 'allday'
  const startDate = isAllDay ? event.date : `${event.date}T${event.time}:00`
  const endDate = event.end_date
    ? (event.end_time && event.end_time !== 'allday' ? `${event.end_date}T${event.end_time}:00` : event.end_date)
    : null

  const location = place
    ? {
        '@type': 'Place',
        name: place.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: place.address,
          addressLocality: place.city,
          addressCountry: 'UA',
        },
      }
    : { '@type': 'Place', name: event.address || 'Україна' }

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    url: `${APP_URL}/event/${event.id}`,
    startDate,
    ...(endDate && { endDate }),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location,
    ...(event.image && { image: [toAbsoluteUrl(event.image)] }),
    ...(event.description && { description: event.description }),
    // A donation ("pay what you want") event has no fixed price to declare —
    // Offer requires one, so it's safer to omit it than to claim price: 0,
    // which would misleadingly show the event as free.
    ...(!event.is_donation && {
      offers: {
        '@type': 'Offer',
        price: String(event.price || 0),
        priceCurrency: 'UAH',
        availability: 'https://schema.org/InStock',
        url: `${APP_URL}/event/${event.id}`,
      },
    }),
  }
}

module.exports = { placeJsonLd, eventJsonLd }
