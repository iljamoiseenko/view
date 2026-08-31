const express = require('express')
const db = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const wfp = require('../wayforpay')
const { SUBSCRIPTION_TIERS } = require('../subscriptionTiers')

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

  if (body.transactionStatus === 'Approved') {
    const renewsAt = Date.now() + wfp.renewalPeriodMs()

    if (isRenewal) {
      db.prepare(`
        INSERT INTO payments (id, user_id, order_reference, tier, amount, currency, status, raw_response, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?)
      `).run('pay' + Date.now(), payment.user_id, body.orderReference, payment.tier, body.amount, body.currency, JSON.stringify(body), Date.now())
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
    if (!isRenewal) {
      db.prepare('UPDATE payments SET status = ?, raw_response = ? WHERE order_reference = ?')
        .run('failed', JSON.stringify(body), baseOrderReference)
    }
    console.log(`[wayforpay] Not approved ${body.orderReference} — status=${body.transactionStatus}`)
  }

  res.json(wfp.buildWebhookAck(body.orderReference))
})

// TEMP DEBUG — remove after diagnosing the "renews once then stops" report.
// GET /api/subscriptions/debug-recurring-once — read-only, superadmin only.
router.get('/debug-recurring-once', requireAuth, requireRole('superadmin'), async (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.email, u.wayforpay_rec_token, u.subscription_status, u.subscription_renews_at,
           u.subscription_tier
    FROM users u
    WHERE u.wayforpay_rec_token IS NOT NULL
    ORDER BY u.id DESC
    LIMIT 10
  `).all()

  const results = []
  for (const u of rows) {
    let status = null
    try {
      status = await wfp.regularStatus(u.wayforpay_rec_token)
    } catch (err) {
      status = { error: err.message }
    }
    const payments = db.prepare('SELECT order_reference, status, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(u.id)
    results.push({ user: u, wfpStatus: status, recentPayments: payments })
  }

  res.json(results)
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
