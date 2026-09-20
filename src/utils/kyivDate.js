// The whole app's notion of "today" follows the venue's own timezone
// (Europe/Kyiv), not the visitor's browser or the server's clock.
// `new Date().toISOString()` alone returns UTC, which lags Kyiv by 2-3h
// (DST-dependent) right after local midnight — Intl's timeZone option
// handles the UTC+2/+3 switch automatically, no manual offset math needed.
export function kyivDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(date)
}
