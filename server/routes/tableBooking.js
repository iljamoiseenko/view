const express = require('express')
const jwt = require('jsonwebtoken')
const db = require('../db')
const { requireAuth, JWT_SECRET } = require('../middleware/auth')
const { expireIfPastDue } = require('../subscriptionTiers')
const { notifyOwnerOfBooking, notifyGuestOfBooking, createLinkToken } = require('../telegram')
const { kyivDateString, kyivMinutesNow } = require('../kyivDate')

function isPastSlot(date, time) {
  if (date !== kyivDateString()) return date < kyivDateString()
  const [h, m] = String(time || '0:0').split(':').map(Number)
  return (h || 0) * 60 + (m || 0) < kyivMinutesNow()
}

// The public booking endpoint accepts a booking with or without being logged
// in — if a valid guest-account token is attached, we link the booking to
// that account; anything else (no token, expired, or a venue/superadmin
// token) just books anonymously like before. Never throws.
function getOptionalGuestUserId(req) {
  const header = req.headers['authorization']
  if (!header?.startsWith('Bearer ')) return null
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET)
    return payload.role === 'user' ? payload.id : null
  } catch {
    return null
  }
}

const router = express.Router()

// TEMP: table booking is free-to-test for now — flip back to true to require
// an active subscription again (also revert the matching flag in
// src/pages/VenueAdmin/VenueAdminPage.jsx).
const BOOKING_REQUIRES_SUBSCRIPTION = false

// ── Abuse protection for the public "create booking" endpoint ──────────────
// No login is required to book a table, so nothing stops a script (or a
// bored prankster) from grabbing every slot at a venue. Three cheap,
// dependency-free layers, stacked:
//  1. a honeypot field real guests never see or fill in
//  2. a per-IP sliding-window rate limit (in-memory — fine for one process;
//     resets on deploy, which is an acceptable trade-off for this scale)
//  3. a cap on how many still-upcoming bookings one phone number can hold
// None of this is bulletproof against a determined attacker with many phone
// numbers and proxies — that needs SMS/email verification, a bigger lift —
// but it stops casual spam/pranks, which is the realistic threat here.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const RATE_LIMIT_MAX = 5 // booking attempts per IP per window
const MAX_ACTIVE_BOOKINGS_PER_PHONE = 5 // upcoming confirmed bookings, any venue

// Keep in sync with BOOKING_OCCASIONS in src/data/initialData.js
const BOOKING_OCCASIONS = ['birthday', 'friends', 'date', 'family', 'business', 'celebration', 'other']
function cleanOccasion(occasion) {
  return BOOKING_OCCASIONS.includes(occasion) ? occasion : null
}

const bookingAttemptsByIp = new Map() // ip -> timestamps[]

function isRateLimited(ip) {
  const now = Date.now()
  const hits = (bookingAttemptsByIp.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  hits.push(now)
  bookingAttemptsByIp.set(ip, hits)
  return hits.length > RATE_LIMIT_MAX
}

// Forget IPs that have been quiet for a while so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now()
  for (const [ip, hits] of bookingAttemptsByIp) {
    const fresh = hits.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
    if (fresh.length === 0) bookingAttemptsByIp.delete(ip)
    else bookingAttemptsByIp.set(ip, fresh)
  }
}, RATE_LIMIT_WINDOW_MS).unref()

// A believable phone number has a handful of digits — this isn't validating
// a real number, just rejecting empty-ish garbage like "111" or "asdf".
function looksLikePhone(phone) {
  return (String(phone).match(/\d/g) || []).length >= 7
}

function parseFloor(row) {
  return {
    id: row.id,
    placeId: row.place_id,
    name: row.name,
    sortOrder: row.sort_order,
    width: row.width,
    height: row.height,
    background: row.background,
    updatedAt: row.updated_at,
    tableCount: row.table_count ?? undefined,
  }
}

function parseObject(row) {
  return {
    id: row.id,
    kind: row.kind,
    shape: row.shape,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    label: row.label,
    seats: row.seats,
    isBookable: row.is_bookable === 1,
    sortOrder: row.sort_order,
    availableFrom: row.available_from || '10:00',
    availableTo: row.available_to || '23:00',
    slotMinutes: row.slot_minutes || 90,
    color: row.color || null,
  }
}

