const express = require('express')
const db = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { geocodeAddress } = require('../geocode')
const { BOOST_DURATION_MS, boostsPerMonth } = require('../subscriptionTiers')

const router = express.Router()

function startOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
}

const SOCIAL_FIELDS = ['instagram', 'facebook', 'tiktok', 'threads', 'telegram', 'youtube']

function parsePlace(row) {
  const socials = {}
  for (const key of SOCIAL_FIELDS) {
    socials[`${key}Url`] = row[`${key}_url`]
    socials[`${key}_url`] = undefined
  }
  return {
    ...row,
    ...socials,
    photos: JSON.parse(row.photos || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    collections: JSON.parse(row.collections || '[]'),
    marks: undefined,
    workingHours: row.working_hours,
    working_hours: undefined,
    published: row.published === 1,
    bookingEnabled: row.booking_enabled === 1,
    booking_enabled: undefined,
    bookingPhone: row.booking_phone,
    booking_phone: undefined,
    menuUrl: row.menu_url,
    menu_url: undefined,
    petsFriendly: row.pets_friendly === 1,
    pets_friendly: undefined,
    kidsRoom: row.kids_room === 1,
    kids_room: undefined,
    ticketsUrl: row.tickets_url,
    tickets_url: undefined,
    customType: row.custom_type,
    custom_type: undefined,
    boostedAt: row.boosted_at,
    boosted_at: undefined,
    topUntil: row.boosted_at ? row.boosted_at + BOOST_DURATION_MS : null,
  }
}

// GET /api/places  — places with an active (< 24h) boost float to the top
router.get('/', (req, res) => {
  const cutoff = Date.now() - BOOST_DURATION_MS
  const rows = db.prepare(`
    SELECT * FROM places
    ORDER BY (boosted_at IS NOT NULL AND boosted_at > ?) DESC, boosted_at DESC
  `).all(cutoff)
  res.json(rows.map(parsePlace))
})

// GET /api/places/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Place not found' })
  res.json(parsePlace(row))
})

// POST /api/places/geocode-missing  — superadmin only, backfills lat/lng for places that don't have it yet
router.post('/geocode-missing', requireAuth, requireRole('superadmin'), async (req, res) => {
  const rows = db.prepare('SELECT id, address, city FROM places WHERE address IS NOT NULL AND address != \'\' AND (lat IS NULL OR lng IS NULL)').all()

  let updated = 0
  const failed = []

  for (const row of rows) {
    const coords = await geocodeAddress(row.address, row.city)
    if (coords) {
      db.prepare('UPDATE places SET lat = ?, lng = ? WHERE id = ?').run(coords.lat, coords.lng, row.id)
      updated++
    } else {
      failed.push({ id: row.id, address: row.address })
    }
    // Respect Nominatim's usage policy (max 1 request/sec)
    await new Promise(r => setTimeout(r, 1100))
  }

  res.json({ total: rows.length, updated, failed })
})

// PUT /api/places/:id  — venue can only update their own place
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const user = req.user

  if (user.role !== 'superadmin' && user.placeId !== id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const existing = db.prepare('SELECT * FROM places WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Place not found' })

  const { name, type, city, address, description, cuisine, phone, workingHours, website, photos, tags, collections, rating, bookingEnabled, bookingPhone, menuUrl, petsFriendly, kidsRoom, ticketsUrl, customType } = req.body

  // Re-geocode only if the address or city actually changed
  let coords = null
  const addressChanged = address !== undefined && address !== existing.address
  const cityChanged = city !== undefined && city !== existing.city
  if (addressChanged || cityChanged) {
    coords = await geocodeAddress(address ?? existing.address, city ?? existing.city)
  }

  const socialSet = SOCIAL_FIELDS.map(key => `${key}_url = COALESCE(?, ${key}_url)`).join(', ')
  const socialParams = SOCIAL_FIELDS.map(key => {
    const val = req.body[`${key}Url`]
    return val !== undefined ? val : null
  })

  db.prepare(`
    UPDATE places SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      city = COALESCE(?, city),
      address = COALESCE(?, address),
      description = COALESCE(?, description),
      cuisine = COALESCE(?, cuisine),
      phone = COALESCE(?, phone),
      working_hours = COALESCE(?, working_hours),
      website = COALESCE(?, website),
      photos = COALESCE(?, photos),
      tags = COALESCE(?, tags),
      collections = COALESCE(?, collections),
      rating = COALESCE(?, rating),
      lat = COALESCE(?, lat),
      lng = COALESCE(?, lng),
      booking_enabled = COALESCE(?, booking_enabled),
      booking_phone = COALESCE(?, booking_phone),
      menu_url = COALESCE(?, menu_url),
      pets_friendly = COALESCE(?, pets_friendly),
      kids_room = COALESCE(?, kids_room),
      tickets_url = COALESCE(?, tickets_url),
      custom_type = COALESCE(?, custom_type),
      ${socialSet},
      published = 1
    WHERE id = ?
  `).run(
    name ?? null, type ?? null, city ?? null, address ?? null,
    description ?? null, cuisine ?? null, phone ?? null,
    workingHours ?? null, website ?? null,
    photos !== undefined ? JSON.stringify(photos) : null,
    tags !== undefined ? JSON.stringify(tags) : null,
    collections !== undefined ? JSON.stringify(collections) : null,
    rating ?? null,
    coords?.lat ?? null,
    coords?.lng ?? null,
    bookingEnabled !== undefined ? (bookingEnabled ? 1 : 0) : null,
    bookingPhone !== undefined ? bookingPhone : null,
    menuUrl !== undefined ? menuUrl : null,
    petsFriendly !== undefined ? (petsFriendly ? 1 : 0) : null,
    kidsRoom !== undefined ? (kidsRoom ? 1 : 0) : null,
    ticketsUrl !== undefined ? ticketsUrl : null,
    customType !== undefined ? customType : null,
    ...socialParams,
    id
  )

  const updated = db.prepare('SELECT * FROM places WHERE id = ?').get(id)
  res.json(parsePlace(updated))
})

