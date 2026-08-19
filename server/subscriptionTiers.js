// Subscription plans. Payment processing is not wired up yet —
// for now a superadmin sets `subscription_tier` on a venue account manually.
const SUBSCRIPTION_TIERS = {
  basic: { price: 7, boostsPerMonth: 5, eventsPerMonth: 3 },
  standard: { price: 15, boostsPerMonth: 10, eventsPerMonth: 6 },
  pro: { price: 24, boostsPerMonth: 20, eventsPerMonth: null },
}

const BOOST_DURATION_MS = 24 * 60 * 60 * 1000

function boostsPerMonth(tier) {
  return SUBSCRIPTION_TIERS[tier]?.boostsPerMonth ?? 0
}

module.exports = { SUBSCRIPTION_TIERS, BOOST_DURATION_MS, boostsPerMonth }
