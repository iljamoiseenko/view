import { isAllDay } from './eventTime'

const pad = (n) => String(n).padStart(2, '0')

function toICSDate(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`
}

// Date-only (no time, no timezone conversion) — required by the ICS spec for
// all-day events. Uses local getters since `start`/`end` are built from local
// midnight below; UTC getters would shift the date in positive-offset zones.
function toICSDateOnly(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function escapeICS(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function buildEventTimes(dateStr, timeStr, durationHours = 2) {
  if (isAllDay(timeStr)) {
    const start = new Date(`${dateStr}T00:00:00`)
    // DTEND for an all-day ICS event is exclusive — the day after — so plain
    // calendar-component arithmetic (not +24h in ms) keeps this DST-safe.
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
    return { start, end, allDay: true }
  }
  const start = new Date(`${dateStr}T${timeStr || '19:00'}:00`)
  const end = new Date(start.getTime() + durationHours * 3600000)
  return { start, end, allDay: false }
}

// Opens the generated .ics directly (no forced download) so mobile browsers
// hand it off to the device's native calendar app.
export function addToDeviceCalendar({ title, description, location, start, end, allDay }) {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//View//Event//UK',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@viewtoday.site`,
    `DTSTAMP:${toICSDate(new Date())}`,
    allDay ? `DTSTART;VALUE=DATE:${toICSDateOnly(start)}` : `DTSTART:${toICSDate(start)}`,
    allDay ? `DTEND;VALUE=DATE:${toICSDateOnly(end)}` : `DTEND:${toICSDate(end)}`,
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