// POST /api/places  — superadmin only
router.post('/', requireAuth, requireRole('superadmin'), async (req, res) => {
  const { name, type, city, address, description, cuisine, phone, workingHours, website, photos, tags, collections, rating, bookingEnabled, bookingPhone, menuUrl, petsFriendly, kidsRoom, ticketsUrl, customType } = req.body
  if (!name || !type || !city || !address) return res.status(400).json({ error: 'name, type, city, address required' })

  const coords = await geocodeAddress(address, city)

  const socialCols = SOCIAL_FIELDS.map(key => `${key}_url`).join(', ')
  const socialPlaceholders = SOCIAL_FIELDS.map(() => '?').join(', ')
  const socialValues = SOCIAL_FIELDS.map(key => req.body[`${key}Url`] ?? null)

  const id = 'p' + Date.now()
  db.prepare(`
    INSERT INTO places (id, name, type, city, address, description, cuisine, phone, working_hours, website, photos, tags, collections, rating, lat, lng, booking_enabled, booking_phone, menu_url, pets_friendly, kids_room, tickets_url, custom_type, ${socialCols})
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${socialPlaceholders})
  `).run(id, name, type, city, address, description ?? '', cuisine ?? '', phone ?? '', workingHours ?? '', website ?? '', JSON.stringify(photos ?? []), JSON.stringify(tags ?? []), JSON.stringify(collections ?? []), rating ?? null, coords?.lat ?? null, coords?.lng ?? null, bookingEnabled ? 1 : 0, bookingPhone ?? null, menuUrl ?? null, petsFriendly ? 1 : 0, kidsRoom ? 1 : 0, ticketsUrl ?? null, customType ?? null, ...socialValues)

  const created = db.prepare('SELECT * FROM places WHERE id = ?').get(id)
  res.status(201).json(parsePlace(created))
})

// GET /api/places/:id/boost-quota  — self or superadmin, reports this month's boost usage
router.get('/:id/boost-quota', requireAuth, (req, res) => {
  const { id } = req.params
  const user = req.user
  if (user.role !== 'superadmin' && user.placeId !== id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const place = db.prepare('SELECT boosted_at FROM places WHERE id = ?').get(id)
  if (!place) return res.status(404).json({ error: 'Place not found' })

  const owner = db.prepare('SELECT subscription_tier FROM users WHERE place_id = ?').get(id)
  const tier = owner?.subscription_tier || 'basic'
  const limit = boostsPerMonth(tier)
  const used = db.prepare('SELECT COUNT(*) as c FROM boosts WHERE place_id = ? AND boosted_at >= ?').get(id, startOfMonth()).c
  const topUntil = place.boosted_at ? place.boosted_at + BOOST_DURATION_MS : null

  res.json({ tier, limit, used, remaining: Math.max(0, limit - used), topUntil })
})

// POST /api/places/:id/boost  — activates a 24h top placement; venues are limited by subscription tier, superadmin is unlimited
router.post('/:id/boost', requireAuth, (req, res) => {
  const { id } = req.params
  const user = req.user

  if (user.role !== 'superadmin' && user.placeId !== id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const existing = db.prepare('SELECT id FROM places WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Place not found' })

  if (user.role !== 'superadmin') {
    const owner = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(user.id)
    const tier = owner?.subscription_tier || 'basic'
    const limit = boostsPerMonth(tier)
    const used = db.prepare('SELECT COUNT(*) as c FROM boosts WHERE place_id = ? AND boosted_at >= ?').get(id, startOfMonth()).c

    if (used >= limit) {
      return res.status(403).json({ error: 'Boost quota used up for this month', code: 'QUOTA_EXCEEDED', tier, limit, used })
    }
  }

  const now = Date.now()
  db.prepare('INSERT INTO boosts (id, place_id, boosted_by, boosted_at) VALUES (?, ?, ?, ?)')
    .run('b' + now, id, user.id, now)
  db.prepare('UPDATE places SET boosted_at = ? WHERE id = ?').run(now, id)

  const updated = db.prepare('SELECT * FROM places WHERE id = ?').get(id)
  res.json(parsePlace(updated))
})

// DELETE /api/places/:id/boost  — superadmin only, moderation override to pull a place out of the top early
router.delete('/:id/boost', requireAuth, requireRole('superadmin'), (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT id FROM places WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Place not found' })

  db.prepare('UPDATE places SET boosted_at = NULL WHERE id = ?').run(id)

  const updated = db.prepare('SELECT * FROM places WHERE id = ?').get(id)
  res.json(parsePlace(updated))
})

// DELETE /api/places/:id  — superadmin only
router.delete('/:id', requireAuth, requireRole('superadmin'), (req, res) => {
  const result = db.prepare('DELETE FROM places WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'Place not found' })
  res.json({ ok: true })
})

module.exports = router
