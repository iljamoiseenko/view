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

  CREATE TABLE IF NOT EXISTS curated_lists (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_role TEXT DEFAULT '',
    author_avatar TEXT DEFAULT '',
    author_avatar_position TEXT DEFAULT '50% 50%',
    cover_image TEXT DEFAULT '',
    icon TEXT DEFAULT '',
    place_ids TEXT NOT NULL DEFAULT '[]',
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

  CREATE TABLE IF NOT EXISTS boosts (
    id TEXT PRIMARY KEY,
    place_id TEXT NOT NULL,
    boosted_by TEXT NOT NULL,
    boosted_at INTEGER NOT NULL,
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    order_reference TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'UAH',
    status TEXT NOT NULL DEFAULT 'pending',
    is_recurring_token INTEGER NOT NULL DEFAULT 0,
    raw_response TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS place_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    place_id TEXT NOT NULL,
    viewed_at INTEGER NOT NULL,
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_place_views_place_date ON place_views (place_id, viewed_at);

  -- Table booking: a place can have several "floors" (or a summer terrace,
  -- a second hall, etc.) — each its own layout (floor plan canvas) made of
  -- objects (bookable tables + decorative labels like "БАР"/"СЦЕНА"), and
  -- bookings pinned to a specific table object for a specific date.
  CREATE TABLE IF NOT EXISTS table_layouts (
    id TEXT PRIMARY KEY,
    place_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Основний зал',
    sort_order INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 900,
    height INTEGER NOT NULL DEFAULT 650,
    background TEXT NOT NULL DEFAULT '#F7F7F7',
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_table_layouts_place ON table_layouts (place_id);

  CREATE TABLE IF NOT EXISTS table_objects (
    id TEXT PRIMARY KEY,
    layout_id TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'table',
    shape TEXT NOT NULL DEFAULT 'round',
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    label TEXT,
    seats INTEGER,
    is_bookable INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    available_from TEXT NOT NULL DEFAULT '10:00',
    available_to TEXT NOT NULL DEFAULT '23:00',
    slot_minutes INTEGER NOT NULL DEFAULT 90,
    color TEXT,
    FOREIGN KEY (layout_id) REFERENCES table_layouts(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_table_objects_layout ON table_objects (layout_id);

  -- A table can be booked more than once a day, as long as the time slots
  -- don't overlap — conflict checking happens at the app level (better-sqlite3
  -- is synchronous, so a check-then-insert within one request has no race).
  CREATE TABLE IF NOT EXISTS table_bookings (
    id TEXT PRIMARY KEY,
    place_id TEXT NOT NULL,
    table_id TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 90,
    guest_name TEXT NOT NULL,
    guest_phone TEXT NOT NULL,
    party_size INTEGER NOT NULL DEFAULT 2,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed',
    source TEXT NOT NULL DEFAULT 'online',
    user_id TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES table_objects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_table_bookings_table_date ON table_bookings (table_id, date);
  CREATE INDEX IF NOT EXISTS idx_table_bookings_place_date ON table_bookings (place_id, date);
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
if (!placesCols.includes('lat')) {
  db.prepare('ALTER TABLE places ADD COLUMN lat REAL').run()
  db.prepare('ALTER TABLE places ADD COLUMN lng REAL').run()
  console.log('[db] Migration: added `lat`/`lng` columns to places')
}
if (!placesCols.includes('booking_enabled')) {
  db.prepare('ALTER TABLE places ADD COLUMN booking_enabled INTEGER NOT NULL DEFAULT 0').run()
  db.prepare('ALTER TABLE places ADD COLUMN booking_phone TEXT').run()
  console.log('[db] Migration: added `booking_enabled`/`booking_phone` columns to places')
}
if (!placesCols.includes('menu_url')) {
  db.prepare('ALTER TABLE places ADD COLUMN menu_url TEXT').run()
  console.log('[db] Migration: added `menu_url` column to places')
}
if (!placesCols.includes('pets_friendly')) {
  db.prepare('ALTER TABLE places ADD COLUMN pets_friendly INTEGER NOT NULL DEFAULT 0').run()
  db.prepare('ALTER TABLE places ADD COLUMN kids_room INTEGER NOT NULL DEFAULT 0').run()
  console.log('[db] Migration: added `pets_friendly`/`kids_room` columns to places')
}
if (!placesCols.includes('instagram_url')) {
  db.prepare('ALTER TABLE places ADD COLUMN instagram_url TEXT').run()
  db.prepare('ALTER TABLE places ADD COLUMN facebook_url TEXT').run()
  db.prepare('ALTER TABLE places ADD COLUMN tiktok_url TEXT').run()
  db.prepare('ALTER TABLE places ADD COLUMN threads_url TEXT').run()
  db.prepare('ALTER TABLE places ADD COLUMN telegram_url TEXT').run()
  db.prepare('ALTER TABLE places ADD COLUMN youtube_url TEXT').run()
  console.log('[db] Migration: added social link columns to places')
}
if (!placesCols.includes('tickets_url')) {
  db.prepare('ALTER TABLE places ADD COLUMN tickets_url TEXT').run()
  console.log('[db] Migration: added `tickets_url` column to places')
}
if (!placesCols.includes('custom_type')) {
  db.prepare('ALTER TABLE places ADD COLUMN custom_type TEXT').run()
  console.log('[db] Migration: added `custom_type` column to places')
}
if (!placesCols.includes('boosted_at')) {
  db.prepare('ALTER TABLE places ADD COLUMN boosted_at INTEGER').run()
  console.log('[db] Migration: added `boosted_at` column to places')
}
if (!placesCols.includes('collections')) {
  db.prepare("ALTER TABLE places ADD COLUMN collections TEXT DEFAULT '[]'").run()
  console.log('[db] Migration: added `collections` column to places')
}
if (!placesCols.includes('opening_soon')) {
  db.prepare('ALTER TABLE places ADD COLUMN opening_soon INTEGER NOT NULL DEFAULT 0').run()
  db.prepare('ALTER TABLE places ADD COLUMN opening_date TEXT').run()
  console.log('[db] Migration: added `opening_soon`/`opening_date` columns to places')
}
if (!placesCols.includes('table_booking_paused')) {
  db.prepare('ALTER TABLE places ADD COLUMN table_booking_paused INTEGER NOT NULL DEFAULT 0').run()
  console.log('[db] Migration: added `table_booking_paused` column to places')
}

const eventsCols = db.prepare('PRAGMA table_info(events)').all().map(c => c.name)
if (!eventsCols.includes('custom_type')) {
  db.prepare('ALTER TABLE events ADD COLUMN custom_type TEXT').run()
  console.log('[db] Migration: added `custom_type` column to events')
}
if (!eventsCols.includes('registration_url')) {
  db.prepare('ALTER TABLE events ADD COLUMN registration_url TEXT').run()
  console.log('[db] Migration: added `registration_url` column to events')
}
if (!eventsCols.includes('featured_on_home')) {
  db.prepare('ALTER TABLE events ADD COLUMN featured_on_home INTEGER NOT NULL DEFAULT 0').run()
  console.log('[db] Migration: added `featured_on_home` column to events')
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
if (!usersCols.includes('avatar_url')) {
  db.prepare('ALTER TABLE users ADD COLUMN avatar_url TEXT').run()
  console.log('[db] Migration: added `avatar_url` column')
}
if (!usersCols.includes('subscription_tier')) {
  db.prepare("ALTER TABLE users ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'basic'").run()
  console.log('[db] Migration: added `subscription_tier` column')
}
if (!usersCols.includes('subscription_status')) {
  db.prepare("ALTER TABLE users ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'inactive'").run()
  db.prepare('ALTER TABLE users ADD COLUMN subscription_renews_at INTEGER').run()
  db.prepare('ALTER TABLE users ADD COLUMN wayforpay_rec_token TEXT').run()
  console.log('[db] Migration: added `subscription_status`/`subscription_renews_at`/`wayforpay_rec_token` columns')
}
if (!usersCols.includes('telegram_chat_id')) {
  db.prepare('ALTER TABLE users ADD COLUMN telegram_chat_id TEXT').run()
  console.log('[db] Migration: added `telegram_chat_id` column to users')
}

// Telegram deep-link tokens: a guest tapping "confirm via Telegram" on a
// booking, or an owner connecting notifications from their account tab, both
// go through a short-lived one-time token embedded in a t.me/<bot>?start=
// link — the bot's /start handler resolves it back to who/what to attach the
// resulting chat_id to.
db.exec(`
  CREATE TABLE IF NOT EXISTS telegram_tokens (
    token TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    used_at INTEGER
  );
`)

const curatedListsCols = db.prepare('PRAGMA table_info(curated_lists)').all().map(c => c.name)
if (!curatedListsCols.includes('author_avatar_position')) {
  db.prepare("ALTER TABLE curated_lists ADD COLUMN author_avatar_position TEXT DEFAULT '50% 50%'").run()
  console.log('[db] Migration: added `author_avatar_position` column to curated_lists')
}

const tableObjectsCols = db.prepare('PRAGMA table_info(table_objects)').all().map(c => c.name)
if (!tableObjectsCols.includes('available_from')) {
  db.prepare("ALTER TABLE table_objects ADD COLUMN available_from TEXT NOT NULL DEFAULT '10:00'").run()
  db.prepare("ALTER TABLE table_objects ADD COLUMN available_to TEXT NOT NULL DEFAULT '23:00'").run()
  db.prepare('ALTER TABLE table_objects ADD COLUMN slot_minutes INTEGER NOT NULL DEFAULT 90').run()
  console.log('[db] Migration: added availability window columns to table_objects')
}
if (!tableObjectsCols.includes('color')) {
  db.prepare('ALTER TABLE table_objects ADD COLUMN color TEXT').run()
  console.log('[db] Migration: added `color` column to table_objects')
}

const tableBookingsCols = db.prepare('PRAGMA table_info(table_bookings)').all().map(c => c.name)
if (!tableBookingsCols.includes('duration_minutes')) {
  db.prepare('ALTER TABLE table_bookings ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 90').run()
  console.log('[db] Migration: added `duration_minutes` column to table_bookings')
}
if (!tableBookingsCols.includes('source')) {
  db.prepare("ALTER TABLE table_bookings ADD COLUMN source TEXT NOT NULL DEFAULT 'online'").run()
  console.log('[db] Migration: added `source` column to table_bookings')
}
if (!tableBookingsCols.includes('user_id')) {
  db.prepare('ALTER TABLE table_bookings ADD COLUMN user_id TEXT').run()
  console.log('[db] Migration: added `user_id` column to table_bookings')
}
if (!tableBookingsCols.includes('telegram_chat_id')) {
  db.prepare('ALTER TABLE table_bookings ADD COLUMN telegram_chat_id TEXT').run()
  console.log('[db] Migration: added `telegram_chat_id` column to table_bookings')
}
if (!tableBookingsCols.includes('reminder_sent_at')) {
  db.prepare('ALTER TABLE table_bookings ADD COLUMN reminder_sent_at INTEGER').run()
  console.log('[db] Migration: added `reminder_sent_at` column to table_bookings')
}
if (!tableBookingsCols.includes('owner_confirmed_at')) {
  db.prepare('ALTER TABLE table_bookings ADD COLUMN owner_confirmed_at INTEGER').run()
  console.log('[db] Migration: added `owner_confirmed_at` column to table_bookings')
}
if (!tableBookingsCols.includes('occasion')) {
  db.prepare('ALTER TABLE table_bookings ADD COLUMN occasion TEXT').run()
  console.log('[db] Migration: added `occasion` column to table_bookings')
}
db.exec('CREATE INDEX IF NOT EXISTS idx_table_bookings_user ON table_bookings (user_id)')
// A table can now take more than one booking a day (different time slots), so
// the old "one booking per table per date" constraint no longer applies —
// conflicts are checked by overlapping time range at the app level instead.
db.exec('DROP INDEX IF EXISTS idx_table_bookings_unique_active')

// A place can now have several floors/terraces, so table_layouts can no
// longer keep its old "one row per place" UNIQUE(place_id) — SQLite can't
// drop that inline constraint with ALTER, so rebuild the table without it.
const tableLayoutsCols = db.prepare('PRAGMA table_info(table_layouts)').all().map(c => c.name)
if (!tableLayoutsCols.includes('name')) {
  db.pragma('foreign_keys = OFF')
  db.exec(`
    CREATE TABLE table_layouts_new (
      id TEXT PRIMARY KEY,
      place_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Основний зал',
      sort_order INTEGER NOT NULL DEFAULT 0,
      width INTEGER NOT NULL DEFAULT 900,
      height INTEGER NOT NULL DEFAULT 650,
      background TEXT NOT NULL DEFAULT '#F7F7F7',
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
    );
    INSERT INTO table_layouts_new (id, place_id, name, sort_order, width, height, background, updated_at)
      SELECT id, place_id, 'Основний зал', 0, width, height, background, updated_at FROM table_layouts;
    DROP TABLE table_layouts;
    ALTER TABLE table_layouts_new RENAME TO table_layouts;
    CREATE INDEX IF NOT EXISTS idx_table_layouts_place ON table_layouts (place_id);
  `)
  db.pragma('foreign_keys = ON')
  console.log('[db] Migration: table_layouts now supports multiple floors per place')
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
