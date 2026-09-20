const express = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')
const { createLinkToken, enabled } = require('../telegram')

const router = express.Router()

// GET /api/telegram/link-owner — venue owner or superadmin: generates a
// one-time t.me deep link that, once opened and started, connects this
// account's Telegram chat for new-booking notifications.
router.get('/link-owner', requireAuth, (req, res) => {
  if (!enabled) return res.status(503).json({ error: 'TELEGRAM_NOT_CONFIGURED' })
  if (req.user.role !== 'venue' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const url = createLinkToken('owner', req.user.id)
  res.json({ url })
})

// DELETE /api/telegram/link-owner — venue owner or superadmin: disconnects
// this account's Telegram chat, so new-booking notifications stop.
router.delete('/link-owner', requireAuth, (req, res) => {
  if (req.user.role !== 'venue' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  db.prepare('UPDATE users SET telegram_chat_id = NULL WHERE id = ?').run(req.user.id)
  res.json({ ok: true })
})

module.exports = router
