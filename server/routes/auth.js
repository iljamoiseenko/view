const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../db')
const { requireAuth, JWT_SECRET } = require('../middleware/auth')
const { sendNewUserNotification } = require('../mailer')

const router = express.Router()

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, placeId: user.place_id, name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  )
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    placeId: user.place_id,
    isActive: !!user.is_active,
  }
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim())
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Невірний email або пароль' })
  }
  if (!user.is_active) {
    return res.status(403).json({ error: 'Акаунт заблоковано' })
  }

  res.json({ token: makeToken(user), user: publicUser(user) })
})

// POST /api/auth/register
// Accepts optional `place` object to create venue + account atomically
router.post('/register', (req, res) => {
  const { email, password, name, place } = req.body
  if (!email || !password || !name) return res.status(400).json({ error: 'Email, password and name required' })
  if (password.length < 6) return res.status(400).json({ error: 'Пароль має бути мінімум 6 символів' })

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim())
  if (exists) return res.status(409).json({ error: 'Цей email вже зареєстровано' })

  const now = new Date().toISOString()
  const userId = 'u' + Date.now()
  const hash = bcrypt.hashSync(password, 10)

  let placeId = null
  let createdPlace = null

  const register = db.transaction(() => {
    if (place && place.name) {
      placeId = 'p' + Date.now()
      db.prepare(`
        INSERT INTO places (id, name, type, city, address, description, cuisine, phone, working_hours, website, photos, tags, rating)
        VALUES (?, ?, ?, ?, ?, '', '', '', '', '', '[]', '[]', NULL)
      `).run(placeId, place.name.trim(), place.type || 'restaurant', place.city || 'Харків', place.address || '')
      createdPlace = db.prepare('SELECT * FROM places WHERE id = ?').get(placeId)
    }

    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, name, place_id, is_active, created_at)
      VALUES (?, ?, ?, 'venue', ?, ?, 1, ?)
    `).run(userId, email.toLowerCase().trim(), hash, name.trim(), placeId, now)
  })

  register()

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)

  // Fire-and-forget — registration succeeds even if email fails
  sendNewUserNotification({
    userName: name.trim(),
    userEmail: email.toLowerCase().trim(),
    placeName: createdPlace?.name || null,
    city: place?.city || null,
  }).catch(err => console.error('[mailer] Failed to send notification:', err.message))

  res.status(201).json({
    token: makeToken(user),
    user: publicUser(user),
    place: createdPlace ? { ...createdPlace, photos: JSON.parse(createdPlace.photos), tags: JSON.parse(createdPlace.tags), workingHours: createdPlace.working_hours } : null,
  })
})

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ user: publicUser(user) })
})

module.exports = router
