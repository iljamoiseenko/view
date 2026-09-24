// The whole app's notion of "today" follows the venue's own timezone
// (Europe/Kyiv), not the visitor's browser or the server's clock.
// `new Date().toISOString()` alone returns UTC, which lags Kyiv by 2-3h
// (DST-dependent) right after local midnight — Intl's timeZone option
// handles the UTC+2/+3 switch automatically, no manual offset math needed.
export function kyivDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(date)
}

// Minutes since midnight, Kyiv time — used to filter out booking slots that
// have already started today (a browser in another timezone would otherwise
// hide/show the wrong slots).
export function kyivMinutesNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)
  const h = Number(parts.find(p => p.type === 'hour')?.value || 0)
  const m = Number(parts.find(p => p.type === 'minute')?.value || 0)
  return h * 60 + m
}
