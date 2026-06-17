const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')
const path = require('path')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'view.db')
const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'venue',
    name TEXT NOT NULL,
    place_id TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS places (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT NOT NULL,
    description TEXT,
    cuisine TEXT,
    phone TEXT,
    working_hours TEXT,
    website TEXT,
    photos TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    marks TEXT NOT NULL DEFAULT '[]',
    rating REAL,
    published INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS banners (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    image TEXT DEFAULT '',
    link_slug TEXT NOT NULL,
    bg_color TEXT DEFAULT '#1a1a1a',
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    place_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    type TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
  );
`)

// Migrations
const placesCols = db.prepare('PRAGMA table_info(places)').all().map(c => c.name)
if (!placesCols.includes('published')) {
  db.prepare('ALTER TABLE places ADD COLUMN published INTEGER NOT NULL DEFAULT 0').run()
  db.prepare('UPDATE places SET published = 1').run()
  console.log('[db] Migration: added `published` column, published all existing places')
}
if (!placesCols.includes('marks')) {
  db.prepare("ALTER TABLE places ADD COLUMN marks TEXT NOT NULL DEFAULT '[]'").run()
  console.log('[db] Migration: added `marks` column to places')
}

const usersCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name)
if (!usersCols.includes('username')) {
  db.prepare('ALTER TABLE users ADD COLUMN username TEXT').run()
  // Seed existing users: use email prefix as username
  db.prepare("UPDATE users SET username = LOWER(SUBSTR(email, 1, INSTR(email, '@') - 1)) WHERE username IS NULL").run()
  console.log('[db] Migration: added `username` column')
}
if (!usersCols.includes('plain_pass')) {
  db.prepare('ALTER TABLE users ADD COLUMN plain_pass TEXT').run()
  console.log('[db] Migration: added `plain_pass` column')
}

// Seed only superadmin if no users exist
function seedAdminIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').get('superadmin')
  if (count.c > 0) return

  const hash = bcrypt.hashSync('Admin2024', 10)
  db.prepare(`
    INSERT INTO users (id, email, username, password_hash, plain_pass, role, name, place_id, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 'superadmin', ?, NULL, 1, ?)
  `).run('u1', 'admin', 'admin', hash, 'Admin2024', 'Адміністратор', new Date().toISOString())

  console.log('[db] Seeded superadmin account (login: admin / Admin2024)')
}

seedAdminIfEmpty()

module.exports = db
