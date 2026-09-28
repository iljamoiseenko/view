const express = require('express')
const multer = require('multer')
const path = require('path')
const sharp = require('sharp')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

const UPLOADS_DIR = process.env.UPLOADS_PATH || path.join(__dirname, '../../data/uploads')

// Buffered in memory instead of written straight to disk — sharp needs the
// whole file to resize/recompress it before anything lands on the volume.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files allowed'))
  },
})

// POST /api/upload  — requires auth
// Every upload (venue photos, event images, avatars) is a photo, never
// something that needs transparency, so re-encoding everything to JPEG is
// safe — a phone photo at full resolution/quality is easily 3-8MB; capping
// the longer side at 1600px and quality at 80 typically cuts that by 5-10x
// with no visible difference at the sizes these are actually displayed.
// Existing files already on disk are untouched — this only affects new
// uploads going forward.
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  try {
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
    await sharp(req.file.buffer)
      .rotate() // apply EXIF orientation before stripping it, so photos don't end up sideways
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(path.join(UPLOADS_DIR, filename))

    res.json({ url: `/uploads/${filename}` })
  } catch (err) {
    console.error('[upload] Failed to process image:', err.message)
    res.status(400).json({ error: 'Invalid or corrupt image' })
  }
})

module.exports = router
