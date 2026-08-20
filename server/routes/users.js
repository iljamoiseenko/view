const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { SUBSCRIPTION_TIERS } = require('../subscriptionTiers')

const router = express.Router()

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    name: u.name,
    placeId: u.place_id,
    isActive: !!u.is_active,
    createdAt: u.created_at,
    plainPass: u.plain_pass || null,
    avatarUrl: u.avatar_url || null,
    subscriptionTier: u.subscription_tier || 'basic',
    subscriptionStatus: u.subscription_status || 'inactive',
    subscriptionRenewsAt: u.subscription_renews_at || null,
  }
}

// GET /api/users  — superadmin only
router.get('/', requireAuth, requireRole('superadmin'), (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all()
  res.json(rows.map(publicUser))
})

// POST /api/users  — superadmin creates a venue account
router.post('/', requireAuth, requireRole('superadmin'), (req, res) => {
  const { username, password, name, placeId, subscriptionTier } = req.body
  if (!username || !password || !name) return res.status(400).json({ error: 'username, password, name required' })

  const clean = username.toLowerCase().trim()
  const exists = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(clean, clean)
  if (exists) return res.status(409).json({ error: 'Цей логін вже зайнятий' })

  const tier = Object.keys(SUBSCRIPTION_TIERS).includes(subscriptionTier) ? subscriptionTier : 'basic'
  const id = 'u' + Date.now()
  const hash = bcrypt.hashSync(password, 10)
  db.prepare(`
    INSERT INTO users (id, email, username, password_hash, plain_pass, role, name, place_id, is_active, created_at, subscription_tier)
    VALUES (?, ?, ?, ?, ?, 'venue', ?, ?, 1, ?, ?)
  `).run(id, clean, clean, hash, password, name.trim(), placeId || null, new Date().toISOString(), tier)

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  res.status(201).json(publicUser(user))
})

// PUT /api/users/:id  — superadmin or self
router.put('/:id', requireAuth, (req, res) => {
  const { id } = req.params
  const isSelf = req.user.id === id
  const isAdmin = req.user.role === 'superadmin'
  if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Forbidden' })

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  const { name, password, placeId, isActive, username, currentPassword, avatarUrl, subscriptionTier } = req.body

  // Self-service login/password changes must confirm the current password first
  if (isSelf && (username || password)) {
    if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(403).json({ error: 'Невірний поточний пароль' })
    }
  }

  if (avatarUrl !== undefined) {
    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl || null, id)
  }

  if (username) {
    const clean = username.toLowerCase().trim()
    if (clean !== user.username) {
      const exists = db.prepare('SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?').get(clean, clean, id)
      if (exists) return res.status(409).json({ error: 'Цей логін вже зайнятий' })
      db.prepare('UPDATE users SET username = ?, email = ? WHERE id = ?').run(clean, clean, id)
    }
  }

  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Password too short' })
    db.prepare('UPDATE users SET password_hash = ?, plain_pass = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), password, id)
  }
  if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), id)
  if (isAdmin && placeId !== undefined) db.prepare('UPDATE users SET place_id = ? WHERE id = ?').run(placeId || null, id)
  if (isAdmin && isActive !== undefined) db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id)
  if (isAdmin && subscriptionTier !== undefined) {
    if (!Object.keys(SUBSCRIPTION_TIERS).includes(subscriptionTier)) {
      return res.status(400).json({ error: 'Invalid subscription tier' })
    }
    db.prepare('UPDATE users SET subscription_tier = ? WHERE id = ?').run(subscriptionTier, id)
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  res.json(publicUser(updated))
})

// DELETE /api/users/:id  — superadmin only
router.delete('/:id', requireAuth, requireRole('superadmin'), (req, res) => {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'User not found' })
  res.json({ ok: true })
})

module.exports = router
