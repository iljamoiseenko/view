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
