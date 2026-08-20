const express = require('express')
const db = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const wfp = require('../wayforpay')
const { SUBSCRIPTION_TIERS } = require('../subscriptionTiers')

const router = express.Router()

// Public WayForPay test merchant — force $1 charges so we don't need real pricing to test the flow
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
  const isTestMerchant = TEST_MERCHANT_ACCOUNTS.includes(merchantAccount)
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
  })

  const baseUrl = process.env.APP_URL || 'https://viewtoday.site'
  fields.returnUrl = `${baseUrl}/venue?payment=return`
  fields.serviceUrl = `${baseUrl}/api/subscriptions/callback`

  db.prepare(`
    INSERT INTO payments (id, user_id, order_reference, tier, amount, currency, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run('pay' + Date.now(), req.user.id, orderReference, tier, amount, currency, Date.now())

  res.json({ action: 'https://secure.wayforpay.com/pay', fields, isTestMerchant })
})

// POST /api/subscriptions/callback — WayForPay's server-to-server webhook.
// This, not the browser returnUrl, is the source of truth for activating a plan.
router.post('/callback', (req, res) => {
  const body = req.body

  if (!wfp.verifyCallbackSignature(body)) {
    console.error('[wayforpay] Invalid callback signature for order', body?.orderReference)
    return res.status(400).json({ error: 'Invalid signature' })
  }

  const payment = db.prepare('SELECT * FROM payments WHERE order_reference = ?').get(body.orderReference)
  if (!payment) {
    console.error('[wayforpay] Callback for unknown order reference', body.orderReference)
    return res.json(wfp.buildWebhookAck(body.orderReference))
  }

  if (body.transactionStatus === 'Approved') {
    const renewsAt = Date.now() + 30 * 24 * 60 * 60 * 1000

    db.prepare('UPDATE payments SET status = ?, raw_response = ? WHERE order_reference = ?')
      .run('approved', JSON.stringify(body), body.orderReference)

    db.prepare(`
      UPDATE users SET subscription_tier = ?, subscription_status = 'active', subscription_renews_at = ?
      WHERE id = ?
    `).run(payment.tier, renewsAt, payment.user_id)

    console.log(`[wayforpay] Approved ${body.orderReference} — user ${payment.user_id} → ${payment.tier}`)
  } else {
    db.prepare('UPDATE payments SET status = ?, raw_response = ? WHERE order_reference = ?')
      .run('failed', JSON.stringify(body), body.orderReference)
    console.log(`[wayforpay] Not approved ${body.orderReference} — status=${body.transactionStatus}`)
  }

  res.json(wfp.buildWebhookAck(body.orderReference))
})

// POST /api/subscriptions/cancel — venue owner turns off their own plan immediately
router.post('/cancel', requireAuth, requireRole('venue'), (req, res) => {
  db.prepare(`
    UPDATE users SET subscription_tier = 'basic', subscription_status = 'inactive', subscription_renews_at = NULL, wayforpay_rec_token = NULL
    WHERE id = ?
  `).run(req.user.id)
  res.json({ ok: true })
})

module.exports = router