function parseBooking(row) {
  return {
    id: row.id,
    placeId: row.place_id,
    tableId: row.table_id,
    date: row.date,
    time: row.time,
    durationMinutes: row.duration_minutes || 90,
    guestName: row.guest_name,
    guestPhone: row.guest_phone,
    partySize: row.party_size,
    note: row.note,
    occasion: row.occasion || null,
    status: row.status,
    source: row.source || 'online',
    userId: row.user_id || null,
    createdAt: row.created_at,
  }
}

// "HH:MM" -> minutes since midnight
function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

// Shared by both the guest-facing and staff-facing "create booking" routes:
// looks up the table, checks the requested time falls inside its bookable
// hours, and checks it doesn't overlap an existing confirmed booking. Throws
// an Error with `.code` (mirrors the API's error strings) and `.status` on
// any failure; returns the table row + resolved duration on success.
function findTableAndCheckSlot(placeId, tableId, date, time) {
  const table = db.prepare(`
    SELECT o.* FROM table_objects o
    JOIN table_layouts l ON l.id = o.layout_id
    WHERE o.id = ? AND l.place_id = ?
  `).get(tableId, placeId)
  if (!table) {
    const err = new Error('Table not found')
    err.code = 'TABLE_NOT_FOUND'
    err.status = 404
    throw err
  }
  if (!table.is_bookable) {
    const err = new Error('This table is not bookable')
    err.code = 'NOT_BOOKABLE'
    err.status = 400
    throw err
  }

  const duration = table.slot_minutes || 90
  const startMin = toMinutes(time)
  const endMin = startMin + duration
  const openMin = toMinutes(table.available_from || '10:00')
  const closeMin = toMinutes(table.available_to || '23:00')
  if (startMin < openMin || endMin > closeMin) {
    const err = new Error('Time outside bookable hours')
    err.code = 'TIME_OUTSIDE_HOURS'
    err.status = 400
    throw err
  }

  // Synchronous check-then-insert: better-sqlite3 runs everything in this
  // request on the same JS thread with no `await` in between, so there's no
  // window for a second request to sneak a conflicting booking in between.
  const existing = db.prepare(`
    SELECT time, duration_minutes FROM table_bookings
    WHERE table_id = ? AND date = ? AND status = 'confirmed'
  `).all(tableId, date)
  const conflict = existing.some(b => {
    const bStart = toMinutes(b.time)
    const bEnd = bStart + (b.duration_minutes || 90)
    return startMin < bEnd && endMin > bStart
  })
  if (conflict) {
    const err = new Error('Table already booked for that slot')
    err.code = 'TABLE_ALREADY_BOOKED'
    err.status = 409
    throw err
  }

  return { table, duration }
}

// A venue account may only touch its own place; superadmin may touch any.
function assertOwnerOrSuperadmin(req, res, placeId) {
  const user = req.user
  if (user.role !== 'superadmin' && user.placeId !== placeId) {
    res.status(403).json({ error: 'Forbidden' })
    return false
  }
  return true
}

function requireActiveSubIfVenue(req, res) {
  if (!BOOKING_REQUIRES_SUBSCRIPTION || req.user.role !== 'venue') return true
  expireIfPastDue(db, req.user.id)
  const owner = db.prepare('SELECT subscription_status FROM users WHERE id = ?').get(req.user.id)
  if (owner?.subscription_status !== 'active') {
    res.status(403).json({ error: 'SUBSCRIPTION_REQUIRED' })
    return false
  }
  return true
}

