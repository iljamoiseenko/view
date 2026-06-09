const express = require('express')
const db = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')

const router = express.Router()

function parseBanner(row) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || '',
    image: row.image || '',
    linkSlug: row.link_slug,
    bgColor: row.bg_color || '#1a1a1a',
    sortOrder: row.sort_order ?? 0,
    active: row.active === 1,
  }
}

// GET /api/banners — public
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM banners ORDER BY sort_order ASC, id ASC').all()
  res.json(rows.map(parseBanner))
})

// POST /api/banners — superadmin only
router.post('/', requireAuth, requireRole('superadmin'), (req, res) => {
  const { title, subtitle, image, linkSlug, bgColor, sortOrder } = req.body
  if (!title || !linkSlug) return res.status(400).json({ error: 'title and linkSlug required' })

  const id = 'bn' + Date.now()
  db.prepare(`
    INSERT INTO banners (id, title, subtitle, image, link_slug, bg_color, sort_order, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, title.trim(), subtitle || '', image || '', linkSlug, bgColor || '#1a1a1a', sortOrder ?? 0)

  const created = db.prepare('SELECT * FROM banners WHERE id = ?').get(id)
  res.status(201).json(parseBanner(created))
})

// PUT /api/banners/:id — superadmin only
router.put('/:id', requireAuth, requireRole('superadmin'), (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT id FROM banners WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Banner not found' })

  const { title, subtitle, image, linkSlug, bgColor, sortOrder, active } = req.body
  db.prepare(`
    UPDATE banners SET
      title      = COALESCE(?, title),
      subtitle   = COALESCE(?, subtitle),
      image      = COALESCE(?, image),
      link_slug  = COALESCE(?, link_slug),
      bg_color   = COALESCE(?, bg_color),
      sort_order = COALESCE(?, sort_order),
      active     = COALESCE(?, active)
    WHERE id = ?
  `).run(
    title ?? null,
    subtitle ?? null,
    image ?? null,
    linkSlug ?? null,
    bgColor ?? null,
    sortOrder ?? null,
    active !== undefined ? (active ? 1 : 0) : null,
    id
  )

  const updated = db.prepare('SELECT * FROM banners WHERE id = ?').get(id)
  res.json(parseBanner(updated))
})

// DELETE /api/banners/:id — superadmin only
router.delete('/:id', requireAuth, requireRole('superadmin'), (req, res) => {
  const result = db.prepare('DELETE FROM banners WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'Banner not found' })
  res.json({ ok: true })
})

module.exports = router
