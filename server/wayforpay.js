const crypto = require('crypto')
const fetch = require('node-fetch')

function config() {
  return {
    merchantAccount: process.env.WAYFORPAY_MERCHANT_ACCOUNT,
    merchantSecret: process.env.WAYFORPAY_MERCHANT_SECRET,
    merchantPassword: process.env.WAYFORPAY_MERCHANT_PASSWORD,
    merchantDomainName: process.env.WAYFORPAY_MERCHANT_DOMAIN || 'viewtoday.site',
  }
}

function isConfigured() {
  const { merchantAccount, merchantSecret } = config()
  return !!merchantAccount && !!merchantSecret
}

function sign(fields) {
  const { merchantSecret } = config()
  const str = fields.join(';')
  return crypto.createHmac('md5', merchantSecret).update(str).digest('hex')
}

// Date of the first recurring charge, formatted DD.MM.YYYY as WayForPay expects.
// WAYFORPAY_TEST_FAST_RENEWAL=1 schedules it for tomorrow instead of next month —
// WayForPay's dateNext has day-level granularity only, so "tomorrow" is the fastest
// a recurring cycle can be exercised end-to-end. Remove the env var before going live.
function nextChargeDate() {
  const d = new Date()
  if (process.env.WAYFORPAY_TEST_FAST_RENEWAL === '1') {
    d.setDate(d.getDate() + 1)
  } else {
    d.setMonth(d.getMonth() + 1)
  }
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

// Signature for the PURCHASE form (server -> WayForPay hosted page).
// regularMode/dateNext (recurring billing) are NOT part of the signed string —
// only the base fields WayForPay documents for the Purchase signature are.
function buildPurchaseFields({ orderReference, orderDate, amount, currency, productName, productCount, productPrice, regular }) {
  const { merchantAccount, merchantDomainName } = config()
  const merchantSignature = sign([
    merchantAccount,
    merchantDomainName,
    orderReference,
    orderDate,
    amount,
    currency,
    productName,
    productCount,
    productPrice,
  ])

  const fields = {
    merchantAccount,
    merchantDomainName,
    merchantTransactionType: 'AUTO',
    merchantTransactionSecureType: 'AUTO',
    orderReference,
    orderDate,
    amount,
    currency,
    'productName[]': productName,
    'productCount[]': productCount,
    'productPrice[]': productPrice,
    merchantSignature,
  }

  if (regular) {
    fields.regularMode = 'monthly'
    fields.dateNext = nextChargeDate()
    fields.regularOn = 1 // pre-check "make it recurring" — a $X/month plan must actually renew monthly
    fields.regularBehavior = 'preset' // and lock it so the customer can't uncheck it on WayForPay's page
  }

  return fields
}

// Verify signature on the callback WayForPay POSTs to our webhook
function verifyCallbackSignature(body) {
  const expected = sign([
    body.merchantAccount,
    body.orderReference,
    body.amount,
    body.currency,
    body.authCode ?? '',
    body.cardPan ?? '',
    body.transactionStatus,
    body.reasonCode ?? '',
  ])
  return expected === body.merchantSignature
}

// The ack WayForPay expects us to answer the webhook with, or it keeps retrying
function buildWebhookAck(orderReference) {
  const status = 'accept'
  const time = Math.floor(Date.now() / 1000)
  const signature = sign([orderReference, status, time])
  return { orderReference, status, time, signature }
}

// Manage an active regular (recurring) payment — STATUS / SUSPEND / RESUME / REMOVE.
// Unlike Purchase/callback, this API authenticates with merchantPassword, not an HMAC signature.
async function regularApiRequest(requestType, orderReference, extra = {}) {
  const { merchantAccount, merchantPassword } = config()
  const res = await fetch('https://api.wayforpay.com/regularApi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType, merchantAccount, merchantPassword, orderReference, ...extra }),
  })
  const data = await res.json()
  if (data.reasonCode !== undefined && data.reasonCode !== 1100 && data.reasonCode !== 4100) {
    throw new Error(`WayForPay regularApi ${requestType} failed: ${data.reason} (code ${data.reasonCode})`)
  }
  return data
}

const regularStatus = (orderReference) => regularApiRequest('STATUS', orderReference)
const regularSuspend = (orderReference) => regularApiRequest('SUSPEND', orderReference)
const regularResume = (orderReference) => regularApiRequest('RESUME', orderReference)
const regularRemove = (orderReference) => regularApiRequest('REMOVE', orderReference)

module.exports = {
  config, isConfigured, sign, buildPurchaseFields, verifyCallbackSignature, buildWebhookAck,
  regularStatus, regularSuspend, regularResume, regularRemove,
}