// GET /api/table-booking/:placeId/floors — public, lightweight list for floor tabs
router.get('/:placeId/floors', (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, (SELECT COUNT(*) FROM table_objects o WHERE o.layout_id = l.id AND o.kind = 'table') AS table_count
    FROM table_layouts l WHERE l.place_id = ? ORDER BY l.sort_order ASC, l.updated_at ASC
  `).all(req.params.placeId)
  res.json(rows.map(parseFloor))
})

// POST /api/table-booking/:placeId/floors — venue owner or superadmin: add a new floor/terrace
router.post('/:placeId/floors', requireAuth, (req, res) => {
  const { placeId } = req.params
  if (!assertOwnerOrSuperadmin(req, res, placeId)) return
  if (!requireActiveSubIfVenue(req, res)) return

  const place = db.prepare('SELECT id FROM places WHERE id = ?').get(placeId)
  if (!place) return res.status(404).json({ error: 'Place not found' })

  const name = (req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'name is required' })

  const maxSort = db.prepare('SELECT MAX(sort_order) AS m FROM table_layouts WHERE place_id = ?').get(placeId)
  const id = 'lay' + Date.now() + Math.random().toString(36).slice(2, 7)
  const now = Date.now()
  db.prepare(`
    INSERT INTO table_layouts (id, place_id, name, sort_order, width, height, background, updated_at)
    VALUES (?, ?, ?, ?, 900, 650, '#F7F7F7', ?)
  `).run(id, placeId, name, (maxSort?.m ?? -1) + 1, now)

  const created = db.prepare('SELECT * FROM table_layouts WHERE id = ?').get(id)
  res.status(201).json(parseFloor(created))
})

// GET /api/table-booking/floor/:layoutId — public (guest booking page + venue editor both read this)
router.get('/floor/:layoutId', (req, res) => {
  const layout = db.prepare('SELECT * FROM table_layouts WHERE id = ?').get(req.params.layoutId)
  if (!layout) return res.status(404).json({ error: 'Floor not found' })
  const objects = db.prepare('SELECT * FROM table_objects WHERE layout_id = ? ORDER BY sort_order ASC, rowid ASC').all(layout.id)
  res.json({ layout: parseFloor(layout), objects: objects.map(parseObject) })
})

// PUT /api/table-booking/floor/:layoutId — venue owner (active subscription) or superadmin
router.put('/floor/:layoutId', requireAuth, (req, res) => {
  const { layoutId } = req.params
  const existingFloor = db.prepare('SELECT * FROM table_layouts WHERE id = ?').get(layoutId)
  if (!existingFloor) return res.status(404).json({ error: 'Floor not found' })
  if (!assertOwnerOrSuperadmin(req, res, existingFloor.place_id)) return
  if (!requireActiveSubIfVenue(req, res)) return

  const { name, width, height, background, objects } = req.body
  if (!Array.isArray(objects)) return res.status(400).json({ error: 'objects must be an array' })

  const today = kyivDateString()

  const run = db.transaction(() => {
    db.prepare('UPDATE table_layouts SET name = ?, width = ?, height = ?, background = ?, updated_at = ? WHERE id = ?')
      .run((name || existingFloor.name).trim(), width || 1000, height || 650, background || '#F7F7F7', Date.now(), layoutId)

    const existingRows = db.prepare('SELECT id, label FROM table_objects WHERE layout_id = ?').all(layoutId)
    const existingIds = existingRows.map(r => r.id)
    const incomingIds = new Set(objects.filter(o => o.id && !String(o.id).startsWith('new:')).map(o => o.id))
    const removedIds = existingIds.filter(id => !incomingIds.has(id))

    // A table with a future active booking can't just vanish from under a
    // guest — block the whole save and tell the owner which table(s) first.
    if (removedIds.length > 0) {
      const placeholders = removedIds.map(() => '?').join(',')
      const blocking = db.prepare(`
        SELECT DISTINCT table_id FROM table_bookings
        WHERE table_id IN (${placeholders}) AND date >= ? AND status = 'confirmed'
      `).all(...removedIds, today)
      if (blocking.length > 0) {
        const blockedIds = new Set(blocking.map(b => b.table_id))
        const err = new Error('TABLE_HAS_BOOKINGS')
        err.code = 'TABLE_HAS_BOOKINGS'
        err.labels = existingRows.filter(r => blockedIds.has(r.id)).map(r => r.label || r.id)
        throw err
      }
      db.prepare(`DELETE FROM table_objects WHERE id IN (${placeholders})`).run(...removedIds)
    }

    let sortOrder = 0
    for (const o of objects) {
      const isNew = !o.id || String(o.id).startsWith('new:')
      const width_ = Math.max(20, Math.round(Number(o.width)) || 60)
      const height_ = Math.max(20, Math.round(Number(o.height)) || 60)
      const x_ = Math.round(Number(o.x)) || 0
      const y_ = Math.round(Number(o.y)) || 0
      const kind = o.kind === 'label' ? 'label' : 'table'
      const shape = o.shape === 'rect' ? 'rect' : 'round'
      const seats = kind === 'table' ? (Number(o.seats) || null) : null
      const isBookable = kind === 'table' ? (o.isBookable !== false ? 1 : 0) : 0
      const label = o.label ?? null
      const availableFrom = /^\d{2}:\d{2}$/.test(o.availableFrom) ? o.availableFrom : '10:00'
      const availableTo = /^\d{2}:\d{2}$/.test(o.availableTo) ? o.availableTo : '23:00'
      const slotMinutes = Math.max(15, Math.min(480, Number(o.slotMinutes) || 90))
      const color = /^#[0-9a-fA-F]{3,8}$/.test(o.color || '') ? o.color : null

      if (isNew) {
        const id = 'tbl' + Date.now() + Math.random().toString(36).slice(2, 7)
        db.prepare(`
          INSERT INTO table_objects (id, layout_id, kind, shape, x, y, width, height, label, seats, is_bookable, sort_order, available_from, available_to, slot_minutes, color)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, layoutId, kind, shape, x_, y_, width_, height_, label, seats, isBookable, sortOrder, availableFrom, availableTo, slotMinutes, color)
      } else {
        db.prepare(`
          UPDATE table_objects SET kind=?, shape=?, x=?, y=?, width=?, height=?, label=?, seats=?, is_bookable=?, sort_order=?, available_from=?, available_to=?, slot_minutes=?, color=?
          WHERE id = ? AND layout_id = ?
        `).run(kind, shape, x_, y_, width_, height_, label, seats, isBookable, sortOrder, availableFrom, availableTo, slotMinutes, color, o.id, layoutId)
      }
      sortOrder++
    }
  })

  try {
    run()
  } catch (err) {
    if (err.code === 'TABLE_HAS_BOOKINGS') {
      return res.status(409).json({ error: 'TABLE_HAS_BOOKINGS', tables: err.labels })
    }
    throw err
  }

  const savedLayout = db.prepare('SELECT * FROM table_layouts WHERE id = ?').get(layoutId)
  const savedObjects = db.prepare('SELECT * FROM table_objects WHERE layout_id = ? ORDER BY sort_order ASC').all(layoutId)
  res.json({ layout: parseFloor(savedLayout), objects: savedObjects.map(parseObject) })
})

