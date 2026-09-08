const express = require('express')
const db = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')

const router = express.Router()

function parseCuratedList(row) {
  return {
    id: row.id,
    title: row.title,
    authorName: row.author_name,
    authorRole: row.author_role || '',
    authorAvatar: row.author_avatar || '',
    coverImage: row.cover_image || '',
    icon: row.icon || '',
    placeIds: JSON.parse(row.place_ids || '[]'),
    sortOrder: row.sort_order ?? 0,
    active: row.active === 1,
  }
}

// GET /api/curated-lists — public
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM curated_lists ORDER BY sort_order ASC, id ASC').all()
  res.json(rows.map(parseCuratedList))
})

// POST /api/curated-lists — superadmin only
router.post('/', requireAuth, requireRole('superadmin'), (req, res) => {
  const { title, authorName, authorRole, authorAvatar, coverImage, icon, placeIds, sortOrder } = req.body
  if (!title || !authorName) return res.status(400).json({ error: 'title and authorName required' })

  const id = 'cl' + Date.now()
  db.prepare(`
    INSERT INTO curated_lists (id, title, author_name, author_role, author_avatar, cover_image, icon, place_ids, sort_order, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id, title.trim(), authorName.trim(), authorRole || '', authorAvatar || '',
    coverImage || '', icon || '', JSON.stringify(placeIds ?? []), sortOrder ?? 0
  )

  const created = db.prepare('SELECT * FROM curated_lists WHERE id = ?').get(id)
  res.status(201).json(parseCuratedList(created))
})

// PUT /api/curated-lists/:id — superadmin only
router.put('/:id', requireAuth, requireRole('superadmin'), (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT id FROM curated_lists WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Curated list not found' })

  const { title, authorName, authorRole, authorAvatar, coverImage, icon, placeIds, sortOrder, active } = req.body
  db.prepare(`
    UPDATE curated_lists SET
      title          = COALESCE(?, title),
      author_name    = COALESCE(?, author_name),
      author_role    = COALESCE(?, author_role),
      author_avatar  = COALESCE(?, author_avatar),
      cover_image    = COALESCE(?, cover_image),
      icon           = COALESCE(?, icon),
      place_ids      = COALESCE(?, place_ids),
      sort_order     = COALESCE(?, sort_order),
      active         = COALESCE(?, active)
    WHERE id = ?
  `).run(
    title ?? null,
    authorName ?? null,
    authorRole ?? null,
    authorAvatar ?? null,
    coverImage ?? null,
    icon ?? null,
    placeIds !== undefined ? JSON.stringify(placeIds) : null,
    sortOrder ?? null,
    active !== undefined ? (active ? 1 : 0) : null,
    id
  )

  const updated = db.prepare('SELECT * FROM curated_lists WHERE id = ?').get(id)
  res.json(parseCuratedList(updated))
})

// DELETE /api/curated-lists/:id — superadmin only
router.delete('/:id', requireAuth, requireRole('superadmin'), (req, res) => {
  const result = db.prepare('DELETE FROM curated_lists WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'Curated list not found' })
  res.json({ ok: true })
})

module.exports = router
