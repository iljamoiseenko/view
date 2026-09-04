// Subscription plans. Payment processing is not wired up yet —
// for now a superadmin sets `subscription_tier` on a venue account manually.
const SUBSCRIPTION_TIERS = {
  standard: { price: 9.99, boostsPerMonth: 4, eventsPerMonth: 4 },
  pro: { price: 19.99, boostsPerMonth: 12, eventsPerMonth: 10 },
}

const BOOST_DURATION_MS = 24 * 60 * 60 * 1000

function boostsPerMonth(tier) {
  return SUBSCRIPTION_TIERS[tier]?.boostsPerMonth ?? 0
}

// Cancelling keeps access active until the already-paid period ends — it just clears
// wayforpay_rec_token so WayForPay won't auto-renew. There's no cron here, so instead
// we lazily flip status to 'inactive' the next time anything reads it past renews_at.
// Call this before any subscription-gated check (event creation, boost, /auth/me, login).
function expireIfPastDue(db, userId) {
  const u = db.prepare('SELECT subscription_status, subscription_renews_at FROM users WHERE id = ?').get(userId)
  if (u?.subscription_status === 'active' && u.subscription_renews_at && u.subscription_renews_at < Date.now()) {
    db.prepare("UPDATE users SET subscription_status = 'inactive' WHERE id = ?").run(userId)
  }
}

module.exports = { SUBSCRIPTION_TIERS, BOOST_DURATION_MS, boostsPerMonth, expireIfPastDue }
