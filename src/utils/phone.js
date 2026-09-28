// Ukrainian mobile numbers only: +380 followed by exactly 9 digits. People
// naturally type/paste their number in the local 10-digit form starting with
// 0 (e.g. "0501234567"), not as "+380501234567" — the input shows a "+38"
// prefix and lets them type that familiar 10-digit form directly, instead of
// asking them to remember to drop the leading 0.
// Kept in one place so the input mask and the client-side pre-check can't
// silently drift apart — server/routes/tableBooking.js has its own copy of
// isValidUaPhone (backend can't import frontend code) that must stay in sync.

export function digitsOnly(str) {
  return String(str || '').replace(/\D/g, '')
}

// Normalizes to the 10-digit local form — a leading 0 plus the 9-digit
// number — accepting a pasted "380..." international number too (its 0 gets
// restored). Digits already typed with a leading 0 pass through untouched.
export function ua10Digits(value) {
  let d = digitsOnly(value)
  if (d.startsWith('380')) d = '0' + d.slice(3)
  return d.slice(0, 10)
}

export function formatUaGroups(tenDigits) {
  const d = tenDigits || ''
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(' ')
}

export function toE164(tenDigits) {
  return tenDigits ? `+38${tenDigits}` : ''
}

export function isValidUaPhone(value) {
  return /^\+380\d{9}$/.test(String(value || ''))
}
