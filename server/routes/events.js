const express = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

function parseEvent(row) {
  return { ...row, placeId: row.place_id, place_id: undefined, customType: row.custom_type, custom_type: undefined }
}

// GET /api/events  — optional ?placeId=
router.get('/', (req, res) => {
  const { placeId } = req.query
  const rows = placeId
    ? db.prepare('SELECT * FROM events WHERE place_id = ? ORDER BY date, time').all(placeId)
    : db.prepare('SELECT * FROM events ORDER BY date, time').all()
  res.json(rows.map(parseEvent))
})

// GET /api/events/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Event not found' })
  res.json(parseEvent(row))
})

// POST /api/events  — venue can only create for their own place
router.post('/', requireAuth, (req, res) => {
  const { placeId, title, description, date, time, type, price, image, customType } = req.body
  if (!placeId || !title || !date || !time || !type) {
    return res.status(400).json({ error: 'placeId, title, date, time, type required' })
  }

  const user = req.user
  if (user.role !== 'superadmin' && user.placeId !== placeId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const id = 'e' + Date.now()
  db.prepare(`
    INSERT INTO events (id, place_id, title, description, date, time, type, price, image, custom_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, placeId, title, description ?? '', date, time, type, Number(price) || 0, image ?? '', customType ?? null)

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

  const { title, description, date, time, type, price, image, customType } = req.body

  db.prepare(`
    UPDATE events SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      date = COALESCE(?, date),
      time = COALESCE(?, time),
      type = COALESCE(?, type),
      price = COALESCE(?, price),
      image = COALESCE(?, image),
      custom_type = COALESCE(?, custom_type)
    WHERE id = ?
  `).run(
    title ?? null, description ?? null, date ?? null,
    time ?? null, type ?? null,
    price !== undefined ? Number(price) : null,
    image ?? null, customType ?? null, req.params.id
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
