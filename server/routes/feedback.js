const express = require('express')
const { sendFeedbackNotification } = require('../mailer')

const router = express.Router()

// POST /api/feedback — public, no auth required. Fire-and-forget email to the
// site owner via the existing Resend mailer; nothing is stored in the DB.
router.post('/', async (req, res) => {
  const message = (req.body?.message || '').trim()
  if (!message) return res.status(400).json({ error: 'message required' })
  if (message.length > 4000) return res.status(400).json({ error: 'message too long' })

  try {
    await sendFeedbackNotification({ message })
  } catch (err) {
    console.error('[feedback] Failed to send notification:', err.message)
    // Still respond ok — the user's feedback shouldn't fail just because the
    // owner's inbox notification did.
  }

  res.json({ ok: true })
})

module.exports = router
