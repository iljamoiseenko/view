const db = require('./db')
const { kyivDateString } = require('./kyivDate')

// Telegram doesn't let a bot message someone who hasn't messaged it first —
// so linking always starts with the *user* opening a t.me/<bot>?start=<token>
// link and pressing Start. We generate that token, hand the guest/owner a
// ready link, and long-poll getUpdates for the resulting /start <token> to
// find out who just linked and attach their chat_id to the right place.
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || ''
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const APP_URL = process.env.APP_URL || 'https://viewtoday.site'
// Telegram validates inline-button URLs server-side and rejects anything
// that isn't a real public address — localhost (the local-dev APP_URL)
// fails with "Wrong HTTP URL" and silently kills the *entire* message, not
// just the button. Fall back to the production domain for bot buttons
// specifically so local testing doesn't break; APP_URL itself stays pointed
// at localhost for other local-dev links (password reset emails etc).
const BOT_BUTTON_URL = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(APP_URL) ? 'https://viewtoday.site' : APP_URL

const enabled = !!BOT_TOKEN

function randomToken() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}

// kind: 'owner' (target_id = users.id) | 'booking' (target_id = table_bookings.id)
function createLinkToken(kind, targetId) {
  if (!enabled) return null
  const token = randomToken()
  db.prepare('INSERT INTO telegram_tokens (token, kind, target_id, created_at) VALUES (?, ?, ?, ?)')
    .run(token, kind, targetId, Date.now())
  return `https://t.me/${BOT_USERNAME}?start=${token}`
}

async function sendMessage(chatId, text, replyMarkup) {
  if (!enabled || !chatId) return
  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', reply_markup: replyMarkup }),
    })
    // fetch() only rejects on a network failure — a 4xx (e.g. broken HTML in
    // `text` from an unescaped guest/place name) resolves normally and would
    // otherwise fail completely silently, looking like "nothing happened".
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[telegram] sendMessage failed', res.status, body)
    }
  } catch (err) {
    console.error('[telegram] sendMessage network error', err)
  }
}

async function answerCallbackQuery(id, text, showAlert) {
  if (!enabled) return
  try {
    await fetch(`${API_BASE}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: id, text, show_alert: !!showAlert }),
    })
  } catch {
    // Best-effort.
  }
}

// Swaps the button row(s) on an already-sent message in place — used for the
// tap-to-confirm cancel flow, so tapping "❌" doesn't cancel immediately but
// doesn't spam a new message either.
async function editMessageReplyMarkup(chatId, messageId, replyMarkup) {
  if (!enabled) return
  try {
    const res = await fetch(`${API_BASE}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[telegram] editMessageReplyMarkup failed', res.status, body)
    }
  } catch (err) {
    console.error('[telegram] editMessageReplyMarkup network error', err)
  }
}

// A message can list several bookings, each its own row — replace only the
// one row whose button matches this exact callback_data, leaving every
// other booking's row (and the "book more" row) untouched.
function replaceRowByCallbackData(keyboard, targetCallbackData, newRow) {
  const rows = keyboard?.inline_keyboard || []
  return {
    inline_keyboard: rows.map(row => (
      row.some(btn => btn.callback_data === targetCallbackData) ? newRow : row
    )),
  }
}

// Rebuilt fresh from the DB rather than remembered, so "Ні" after a confirm
// prompt restores a correct row even if this booking's own data changed
// in the meantime (or falls back to a generic label if it's gone).
function buildCancelRow(bookingId) {
  const b = db.prepare(`
    SELECT b.date, b.time, p.name AS place_name
    FROM table_bookings b JOIN places p ON p.id = b.place_id
    WHERE b.id = ?
  `).get(bookingId)
  const text = b ? `❌ ${b.place_name}, ${b.date} ${b.time}` : '❌ Скасувати бронювання'
  return [{ text, callback_data: `cancel:${bookingId}` }]
}

function confirmCancelRow(bookingId) {
  return [
    { text: '✅ Так, скасувати', callback_data: `cancelyes:${bookingId}` },
    { text: '↩️ Ні', callback_data: `cancelno:${bookingId}` },
  ]
}

