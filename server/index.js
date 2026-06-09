require('dotenv').config()
const path = require('path')
const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3001
const isProd = process.env.NODE_ENV === 'production'

// CORS — тільки для локальної розробки; в prod фронт і бек на одному домені
if (!isProd) {
  app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'] }))
}

app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.use('/api/auth', require('./routes/auth'))
app.use('/api/places', require('./routes/places'))
app.use('/api/events', require('./routes/events'))
app.use('/api/users', require('./routes/users'))
app.use('/api/upload', require('./routes/upload'))
app.use('/api/banners', require('./routes/banners'))

app.get('/api/health', (_, res) => res.json({ ok: true }))

// В продакшні роздаємо зібраний фронтенд
if (isProd) {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => console.log(`View API running on http://localhost:${PORT}`))
