const pad = (n) => String(n).padStart(2, '0')

function toICSDate(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`
}

function escapeICS(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function buildEventTimes(dateStr, timeStr, durationHours = 2) {
  const start = new Date(`${dateStr}T${timeStr || '19:00'}:00`)
  const end = new Date(start.getTime() + durationHours * 3600000)
  return { start, end }
}

// Opens the generated .ics directly (no forced download) so mobile browsers
// hand it off to the device's native calendar app.
export function addToDeviceCalendar({ title, description, location, start, end }) {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//View//Event//UK',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@viewtoday.site`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escapeICS(title)}`,
    description ? `DESCRIPTION:${escapeICS(description)}` : '',
    location ? `LOCATION:${escapeICS(location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  window.location.href = url
  setTimeout(() => URL.revokeObjectURL(url), 15000)
}