// Surfaces /start and /mybookings in Telegram's own command menu (the "/"
// button next to the message box) instead of leaving them as text-only
// commands the guest has to already know about. Safe to call on every boot —
// Telegram just overwrites the list with the same values.
async function setBotCommands() {
  if (!enabled) return
  try {
    await fetch(`${API_BASE}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start', description: 'Почати роботу з ботом' },
          { command: 'mybookings', description: 'Мої бронювання' },
        ],
      }),
    })
  } catch {
    // Best-effort.
  }
}

function cancelKeyboard(bookingId) {
  return { inline_keyboard: [[{ text: '❌ Скасувати бронювання', callback_data: `cancel:${bookingId}` }]] }
}

// Confirm and cancel live in separate rows (not side by side) so the
// tap-to-confirm-cancel flow can swap just the cancel row without also
// wiping out the unrelated "✅ Підтвердити" button next to it.
function ownerNotificationKeyboard(bookingId) {
  return {
    inline_keyboard: [
      [{ text: '✅ Підтвердити', callback_data: `confirm:${bookingId}` }],
      [{ text: '❌ Скасувати бронювання', callback_data: `cancel:${bookingId}` }],
    ],
  }
}

function formatBookingSummary(booking, placeName) {
  return (
    `<b>${placeName}</b>\n` +
    `${booking.date} о ${booking.time}, стіл «${booking.tableLabel || ''}»\n` +
    `Гостей: ${booking.partySize}`
  )
}

// Keep in sync with BOOKING_OCCASIONS / tableBooking.occasions.* in the frontend.
const OCCASION_LABELS = {
  birthday: '🎂 День народження',
  friends: '🧑‍🤝‍🧑 Зустріч з друзями',
  date: '💑 Побачення',
  family: '👨‍👩‍👧 Сімейна зустріч',
  business: '💼 Ділова зустріч',
  celebration: '🎉 Особлива подія',
  other: 'Інше',
}

function formatOwnerNotification(booking, placeName) {
  const guestLine = [booking.guestName, booking.guestPhone].filter(Boolean).join(', ')
  return (
    `🔔 <b>Нове бронювання — ${placeName}</b>\n` +
    `${booking.date} о ${booking.time}, столик ${booking.tableLabel || '—'}\n` +
    (guestLine ? `${guestLine}\n` : '') +
    `Гостей: ${booking.partySize}` +
    (booking.occasion && OCCASION_LABELS[booking.occasion] ? `\nПривід: ${OCCASION_LABELS[booking.occasion]}` : '') +
    (booking.note ? `\nКоментар: ${booking.note}` : '')
  )
}

// Notify the venue's owner account, if they've connected Telegram.
async function notifyOwnerOfBooking(placeId, booking) {
  if (!enabled) return
  try {
    const row = db.prepare(`
      SELECT u.telegram_chat_id, p.name AS place_name
      FROM users u JOIN places p ON p.id = u.place_id
      WHERE u.place_id = ? AND u.role = 'venue'
    `).get(placeId)
    if (!row?.telegram_chat_id) return
    await sendMessage(row.telegram_chat_id, formatOwnerNotification(booking, row.place_name), ownerNotificationKeyboard(booking.id))
  } catch {
    // Fire-and-forget from the booking routes — never let a notification
    // failure surface as a booking failure.
  }
}

// Notify a guest who already had Telegram linked (from an earlier booking)
// that this new booking went through — an unlinked guest instead gets a
// "Connect Telegram" link on the success screen, since a bot can never
// message someone who hasn't pressed Start with it first.
async function notifyGuestOfBooking(chatId, booking, placeName) {
  if (!enabled || !chatId) return
  try {
    await sendMessage(chatId, `Ваше бронювання:\n\n${formatBookingSummary(booking, placeName)}`)
  } catch {
    // Fire-and-forget from the booking routes — never let a notification
    // failure surface as a booking failure.
  }
}

// Resolve a /start <token> into a chat_id link — called from the polling loop.
function resolveStartToken(token, chatId) {
  const row = db.prepare('SELECT * FROM telegram_tokens WHERE token = ?').get(token)
  if (!row || row.used_at) return { ok: false }
  if (Date.now() - row.created_at > TOKEN_TTL_MS) return { ok: false, expired: true }

  db.prepare('UPDATE telegram_tokens SET used_at = ? WHERE token = ?').run(Date.now(), token)

  if (row.kind === 'owner') {
    db.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(chatId, row.target_id)
    return { ok: true, kind: 'owner' }
  }

  if (row.kind === 'booking') {
    const booking = db.prepare(`
      SELECT b.*, o.label AS table_label, p.name AS place_name
      FROM table_bookings b
      JOIN table_objects o ON o.id = b.table_id
      JOIN places p ON p.id = b.place_id
      WHERE b.id = ?
    `).get(row.target_id)
    if (!booking) return { ok: false }
    // Remember which chat asked to be told about this specific booking — lets
    // the cancel button later verify "is this really the guest who booked it"
    // without needing them to have a full account.
    db.prepare('UPDATE table_bookings SET telegram_chat_id = ? WHERE id = ?').run(chatId, booking.id)
    // If this booking belongs to a logged-in guest account, remember the
    // chat_id on their account too — future bookings get notified automatically.
    if (booking.user_id) {
      db.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(chatId, booking.user_id)
    }
    return {
      ok: true,
      kind: 'booking',
      bookingId: booking.id,
      message: formatBookingSummary({
        date: booking.date, time: booking.time, partySize: booking.party_size, tableLabel: booking.table_label,
      }, booking.place_name),
    }
  }

  return { ok: false }
}

// A tap on the "❌ Скасувати бронювання" inline button — authorized if the
// tapping chat is either the guest who linked this exact booking, or the
// venue's connected owner account. Cancels and best-effort notifies whichever
// side didn't do the cancelling.
async function handleCancelCallback(chatId, bookingId) {
  const booking = db.prepare(`
    SELECT b.*, o.label AS table_label, p.name AS place_name
    FROM table_bookings b
    JOIN table_objects o ON o.id = b.table_id
    JOIN places p ON p.id = b.place_id
    WHERE b.id = ?
  `).get(bookingId)
  if (!booking) return { text: 'Бронювання не знайдено.', alert: true }
  if (booking.status === 'cancelled') return { text: 'Це бронювання вже скасовано.', alert: true }

  const owner = db.prepare(`SELECT telegram_chat_id FROM users WHERE place_id = ? AND role = 'venue'`).get(booking.place_id)
  const isGuest = booking.telegram_chat_id && String(booking.telegram_chat_id) === String(chatId)
  const isOwner = owner?.telegram_chat_id && String(owner.telegram_chat_id) === String(chatId)
  if (!isGuest && !isOwner) return { text: 'Ви не можете скасувати це бронювання.', alert: true }

  db.prepare("UPDATE table_bookings SET status = 'cancelled' WHERE id = ?").run(bookingId)

  const summary = `Столик «${booking.table_label}» о ${booking.time}, ${booking.date}`
  if (isGuest && owner?.telegram_chat_id) {
    sendMessage(owner.telegram_chat_id, `❌ <b>Гість скасував бронювання</b>\n${summary}\n${booking.guest_name}, ${booking.guest_phone}`)
  }
  if (isOwner && booking.telegram_chat_id) {
    sendMessage(booking.telegram_chat_id, `❌ <b>Заклад скасував ваше бронювання</b>\n${summary}`)
  }

  return { text: '✅ Бронювання скасовано.' }
}

// A tap on "✅ Підтвердити" in the owner's own notification — just marks that
// staff has seen/acknowledged the booking (no separate "pending" status
// exists; the booking is already confirmed the moment a guest books it).
// Only the venue's connected owner chat can do this, since the button only
// ever appears in that notification.
async function handleOwnerConfirm(chatId, bookingId) {
  const booking = db.prepare(`
    SELECT b.*, o.label AS table_label, p.name AS place_name
    FROM table_bookings b
    JOIN table_objects o ON o.id = b.table_id
    JOIN places p ON p.id = b.place_id
    WHERE b.id = ?
  `).get(bookingId)
  if (!booking) return { text: 'Бронювання не знайдено.', alert: true }
  if (booking.status === 'cancelled') return { text: 'Це бронювання вже скасовано.', alert: true }

  const owner = db.prepare(`SELECT telegram_chat_id FROM users WHERE place_id = ? AND role = 'venue'`).get(booking.place_id)
  if (!owner?.telegram_chat_id || String(owner.telegram_chat_id) !== String(chatId)) {
    return { text: 'Недоступно.', alert: true }
  }

  db.prepare('UPDATE table_bookings SET owner_confirmed_at = ? WHERE id = ?').run(Date.now(), bookingId)

  // Older bookings made before per-booking auto-linking may not carry their
  // own chat_id even though the guest's account already has Telegram
  // connected (from a later booking, say) — fall back to that.
  const guestChatId = booking.telegram_chat_id ||
    (booking.user_id && db.prepare('SELECT telegram_chat_id FROM users WHERE id = ?').get(booking.user_id)?.telegram_chat_id)
  if (guestChatId) {
    const summary = formatBookingSummary({
      date: booking.date, time: booking.time, partySize: booking.party_size, tableLabel: booking.table_label,
    }, booking.place_name)
    sendMessage(guestChatId, `✅ <b>Заклад підтвердив ваше бронювання</b>\n${summary}`)
  }

  return { text: '✅ Підтверджено' }
}

// Keep only digits, then the last 9 — long enough to tell Ukrainian mobile
// numbers apart, short enough to match regardless of whether the +380/0
// prefix (or spaces/dashes) is present, so "+380501234567" and "0501234567"
// resolve to the same person.
function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '').slice(-9)
}

function looksLikePhoneText(text) {
  const digits = (text || '').replace(/\D/g, '')
  return digits.length >= 9 && digits.length <= 15
}

// Any upcoming, still-confirmed booking whose phone normalizes to the same
// digits — across every venue, not just one. The booking table isn't large
// enough at this scale to need a real index for this, so it's a plain scan.
function findBookingsByPhone(phone) {
  const target = normalizePhone(phone)
  if (target.length < 7) return []
  const today = kyivDateString()
  const rows = db.prepare(`
    SELECT b.*, o.label AS table_label, p.name AS place_name
    FROM table_bookings b
    JOIN table_objects o ON o.id = b.table_id
    JOIN places p ON p.id = b.place_id
    WHERE b.status = 'confirmed' AND b.date >= ?
    ORDER BY b.date ASC, b.time ASC
  `).all(today)
  return rows.filter(r => normalizePhone(r.guest_phone) === target)
}

const BOOK_MORE_BUTTON = { text: '📅 Забронювати ще', url: BOT_BUTTON_URL }
const BOOK_TABLE_BUTTON = { text: '🍽️ Забронювати столик', url: BOT_BUTTON_URL }

// Shared by both entry points into "show my bookings" — a direct chat_id
// lookup (already linked) and a phone lookup (not linked yet). `moreButton`
// differs: "book another" once they already have one, vs. a plain "book a
// table" when the list turns out empty.
function formatBookingsList(bookings, moreButton) {
  if (bookings.length === 0) {
    return {
      text: 'У вас немає активних бронювань.',
      keyboard: { inline_keyboard: [[moreButton]] },
    }
  }
  const lines = bookings.map(b => `• <b>${b.place_name}</b> — ${b.date} о ${b.time}, стіл «${b.table_label}»`)
  return {
    text: `Ваші бронювання:\n\n${lines.join('\n')}`,
    keyboard: {
      inline_keyboard: [
        ...bookings.map(b => ([{
          text: `❌ ${b.place_name}, ${b.date} ${b.time}`,
          callback_data: `cancel:${b.id}`,
        }])),
        [BOOK_MORE_BUTTON],
      ],
    },
  }
}

// Any upcoming, still-confirmed booking already linked to this exact chat —
// from a booking-confirmation link, a past phone lookup, or a reminder.
function findBookingsByChatId(chatId) {
  const today = kyivDateString()
  return db.prepare(`
    SELECT b.*, o.label AS table_label, p.name AS place_name
    FROM table_bookings b
    JOIN table_objects o ON o.id = b.table_id
    JOIN places p ON p.id = b.place_id
    WHERE b.status = 'confirmed' AND b.date >= ? AND b.telegram_chat_id = ?
    ORDER BY b.date ASC, b.time ASC
  `).all(today, String(chatId))
}

// /mybookings — shows whatever's already linked to this chat directly, no
// need to re-type a phone number every time.
async function sendMyBookings(chatId) {
  const bookings = findBookingsByChatId(chatId)
  const { text, keyboard } = formatBookingsList(bookings, BOOK_TABLE_BUTTON)
  await sendMessage(chatId, text, keyboard)
}

// Someone who isn't coming from a booking-specific deep link — they just
// found the bot, or shared/typed a phone number to check what's booked under
// it. Same trust model as the anonymous website booking form: the phone
// number itself is the only "credential" (no SMS/OTP verification exists
// anywhere in this app yet), so whoever can type or share it can see and
// cancel those bookings — sharing a Telegram contact is actually the
// stronger case, since Telegram itself verified that number belongs to them.
async function handlePhoneLookup(chatId, phone) {
  const bookings = findBookingsByPhone(phone)
  if (bookings.length > 0) {
    const ids = bookings.map(b => b.id)
    const placeholders = ids.map(() => '?').join(',')
    db.prepare(`UPDATE table_bookings SET telegram_chat_id = ? WHERE id IN (${placeholders})`).run(String(chatId), ...ids)
  }
  const { text, keyboard } = formatBookingsList(bookings, BOOK_TABLE_BUTTON)
  await sendMessage(chatId, text, keyboard)
}

const PHONE_PROMPT_KEYBOARD = {
  keyboard: [[{ text: '📱 Поділитися номером', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
}

// ── Reminders ────────────────────────────────────────────────────────────
// Only reaches guests who linked a chat to their specific booking (via the
// post-booking Telegram link or the phone-lookup flow) — there's no other
// way to message someone who never started a chat with the bot. Same
// date+time parsing caveat as the rest of the app: no stored timezone, so
// this trusts the server's local clock to match the venue's.
const REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000
const REMINDER_CHECK_INTERVAL_MS = 5 * 60 * 1000

function formatReminderMessage(booking, placeName) {
  return (
    `⏰ <b>Нагадування про бронювання</b>\n` +
    `Через 2 години у вас бронь у закладі «${placeName}»\n` +
    `${booking.date} о ${booking.time}, стіл «${booking.tableLabel || ''}»`
  )
}

async function sendDueReminders() {
  if (!enabled) return
  const now = Date.now()
  const rows = db.prepare(`
    SELECT b.*, o.label AS table_label, p.name AS place_name
    FROM table_bookings b
    JOIN table_objects o ON o.id = b.table_id
    JOIN places p ON p.id = b.place_id
    WHERE b.status = 'confirmed' AND b.reminder_sent_at IS NULL AND b.telegram_chat_id IS NOT NULL
  `).all()

  for (const booking of rows) {
    const bookingAt = new Date(`${booking.date}T${booking.time}:00`).getTime()
    if (Number.isNaN(bookingAt)) continue
    const msUntil = bookingAt - now
    if (msUntil <= 0 || msUntil > REMINDER_WINDOW_MS) continue

    // Mark first so a slow send (or a crash mid-loop) can't fire it twice.
    db.prepare('UPDATE table_bookings SET reminder_sent_at = ? WHERE id = ?').run(now, booking.id)
    await sendMessage(
      booking.telegram_chat_id,
      formatReminderMessage(booking, booking.place_name),
      cancelKeyboard(booking.id),
    )
  }
}

function startReminderLoop() {
  if (!enabled) return
  setInterval(() => { sendDueReminders().catch(() => {}) }, REMINDER_CHECK_INTERVAL_MS)
  console.log('[telegram] Reminder loop started')
}

// ── Long polling ─────────────────────────────────────────────────────────
// Simpler than a webhook: no public HTTPS URL needed, works the same in
// local dev and in production. Fine at this scale (one bot, low traffic).
let offset = 0
let polling = false

async function handleUpdate(update) {
  const callback = update.callback_query
  if (callback) {
    const chatId = callback.message?.chat?.id
    const messageId = callback.message?.message_id
    const currentMarkup = callback.message?.reply_markup
    const data = callback.data || ''

    // Step 1: tapping the booking's own "❌" row swaps it for a Так/Ні
    // confirmation — nothing is cancelled yet.
    const askMatch = /^cancel:(.+)$/.exec(data)
    if (askMatch && chatId && messageId) {
      const bookingId = askMatch[1]
      await editMessageReplyMarkup(chatId, messageId, replaceRowByCallbackData(currentMarkup, data, confirmCancelRow(bookingId)))
      await answerCallbackQuery(callback.id)
      return
    }

    // Step 2a: "Так" — actually cancel, same auth rules as before, then drop
    // that row (nothing left to confirm) and send the result as its own message.
    const yesMatch = /^cancelyes:(.+)$/.exec(data)
    if (yesMatch && chatId) {
      const bookingId = yesMatch[1]
      const result = await handleCancelCallback(String(chatId), bookingId)
      await answerCallbackQuery(callback.id, result.text, result.alert)
      if (messageId) {
        const rows = (currentMarkup?.inline_keyboard || []).filter(row => !row.some(btn => btn.callback_data === data))
        await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: rows })
      }
      if (!result.alert) await sendMessage(chatId, result.text)
      return
    }

    // Step 2b: "Ні" — abort, put the plain cancel row back.
    const noMatch = /^cancelno:(.+)$/.exec(data)
    if (noMatch && chatId && messageId) {
      const bookingId = noMatch[1]
      await editMessageReplyMarkup(chatId, messageId, replaceRowByCallbackData(currentMarkup, data, buildCancelRow(bookingId)))
      await answerCallbackQuery(callback.id)
      return
    }

    // "✅ Підтвердити" on the owner's own notification — one tap, no confirm
    // step needed (unlike cancelling, there's nothing destructive to double-check).
    const confirmMatch = /^confirm:(.+)$/.exec(data)
    if (confirmMatch && chatId) {
      const bookingId = confirmMatch[1]
      const result = await handleOwnerConfirm(String(chatId), bookingId)
      await answerCallbackQuery(callback.id, result.text, result.alert)
      if (!result.alert && messageId) {
        const rows = (currentMarkup?.inline_keyboard || [])
          .map(row => row.filter(btn => btn.callback_data !== data))
          .filter(row => row.length > 0)
        await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: rows })
      }
      return
    }

    await answerCallbackQuery(callback.id)
    return
  }

  const msg = update.message
  const chatId = msg?.chat?.id
  if (!chatId) return

  if (msg.contact?.phone_number) {
    await handlePhoneLookup(chatId, msg.contact.phone_number)
    return
  }

  const text = msg.text || ''

  const match = /^\/start(?:\s+(\S+))?/.exec(text)
  if (match) {
    const token = match[1]
    if (!token) {
      await sendMessage(
        chatId,
        'Привіт! Тут можна:\n' +
        '— переглянути й скасувати свої бронювання за номером телефону\n' +
        '— отримувати сповіщення (якщо перейшли за посиланням із сайту чи кабінету)\n\n' +
        'Надішліть номер телефону, яким бронювали столик, або поділіться контактом.',
        PHONE_PROMPT_KEYBOARD,
      )
      return
    }
    const result = resolveStartToken(token, String(chatId))
    if (result.ok && result.kind === 'owner') {
      await sendMessage(chatId, '✅ Сповіщення про нові бронювання підключено.')
    } else if (result.ok && result.kind === 'booking') {
      await sendMessage(chatId, `Ваше бронювання:\n\n${result.message}`, {
        inline_keyboard: [
          [{ text: '❌ Скасувати бронювання', callback_data: `cancel:${result.bookingId}` }],
          [BOOK_MORE_BUTTON],
        ],
      })
    } else if (result.expired) {
      await sendMessage(chatId, 'Це посилання застаріло. Спробуйте ще раз.')
    } else {
      await sendMessage(chatId, 'Це посилання вже використано або недійсне.')
    }
    return
  }

  if (/^\/mybookings/.test(text)) {
    await sendMyBookings(chatId)
    return
  }

  if (looksLikePhoneText(text)) {
    await handlePhoneLookup(chatId, text)
  }
}

async function pollOnce() {
  const res = await fetch(`${API_BASE}/getUpdates?timeout=25&offset=${offset}`)
  const data = await res.json()
  if (!data.ok) return
  for (const update of data.result) {
    offset = update.update_id + 1
    try {
      await handleUpdate(update)
    } catch (err) {
      // A bug in one handler shouldn't silently swallow the update with no
      // trace — log it so a "nothing happened" report is diagnosable, and
      // keep processing the rest of the batch instead of aborting pollOnce.
      console.error('[telegram] Failed to handle update', update.update_id, err)
    }
  }
}

async function pollLoop() {
  while (polling) {
    try {
      await pollOnce()
    } catch {
      await new Promise(r => setTimeout(r, 3000))
    }
  }
}

function startPolling() {
  if (!enabled || polling) return
  polling = true
  setBotCommands()
  pollLoop()
  startReminderLoop()
  console.log('[telegram] Bot polling started')
}

module.exports = { enabled, createLinkToken, notifyOwnerOfBooking, notifyGuestOfBooking, startPolling }