// PUT /api/table-booking/:placeId/tables/hours — venue owner or superadmin: apply the same
// accepting-hours window and per-table reservation length to every table on every floor at
// once, instead of tuning each table individually in the layout editor's properties panel.
router.put('/:placeId/tables/hours', requireAuth, (req, res) => {
  const { placeId } = req.params
  if (!assertOwnerOrSuperadmin(req, res, placeId)) return
  if (!requireActiveSubIfVenue(req, res)) return

  const { availableFrom, availableTo, slotMinutes } = req.body
  if (!/^\d{2}:\d{2}$/.test(availableFrom) || !/^\d{2}:\d{2}$/.test(availableTo)) {
    return res.status(400).json({ error: 'INVALID_HOURS' })
  }
  if (toMinutes(availableFrom) >= toMinutes(availableTo)) {
    return res.status(400).json({ error: 'INVALID_HOURS_RANGE' })
  }
  const slot = Math.max(15, Math.min(480, Number(slotMinutes) || 90))

  const result = db.prepare(`
    UPDATE table_objects SET available_from = ?, available_to = ?, slot_minutes = ?
    WHERE kind = 'table' AND layout_id IN (SELECT id FROM table_layouts WHERE place_id = ?)
  `).run(availableFrom, availableTo, slot, placeId)

  res.json({ updated: result.changes, availableFrom, availableTo, slotMinutes: slot })
})

// DELETE /api/table-booking/floor/:layoutId — venue owner or superadmin: remove a whole floor
router.delete('/floor/:layoutId', requireAuth, (req, res) => {
  const { layoutId } = req.params
  const floor = db.prepare('SELECT * FROM table_layouts WHERE id = ?').get(layoutId)
  if (!floor) return res.status(404).json({ error: 'Floor not found' })
  if (!assertOwnerOrSuperadmin(req, res, floor.place_id)) return

  const today = kyivDateString()
  const blocking = db.prepare(`
    SELECT DISTINCT o.label FROM table_objects o
    JOIN table_bookings b ON b.table_id = o.id
    WHERE o.layout_id = ? AND b.date >= ? AND b.status = 'confirmed'
  `).all(layoutId, today)
  if (blocking.length > 0) {
    return res.status(409).json({ error: 'TABLE_HAS_BOOKINGS', tables: blocking.map(b => b.label) })
  }

  db.prepare('DELETE FROM table_layouts WHERE id = ?').run(layoutId)
  res.json({ ok: true })
})

