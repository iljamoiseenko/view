const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })
const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3001
const isProd = process.env.NODE_ENV === 'production'

// Railway/production sits behind a reverse proxy — without this, req.ip is
// always the proxy's own address, which would make any per-IP rate limiting
// (e.g. on the booking endpoint) bucket every visitor together.
if (isProd) app.set('trust proxy', 1)

// CORS — в prod фронт і бек на одному домені, тож потрібен лише для локальної
// розробки та для iOS-застосунку (Capacitor віддає бандл з capacitor://localhost).
const corsOrigins = ['capacitor://localhost']
if (!isProd) corsOrigins.push('http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175')
app.use(cors({ origin: corsOrigins }))

// WayForPay's webhook sends Content-Type: application/x-www-form-urlencoded but the
// body is actually raw JSON text — read it as text here, before the generic parsers
// below would otherwise swallow it as one giant urlencoded key with no value.
app.use('/api/subscriptions/callback', express.text({ type: () => true }))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
const uploadsPath = process.env.UPLOADS_PATH || path.join(__dirname, '..', 'data', 'uploads')
app.use('/uploads', express.static(uploadsPath))

app.use('/api/auth', require('./routes/auth'))
app.use('/api/places', require('./routes/places'))
app.use('/api/events', require('./routes/events'))
app.use('/api/users', require('./routes/users'))
app.use('/api/upload', require('./routes/upload'))
app.use('/api/banners', require('./routes/banners'))
app.use('/api/curated-lists', require('./routes/curatedLists'))
app.use('/api/subscriptions', require('./routes/subscriptions'))
app.use('/api/feedback', require('./routes/feedback'))
app.use('/api/table-booking', require('./routes/tableBooking'))
app.use('/api/telegram', require('./routes/telegramLink'))

app.get('/api/health', (_, res) => res.json({ ok: true }))

// В продакшні роздаємо зібраний фронтенд
if (isProd) {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  // WayForPay's returnUrl redirect comes back as a POST, not GET — accept both
  app.all('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => console.log(`View API running on http://localhost:${PORT}`))

require('./telegram').startPolling()
