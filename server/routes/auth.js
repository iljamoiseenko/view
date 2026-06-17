const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../db')
const { requireAuth, JWT_SECRET } = require('../middleware/auth')
const crypto = require('crypto')
const { sendNewUserNotification, sendPasswordReset } = require('../mailer')

const router = express.Router()

// Ensure reset token columns exist (migration)
;(function migrate() {
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name)
  if (!cols.includes('reset_token')) {
    db.prepare('ALTER TABLE users ADD COLUMN reset_token TEXT').run()
    db.prepare('ALTER TABLE users ADD COLUMN reset_expires INTEGER').run()
    console.log('[db] Migration: added reset_token / reset_expires columns')
  }
})()

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
    username: user.username,
    role: user.role,
    name: user.name,
    placeId: user.place_id,
    isActive: !!user.is_active,
  }
}

// POST /api/auth/login  — accepts username or email
router.post('/login', (req, res) => {
  const { username, email, password } = req.body
  const login = (username || email || '').toLowerCase().trim()
  if (!login || !password) return res.status(400).json({ error: 'Логін і пароль обовʼязкові' })

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(login, login)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Невірний логін або пароль' })
  }
  if (!user.is_active) {
    return res.status(403).json({ error: 'Акаунт заблоковано' })
  }

  res.json({ token: makeToken(user), user: publicUser(user) })
})

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { username, password, name, place } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Логін і пароль обовʼязкові' })
  if (password.length < 6) return res.status(400).json({ error: 'Пароль має бути мінімум 6 символів' })

  const clean = username.toLowerCase().trim()
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(clean)
  if (exists) return res.status(409).json({ error: 'Цей логін вже зайнятий' })

  const now = new Date().toISOString()
  const userId = 'u' + Date.now()
  const hash = bcrypt.hashSync(password, 10)
  const displayName = name?.trim() || clean

  let placeId = null
  let createdPlace = null

  const register = db.transaction(() => {
    placeId = 'p' + Date.now()
    db.prepare(`
      INSERT INTO places (id, name, type, city, address, description, cuisine, phone, working_hours, website, photos, tags, rating)
      VALUES (?, ?, ?, ?, ?, '', '', '', '', '', '[]', '[]', NULL)
    `).run(placeId, 'Мій заклад', place?.type || 'restaurant', place?.city || 'Харків', '')
    createdPlace = db.prepare('SELECT * FROM places WHERE id = ?').get(placeId)

    db.prepare(`
      INSERT INTO users (id, email, username, password_hash, plain_pass, role, name, place_id, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 'venue', ?, ?, 1, ?)
    `).run(userId, clean, clean, hash, password, displayName, placeId, now)
  })

  register()

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)

  sendNewUserNotification({
    userName: displayName,
    userEmail: clean,
    placeName: 'Мій заклад',
    city: place?.city || 'Харків',
  }).catch(err => console.error('[mailer] Failed to send notification:', err.message))

  res.status(201).json({
    token: makeToken(user),
    user: publicUser(user),
    place: createdPlace ? { ...createdPlace, photos: JSON.parse(createdPlace.photos), tags: JSON.parse(createdPlace.tags), workingHours: createdPlace.working_hours } : null,
  })
})

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim())
  // Always respond with success to avoid email enumeration
  if (!user) return res.json({ ok: true })

  const token = crypto.randomBytes(32).toString('hex')
  const expires = Date.now() + 60 * 60 * 1000 // 1 hour

  db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?').run(token, expires, user.id)

  const baseUrl = process.env.APP_URL || 'https://viewtoday.site'
  const resetLink = `${baseUrl}/reset-password?token=${token}`

  try {
    await sendPasswordReset({ toEmail: user.email, resetLink })
  } catch (err) {
    console.error('[mailer] Failed to send password reset:', err.message)
  }

  res.json({ ok: true })
})

// POST /api/auth/reset-password
router.post('/reset-password', (req, res) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' })
  if (password.length < 6) return res.status(400).json({ error: 'Пароль має бути мінімум 6 символів' })

  const user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token)
  if (!user || !user.reset_expires || user.reset_expires < Date.now()) {
    return res.status(400).json({ error: 'Посилання недійсне або вже закінчилось' })
  }

  const hash = bcrypt.hashSync(password, 10)
  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?').run(hash, user.id)

  res.json({ ok: true })
})

// GET /api/auth/test-mail — тимчасовий endpoint для перевірки пошти
router.get('/test-mail', async (req, res) => {
  const { sendPasswordReset } = require('../mailer')
  try {
    await sendPasswordReset({
      toEmail: process.env.NOTIFY_EMAIL || process.env.MAIL_USER,
      resetLink: 'https://viewtoday.site/reset-password?token=test123',
    })
    res.json({ ok: true, to: process.env.NOTIFY_EMAIL || process.env.MAIL_USER })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, code: err.code })
  }
})

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ user: publicUser(user) })
})

module.exports = router
