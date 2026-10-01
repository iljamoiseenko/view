// Sentinel stored in an event's `time` field to mean "all day" — keeps the
// DB column a plain required TEXT without a schema change.
export const ALL_DAY_TIME = 'allday'

export function isAllDay(time) {
  return time === ALL_DAY_TIME
}

// Renders event.time for display — translated "All day" label, or the
// HH:MM portion of a normal time string.
export function formatEventTime(time, t) {
  if (isAllDay(time)) return t('common.allDay')
  return time ? time.slice(0, 5) : ''
}

// Renders the start–end time ("12:00–19:00") when the event has an explicit
// end time, otherwise falls back to the plain single-time/all-day label.
export function formatEventTimeRange(event, t) {
  if (isAllDay(event.time)) return t('common.allDay')
  const start = formatEventTime(event.time, t)
  if (!event.endTime) return start
  return `${start}–${event.endTime.slice(0, 5)}`
}

// The last calendar day an event is still active — its own date for a
// normal single-day event, or `endDate` once it's past its start date for a
// multi-day one ("триває 2-3 жовтня"). Falls back to `date` if `endDate`
// were ever earlier (the API rejects that on save, but display code can't
// assume every event in memory came through that check).
export function eventEndDate(event) {
  return event.endDate && event.endDate >= event.date ? event.endDate : event.date
}

// Formats the date for display — a single day ("3 жовтня"), or a range when
// the event spans multiple days ("2–3 жовтня", or "30 вер – 2 жовт" across a
// month boundary, using the short month name to keep the cross-month form
// compact).
export function formatEventDateRange(event, t) {
  const start = new Date(event.date)
  const startDay = `${start.getDate()} ${t('common.monthsFull')[start.getMonth()]}`
  const endDateStr = eventEndDate(event)
  if (endDateStr === event.date) return startDay

  const end = new Date(endDateStr)
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}–${end.getDate()} ${t('common.monthsFull')[start.getMonth()]}`
  }
  return `${start.getDate()} ${t('common.monthsShort')[start.getMonth()]} – ${end.getDate()} ${t('common.monthsFull')[end.getMonth()]}`
}

// Whether the event is running on a given day — its start date through
// `eventEndDate`, inclusive. Used for "is this happening today" checks,
// as opposed to isEventUpcoming's "hasn't ended yet" (any future day).
export function isEventActiveOn(event, dateStr) {
  return event.date <= dateStr && dateStr <= eventEndDate(event)
}

// "Still relevant" — the event hasn't fully finished yet. For a multi-day
// event this stays true through every day up to and including `endDate`,
// not just its start date, so it doesn't drop out of "upcoming" lists the
// moment its first day passes.
export function isEventUpcoming(event, todayStr) {
  return eventEndDate(event) >= todayStr
}

export function isEventPast(event, todayStr) {
  return eventEndDate(event) < todayStr
}

// For grouping events by day in a list — an event already in progress today
// groups under today's heading even if it started earlier, so it doesn't
// show up out of order under a date that's already passed; anything not
// currently active groups under its own actual start date.
export function eventDisplayDate(event, todayStr) {
  return isEventActiveOn(event, todayStr) ? todayStr : event.date
}
