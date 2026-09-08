const express = require('express')
const db = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const wfp = require('../wayforpay')
const { SUBSCRIPTION_TIERS } = require('../subscriptionTiers')
const { sendPaymentFailedNotification } = require('../mailer')

const router = express.Router()

// Public WayForPay test merchant — force $1 charges so we don't need real pricing to test the flow.
// WAYFORPAY_FORCE_1USD=1 does the same for a real merchant while it's still being tested on prod —
// remove that env var once real tier prices should actually charge.
const TEST_MERCHANT_ACCOUNTS = ['test_merch_n1']

// POST /api/subscriptions/checkout — venue owner picks a plan, we hand back a signed
// WayForPay purchase form for the frontend to submit (redirects to their hosted page)
router.post('/checkout', requireAuth, requireRole('venue'), (req, res) => {
  if (!wfp.isConfigured()) {
    return res.status(503).json({ error: 'Payments are not configured yet' })
  }

  const { tier } = req.body
  const tierInfo = SUBSCRIPTION_TIERS[tier]
  if (!tierInfo) return res.status(400).json({ error: 'Unknown plan' })

  const { merchantAccount } = wfp.config()
  const isTestMerchant = TEST_MERCHANT_ACCOUNTS.includes(merchantAccount) || process.env.WAYFORPAY_FORCE_1USD === '1'
  const amount = isTestMerchant ? 1 : tierInfo.price
  const currency = 'USD'

  const orderReference = `sub_${req.user.id}_${Date.now()}`
  const orderDate = Math.floor(Date.now() / 1000)
  const productName = `VIEW — tariff ${tier}`

  const fields = wfp.buildPurchaseFields({
    orderReference,
    orderDate,
    amount,
    currency,
    productName,
    productCount: 1,
    productPrice: amount,
    regular: true,
  })

  const baseUrl = process.env.APP_URL || 'https://viewtoday.site'
  fields.returnUrl = `${baseUrl}/venue?payment=return&order=${orderReference}`
  fields.serviceUrl = `${baseUrl}/api/subscriptions/callback`

  db.prepare(`
    INSERT INTO payments (id, user_id, order_reference, tier, amount, currency, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run('pay' + Date.now(), req.user.id, orderReference, tier, amount, currency, Date.now())

  res.json({ action: 'https://secure.wayforpay.com/pay', fields, isTestMerchant })
})

// GET /api/subscriptions/status/:orderReference — the venue's own return-page poll,
// so the frontend can tell "still waiting for the webhook" apart from "card declined"
// instead of guessing from a timeout.
router.get('/status/:orderReference', requireAuth, requireRole('venue'), (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE order_reference = ?').get(req.params.orderReference)
  if (!payment || payment.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Payment not found' })
  }

  let reason = null
  if (payment.status === 'failed' && payment.raw_response) {
    try { reason = JSON.parse(payment.raw_response).reason || null } catch { /* ignore */ }
  }

  res.json({ status: payment.status, tier: payment.tier, reason })
})

// POST /api/subscriptions/callback — WayForPay's server-to-server webhook.
// This, not the browser returnUrl, is the source of truth for activating a plan.
router.post('/callback', (req, res) => {
  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch (err) {
    console.error('[wayforpay] Callback body is not valid JSON:', req.body)
    return res.status(400).json({ error: 'Invalid body' })
  }

  if (!wfp.verifyCallbackSignature(body)) {
    console.error('[wayforpay] Invalid callback signature. body:', JSON.stringify(body))
    return res.status(400).json({ error: 'Invalid signature' })
  }

  // Recurring charges arrive with our original orderReference plus a WayForPay-appended
  // suffix (e.g. "..._WFPREG-541278-1") — strip it to find the payment/user it belongs to.
  const baseOrderReference = body.orderReference.split('_WFPREG-')[0]
  const payment = db.prepare('SELECT * FROM payments WHERE order_reference = ?').get(baseOrderReference)
  if (!payment) {
    console.error('[wayforpay] Callback for unknown order reference', body.orderReference)
    return res.json(wfp.buildWebhookAck(body.orderReference))
  }
  const isRenewal = body.orderReference !== baseOrderReference

  // WayForPay can (and does) redeliver the same webhook — upsert by order_reference
  // instead of a bare INSERT so a retry updates the existing row rather than crashing
  // on the UNIQUE constraint (order_reference is unique) and leaving WayForPay without
  // its ack, which would just make it retry forever.
  function upsertRenewalPayment(status) {
    const result = db.prepare('UPDATE payments SET status = ?, raw_response = ? WHERE order_reference = ?')
      .run(status, JSON.stringify(body), body.orderReference)
    if (result.changes === 0) {
      db.prepare(`
        INSERT INTO payments (id, user_id, order_reference, tier, amount, currency, status, raw_response, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('pay' + Date.now(), payment.user_id, body.orderReference, payment.tier, body.amount ?? payment.amount, body.currency ?? payment.currency, status, JSON.stringify(body), Date.now())
    }
  }

  if (body.transactionStatus === 'Approved') {
    const renewsAt = Date.now() + wfp.renewalPeriodMs()

    if (isRenewal) {
      upsertRenewalPayment('approved')
    } else {
      db.prepare('UPDATE payments SET status = ?, raw_response = ? WHERE order_reference = ?')
        .run('approved', JSON.stringify(body), baseOrderReference)
    }

    // wayforpay_rec_token stays the BASE orderReference — regularApi (status/suspend/remove)
    // is keyed to the original order, not to each individual renewal's suffixed reference.
    db.prepare(`
      UPDATE users SET subscription_tier = ?, subscription_status = 'active', subscription_renews_at = ?, wayforpay_rec_token = ?
      WHERE id = ?
    `).run(payment.tier, renewsAt, baseOrderReference, payment.user_id)

    console.log(`[wayforpay] Approved ${body.orderReference} — user ${payment.user_id} → ${payment.tier}${isRenewal ? ' (renewal)' : ''}`)
  } else {
    if (isRenewal) {
      // A failed renewal charge previously left no trace at all (only successes were
      // recorded) — record it too, so it shows up in payment history / superadmin
      // rather than silently vanishing until the plan later lapses on its own.
      upsertRenewalPayment('failed')
    } else {
      db.prepare('UPDATE payments SET status = ?, raw_response = ? WHERE order_reference = ?')
        .run('failed', JSON.stringify(body), baseOrderReference)
    }

    const owner = db.prepare('SELECT email FROM users WHERE id = ?').get(payment.user_id)
    if (owner?.email) {
      sendPaymentFailedNotification({
        toEmail: owner.email,
        tier: payment.tier,
        isRenewal,
        reason: body.reason,
      }).catch(err => console.error('[mailer] Failed to send payment-failed notice:', err.message))
    }

    console.log(`[wayforpay] Not approved ${body.orderReference} — status=${body.transactionStatus}`)
  }

  res.json(wfp.buildWebhookAck(body.orderReference))
})

// POST /api/subscriptions/cancel — stops future auto-renewal, but the venue keeps full
// access until the already-paid period (subscription_renews_at) actually runs out —
// see expireIfPastDue for how that expiry is then enforced without a cron job.
router.post('/cancel', requireAuth, requireRole('venue'), async (req, res) => {
  const user = db.prepare('SELECT wayforpay_rec_token FROM users WHERE id = ?').get(req.user.id)

  if (user?.wayforpay_rec_token) {
    try {
      await wfp.regularRemove(user.wayforpay_rec_token)
    } catch (err) {
      console.error('[wayforpay] Failed to remove regular payment for user', req.user.id, err.message)
      return res.status(502).json({ error: 'Не вдалося скасувати регулярний платіж у WayForPay. Спробуйте ще раз або зверніться в підтримку.' })
    }
  }

  db.prepare('UPDATE users SET wayforpay_rec_token = NULL WHERE id = ?').run(req.user.id)
  res.json({ ok: true })
})

module.exports = router
