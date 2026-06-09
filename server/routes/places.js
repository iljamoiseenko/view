const express = require('express')
const db = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')

const router = express.Router()

function parsePlace(row) {
  return {
    ...row,
    photos: JSON.parse(row.photos || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    marks: JSON.parse(row.marks || '[]'),
    workingHours: row.working_hours,
    working_hours: undefined,
    published: row.published === 1,
  }
}

// GET /api/places
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM places').all()
  res.json(rows.map(parsePlace))
})

// GET /api/places/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Place not found' })
  res.json(parsePlace(row))
})

// PUT /api/places/:id  — venue can only update their own place
router.put('/:id', requireAuth, (req, res) => {
  const { id } = req.params
  const user = req.user

  if (user.role !== 'superadmin' && user.placeId !== id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const existing = db.prepare('SELECT id FROM places WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Place not found' })

  const { name, type, city, address, description, cuisine, phone, workingHours, website, photos, tags, marks, rating } = req.body

  db.prepare(`
    UPDATE places SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      city = COALESCE(?, city),
      address = COALESCE(?, address),
      description = COALESCE(?, description),
      cuisine = COALESCE(?, cuisine),
      phone = COALESCE(?, phone),
      working_hours = COALESCE(?, working_hours),
      website = COALESCE(?, website),
      photos = COALESCE(?, photos),
      tags = COALESCE(?, tags),
      marks = COALESCE(?, marks),
      rating = COALESCE(?, rating),
      published = 1
    WHERE id = ?
  `).run(
    name ?? null, type ?? null, city ?? null, address ?? null,
    description ?? null, cuisine ?? null, phone ?? null,
    workingHours ?? null, website ?? null,
    photos !== undefined ? JSON.stringify(photos) : null,
    tags !== undefined ? JSON.stringify(tags) : null,
    marks !== undefined ? JSON.stringify(marks) : null,
    rating ?? null,
    id
  )

  const updated = db.prepare('SELECT * FROM places WHERE id = ?').get(id)
  res.json(parsePlace(updated))
})

// POST /api/places  — superadmin only
router.post('/', requireAuth, requireRole('superadmin'), (req, res) => {
  const { name, type, city, address, description, cuisine, phone, workingHours, website, photos, tags, marks, rating } = req.body
  if (!name || !type || !city || !address) return res.status(400).json({ error: 'name, type, city, address required' })

  const id = 'p' + Date.now()
  db.prepare(`
    INSERT INTO places (id, name, type, city, address, description, cuisine, phone, working_hours, website, photos, tags, marks, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, type, city, address, description ?? '', cuisine ?? '', phone ?? '', workingHours ?? '', website ?? '', JSON.stringify(photos ?? []), JSON.stringify(tags ?? []), JSON.stringify(marks ?? []), rating ?? null)

  const created = db.prepare('SELECT * FROM places WHERE id = ?').get(id)
  res.status(201).json(parsePlace(created))
})

// DELETE /api/places/:id  — superadmin only
router.delete('/:id', requireAuth, requireRole('superadmin'), (req, res) => {
  const result = db.prepare('DELETE FROM places WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'Place not found' })
  res.json({ ok: true })
})

module.exports = router
