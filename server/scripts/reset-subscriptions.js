// One-off maintenance script: strip subscription access from every existing
// user before the paid subscription flow goes live, so nobody keeps premium
// features they got for free during development. Run once per environment:
//   node server/scripts/reset-subscriptions.js
const db = require('../db')

const result = db.prepare(`
  UPDATE users SET subscription_tier = 'basic', subscription_status = 'inactive', subscription_renews_at = NULL, wayforpay_rec_token = NULL
`).run()

console.log(`Reset subscription for ${result.changes} user(s)`)
