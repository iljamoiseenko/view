const express = require('express')
const multer = require('multer')
const path = require('path')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

const storage = multer.diskStorage({
  destination: process.env.UPLOADS_PATH || path.join(__dirname, '../../data/uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + ext)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files allowed'))
  },
})

// POST /api/upload  — requires auth
router.post('/', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const url = `/uploads/${req.file.filename}`
  res.json({ url })
})

module.exports = router
