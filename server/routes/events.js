const express = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')
const { expireIfPastDue } = require('../subscriptionTiers')

const router = express.Router()

function parseEvent(row) {
  return {
    ...row,
    placeId: row.place_id, place_id: undefined,
    customType: row.custom_type, custom_type: undefined,
    registrationUrl: row.registration_url, registration_url: undefined,
    featuredOnHome: row.featured_on_home === 1, featured_on_home: undefined,
    views: row.views_count ?? 0, views_count: undefined,
  }
}

const WITH_VIEWS = `
  SELECT e.*, (SELECT COUNT(*) FROM event_views v WHERE v.event_id = e.id) AS views_count
  FROM events e
`

// GET /api/events  — optional ?placeId=
router.get('/', (req, res) => {
  const { placeId } = req.query
  const rows = placeId
    ? db.prepare(`${WITH_VIEWS} WHERE e.place_id = ? ORDER BY e.date, e.time`).all(placeId)
    : db.prepare(`${WITH_VIEWS} ORDER BY e.date, e.time`).all()
  res.json(rows.map(parseEvent))
})

// GET /api/events/:id
router.get('/:id', (req, res) => {
  const row = db.prepare(`${WITH_VIEWS} WHERE e.id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Event not found' })
  res.json(parseEvent(row))
})

// POST /api/events/:id/view  — public, logs one view of the event's detail page
router.post('/:id/view', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT id FROM events WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Event not found' })
  db.prepare('INSERT INTO event_views (event_id, viewed_at) VALUES (?, ?)').run(id, Date.now())
  res.json({ ok: true })
})

// POST /api/events  — venue can only create for their own place
router.post('/', requireAuth, (req, res) => {
  const { placeId, title, description, date, time, type, price, image, customType, registrationUrl, featuredOnHome } = req.body
  if (!placeId || !title || !date || !time || !type) {
    return res.status(400).json({ error: 'placeId, title, date, time, type required' })
  }

  const user = req.user
  if (user.role !== 'superadmin' && user.placeId !== placeId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  let spendEventCredit = false
  if (user.role === 'venue') {
    expireIfPastDue(db, user.id)
    const owner = db.prepare('SELECT subscription_status, event_credits FROM users WHERE id = ?').get(user.id)
    if (owner?.subscription_status !== 'active') {
      // No subscription — fall back to a one-time event-publish credit
      // bought via /subscriptions/checkout-event, if they have one.
      if (!owner?.event_credits) return res.status(403).json({ error: 'SUBSCRIPTION_REQUIRED' })
      spendEventCredit = true
    }
  }

  const id = 'e' + Date.now()
  db.prepare(`
    INSERT INTO events (id, place_id, title, description, date, time, type, price, image, custom_type, registration_url, featured_on_home)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, placeId, title, description ?? '', date, time, type, Number(price) || 0, image ?? '', customType ?? null, registrationUrl || null,
    // Only superadmin can pin an event to the homepage slider.
    user.role === 'superadmin' && featuredOnHome ? 1 : 0
  )

  if (spendEventCredit) {
    db.prepare('UPDATE users SET event_credits = event_credits - 1 WHERE id = ?').run(user.id)
  }

  const created = db.prepare('SELECT * FROM events WHERE id = ?').get(id)
  res.status(201).json(parseEvent(created))
})

// PUT /api/events/:id
router.put('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Event not found' })

  const user = req.user
  if (user.role !== 'superadmin' && user.placeId !== row.place_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { placeId, title, description, date, time, type, price, image, customType, registrationUrl, featuredOnHome } = req.body

  // Only superadmin may reassign an event to a different venue — a venue
  // owner's own placeId is fixed client-side anyway, but reject a mismatched
  // one here too rather than silently ignoring it.
  if (placeId && user.role !== 'superadmin' && placeId !== user.placeId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  db.prepare(`
    UPDATE events SET
      place_id = COALESCE(?, place_id),
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      date = COALESCE(?, date),
      time = COALESCE(?, time),
      type = COALESCE(?, type),
      price = COALESCE(?, price),
      image = COALESCE(?, image),
      custom_type = COALESCE(?, custom_type),
      registration_url = ?,
      featured_on_home = COALESCE(?, featured_on_home)
    WHERE id = ?
  `).run(
    placeId ?? null, title ?? null, description ?? null, date ?? null,
    time ?? null, type ?? null,
    price !== undefined ? Number(price) : null,
    image ?? null, customType ?? null, registrationUrl || null,
    // Only superadmin can change the homepage-slider pin.
    user.role === 'superadmin' && featuredOnHome !== undefined ? (featuredOnHome ? 1 : 0) : null,
    req.params.id
  )

  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id)
  res.json(parseEvent(updated))
})

// DELETE /api/events/:id
router.delete('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Event not found' })

  const user = req.user
  if (user.role !== 'superadmin' && user.placeId !== row.place_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router
