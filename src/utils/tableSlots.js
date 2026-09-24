// Shared slot-time math for table booking — used by the public booking page
// and the venue admin's "create booking manually" form, so both compute free
// slots the exact same way and can't silently drift apart.

export function toMinutes(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function toHHMM(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0')
  const m = (mins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

// All non-overlapping slot start times for a table on a given day, given the
// bookings that already exist for it that day. `minMinutes` drops any slot
// that starts before it — pass today's Kyiv time-of-day when the day being
// shown is today, so already-passed slots stop appearing as bookable.
export function computeFreeSlots(table, bookingsForTable, minMinutes = 0) {
  const step = table.slotMinutes || 90
  const open = toMinutes(table.availableFrom || '10:00')
  const close = toMinutes(table.availableTo || '23:00')
  const slots = []
  for (let t = open; t + step <= close; t += step) {
    if (t < minMinutes) continue
    const busy = bookingsForTable.some(b => {
      const bStart = toMinutes(b.time)
      const bEnd = bStart + (b.durationMinutes || step)
      return t < bEnd && (t + step) > bStart
    })
    if (!busy) slots.push(toHHMM(t))
  }
  return slots
}
