// The whole app's notion of "today" follows the venue's own timezone
// (Europe/Kyiv), not the server's clock (Railway runs UTC). Plain
// `new Date().toISOString()` returns UTC, which lags Kyiv by 2-3h
// (DST-dependent) right after local midnight — Intl's timeZone option
// handles the UTC+2/+3 switch automatically, no manual offset math needed.
function kyivDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(date)
}

module.exports = { kyivDateString }