// GET /api/table-booking/:placeId/availability?date=YYYY-MM-DD — public, no guest
// details, just the booked time ranges (across all floors) so the client can
// compute free slots per table.
router.get('/:placeId/availability', (req, res) => {
  const { date } = req.query
  if (!date) return res.status(400).json({ error: 'date is required' })
  const rows = db.prepare(`
    SELECT table_id, time, duration_minutes FROM table_bookings
    WHERE place_id = ? AND date = ? AND status = 'confirmed'
  `).all(req.params.placeId, date)
  res.json({
    bookings: rows.map(r => ({ tableId: r.table_id, time: r.time, durationMinutes: r.duration_minutes || 90 })),
  })
})

// POST /api/table-booking/:placeId/bookings — public (guest reservation, no account needed)
router.post('/:placeId/bookings', (req, res) => {
  const { placeId } = req.params
  const { tableId, date, time, guestName, guestPhone, partySize, occasion, note, website } = req.body

  const place = db.prepare('SELECT table_booking_paused FROM places WHERE id = ?').get(placeId)
  if (place?.table_booking_paused) {
    return res.status(403).json({ error: 'BOOKINGS_PAUSED' })
  }

  // Honeypot: a real guest never sees or fills this field, a bot filling
  // every input on the form does. Respond as if it worked so a scripted
  // attacker gets no signal that anything was detected.
  if (website) {
    return res.status(201).json({ id: 'bk' + Date.now(), status: 'confirmed' })
  }

  if (!tableId || !date || !time || !guestName?.trim() || !guestPhone?.trim()) {
    return res.status(400).json({ error: 'tableId, date, time, guestName and guestPhone are required' })
  }
  if (!looksLikePhone(guestPhone)) {
    return res.status(400).json({ error: 'INVALID_PHONE' })
  }
  const today = kyivDateString()
  if (isPastSlot(date, time)) return res.status(400).json({ error: 'Date is in the past' })

  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'RATE_LIMITED' })
  }

  const activeForPhone = db.prepare(`
    SELECT COUNT(*) AS c FROM table_bookings
    WHERE guest_phone = ? AND date >= ? AND status = 'confirmed'
  `).get(guestPhone.trim(), today)
  if ((activeForPhone?.c || 0) >= MAX_ACTIVE_BOOKINGS_PER_PHONE) {
    return res.status(429).json({ error: 'PHONE_BOOKING_LIMIT' })
  }

  let duration, table
  try {
    ;({ duration, table } = findTableAndCheckSlot(placeId, tableId, date, time))
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.code })
    throw err
  }

  const id = 'bk' + Date.now() + Math.random().toString(36).slice(2, 7)
  const userId = getOptionalGuestUserId(req)
  const cleanedOccasion = cleanOccasion(occasion)
  // If this guest already linked Telegram on a previous booking, carry that
  // chat_id straight over — otherwise every single booking would need its
  // own "Connect Telegram" click, and owner-confirm alerts silently never
  // reach anyone who skips that step on booking #2 onward.
  const existingChatId = userId
    ? db.prepare('SELECT telegram_chat_id FROM users WHERE id = ?').get(userId)?.telegram_chat_id
    : null
  db.prepare(`
    INSERT INTO table_bookings (id, place_id, table_id, date, time, duration_minutes, guest_name, guest_phone, party_size, occasion, note, status, source, user_id, telegram_chat_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'online', ?, ?, ?)
  `).run(
    id, placeId, tableId, date, time, duration, guestName.trim(), guestPhone.trim(),
    Number(partySize) || 2, cleanedOccasion, note || null, userId, existingChatId || null, Date.now()
  )

  const created = db.prepare('SELECT * FROM table_bookings WHERE id = ?').get(id)
  notifyOwnerOfBooking(placeId, {
    id, date, time, partySize: Number(partySize) || 2, tableLabel: table.label,
    guestName: guestName.trim(), guestPhone: guestPhone.trim(), occasion: cleanedOccasion, note,
  })
  if (existingChatId) {
    const place = db.prepare('SELECT name FROM places WHERE id = ?').get(placeId)
    notifyGuestOfBooking(existingChatId, {
      date, time, partySize: Number(partySize) || 2, tableLabel: table.label,
    }, place?.name || '')
  }
  res.status(201).json({
    ...parseBooking(created),
    telegramLink: existingChatId ? null : createLinkToken('booking', id),
    telegramAlreadyLinked: !!existingChatId,
  })
})

