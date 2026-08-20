const crypto = require('crypto')

function config() {
  return {
    merchantAccount: process.env.WAYFORPAY_MERCHANT_ACCOUNT,
    merchantSecret: process.env.WAYFORPAY_MERCHANT_SECRET,
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

// Signature for the PURCHASE form (server -> WayForPay hosted page)
function buildPurchaseFields({ orderReference, orderDate, amount, currency, productName, productCount, productPrice }) {
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

  return {
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

module.exports = { config, isConfigured, sign, buildPurchaseFields, verifyCallbackSignature, buildWebhookAck }