// GET /api/table-booking/my/bookings — the logged-in guest's own bookings,
// across every venue, newest date first. Must come before "/:placeId/..." so
// Express doesn't swallow "my" as a placeId.
router.get('/my/bookings', requireAuth, (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ error: 'Forbidden' })
  const rows = db.prepare(`
    SELECT b.*, p.name AS place_name, p.city AS place_city, o.label AS table_label
    FROM table_bookings b
    JOIN places p ON p.id = b.place_id
    LEFT JOIN table_objects o ON o.id = b.table_id
    WHERE b.user_id = ? AND b.status = 'confirmed'
    ORDER BY b.date DESC, b.time DESC
  `).all(req.user.id)
  res.json(rows.map(r => ({
    ...parseBooking(r),
    placeName: r.place_name,
    placeCity: r.place_city,
    tableLabel: r.table_label || null,
  })))
})

// POST /api/table-booking/:placeId/bookings/manual — venue owner/superadmin only.
// For the "someone called and asked for a table" case — same slot checks as
// the guest form, but authenticated, so none of the public endpoint's
// anti-abuse limits (rate limit, phone cap, honeypot) apply here.
router.post('/:placeId/bookings/manual', requireAuth, (req, res) => {
  const { placeId } = req.params
  if (!assertOwnerOrSuperadmin(req, res, placeId)) return

  const { tableId, date, time, guestName, guestPhone, partySize, occasion, note } = req.body
  // Staff entering a booking they took over the phone don't always get (or
  // bother asking for) a name or number — unlike the public form, neither is
  // required here, but if a phone IS given it still has to look like one.
  if (!tableId || !date || !time) {
    return res.status(400).json({ error: 'tableId, date and time are required' })
  }
  if (guestPhone?.trim() && !looksLikePhone(guestPhone)) {
    return res.status(400).json({ error: 'INVALID_PHONE' })
  }
  if (isPastSlot(date, time)) return res.status(400).json({ error: 'Date is in the past' })

  let duration, table
  try {
    ;({ duration, table } = findTableAndCheckSlot(placeId, tableId, date, time))
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.code })
    throw err
  }

  const id = 'bk' + Date.now() + Math.random().toString(36).slice(2, 7)
  const cleanedOccasion = cleanOccasion(occasion)
  const cleanedName = guestName?.trim() || ''
  const cleanedPhone = guestPhone?.trim() || ''
  db.prepare(`
    INSERT INTO table_bookings (id, place_id, table_id, date, time, duration_minutes, guest_name, guest_phone, party_size, occasion, note, status, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'phone', ?)
  `).run(
    id, placeId, tableId, date, time, duration, cleanedName, cleanedPhone,
    Number(partySize) || 2, cleanedOccasion, note || null, Date.now()
  )

  const created = db.prepare('SELECT * FROM table_bookings WHERE id = ?').get(id)
  notifyOwnerOfBooking(placeId, {
    id, date, time, partySize: Number(partySize) || 2, tableLabel: table.label,
    guestName: cleanedName, guestPhone: cleanedPhone, occasion: cleanedOccasion, note,
  })
  res.status(201).json(parseBooking(created))
})

// GET /api/table-booking/:placeId/bookings — venue owner/superadmin, full guest details (all floors)
router.get('/:placeId/bookings', requireAuth, (req, res) => {
  if (!assertOwnerOrSuperadmin(req, res, req.params.placeId)) return
  const rows = db.prepare(`
    SELECT * FROM table_bookings WHERE place_id = ? AND status = 'confirmed' ORDER BY date ASC, time ASC
  `).all(req.params.placeId)
  res.json(rows.map(parseBooking))
})

// DELETE /api/table-booking/bookings/:id — the venue owner/superadmin, or the
// guest account the booking belongs to, can cancel it.
router.delete('/bookings/:id', requireAuth, (req, res) => {
  const booking = db.prepare('SELECT * FROM table_bookings WHERE id = ?').get(req.params.id)
  if (!booking) return res.status(404).json({ error: 'Booking not found' })

  const isOwnBooking = req.user.role === 'user' && booking.user_id === req.user.id
  if (!isOwnBooking && !assertOwnerOrSuperadmin(req, res, booking.place_id)) return

  db.prepare("UPDATE table_bookings SET status = 'cancelled' WHERE id = ?").run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
