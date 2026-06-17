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

function addDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM places').get()
  if (count.c > 0) return

  const insertPlace = db.prepare(`
    INSERT INTO places (id, name, type, city, address, description, cuisine, phone, working_hours, website, photos, tags, rating, published)
    VALUES (@id, @name, @type, @city, @address, @description, @cuisine, @phone, @workingHours, @website, @photos, @tags, @rating, 1)
  `)

  const places = [
    { id: '1', name: 'Модна Кухня', type: 'restaurant', city: 'Харків', address: 'вул. Сумська, 34', description: 'Сучасний ресторан з авторською українською кухнею. Шеф-кухар створює неповторні страви з місцевих продуктів, поєднуючи традиції з сучасними техніками. Атмосфера живого вогню та теплих тонів робить кожен вечір особливим.', cuisine: 'Українська', phone: '+380 57 123-45-67', workingHours: 'Пн–Нд: 12:00 – 23:00', website: 'https://modnakuhnya.ua', photos: JSON.stringify(['https://picsum.photos/seed/rest1main/800/600','https://picsum.photos/seed/rest1a/800/600','https://picsum.photos/seed/rest1b/800/600']), tags: JSON.stringify(['авторська кухня','романтична вечеря','бізнес-ланч']), rating: 4.8 },
    { id: '2', name: 'Espresso Lab', type: 'coffee', city: 'Харків', address: 'пр. Науки, 12', description: "Спеціалізована кав'ярня для справжніх цінителів кави. Моноориджин з 12 країн, авторські рецепти напоїв та домашня випічка. Тут кожна чашка — мала подорож.", cuisine: 'Авторська кава', phone: '+380 57 234-56-78', workingHours: 'Пн–Пт: 08:00 – 21:00, Сб–Нд: 09:00 – 22:00', website: '', photos: JSON.stringify(['https://picsum.photos/seed/coffe2main/800/600','https://picsum.photos/seed/coffe2a/800/600']), tags: JSON.stringify(['кава','сніданки','фрілансери']), rating: 4.7 },
    { id: '3', name: 'The Pub House', type: 'pub', city: 'Харків', address: 'вул. Пушкінська, 7', description: 'Затишний ірландський паб у серці Харкова. Широкий вибір крафтового пива від локальних броварень, живі спортивні трансляції та традиційна паб-їжа з домашньою атмосферою.', cuisine: 'Паб-їжа', phone: '+380 57 345-67-89', workingHours: 'Щодня: 15:00 – 02:00', website: '', photos: JSON.stringify(['https://picsum.photos/seed/pub1main/800/600','https://picsum.photos/seed/pub1a/800/600','https://picsum.photos/seed/pub1b/800/600']), tags: JSON.stringify(['пиво','спорт','жива музика','друзі']), rating: 4.5 },
    { id: '4', name: 'Сакура', type: 'restaurant', city: 'Харків', address: 'вул. Клочківська, 51', description: "Автентичний японський ресторан із майстер-класами з суші та традиційними стравами. Шеф-кухар навчався в Осаці. Мінімалістичний інтер'єр у стилі ваби-сабі.", cuisine: 'Японська', phone: '+380 57 456-78-90', workingHours: 'Пн–Нд: 12:00 – 22:30', website: '', photos: JSON.stringify(['https://picsum.photos/seed/japan1main/800/600','https://picsum.photos/seed/japan1a/800/600']), tags: JSON.stringify(['суші','майстер-клас','рамен']), rating: 4.6 },
    { id: '5', name: 'Картопляна Хата', type: 'restaurant', city: 'Київ', address: 'вул. Хрещатик, 15', description: "Легендарний київський ресторан традиційної української кухні. Вареники, борщ, деруни — все готується за старовинними рецептами бабусь. Інтер'єр у стилі сільської хати з сучасним комфортом.", cuisine: 'Українська', phone: '+380 44 123-45-67', workingHours: 'Щодня: 10:00 – 23:00', website: 'https://kartoplyana.ua', photos: JSON.stringify(['https://picsum.photos/seed/ukr1main/800/600','https://picsum.photos/seed/ukr1a/800/600','https://picsum.photos/seed/ukr1b/800/600']), tags: JSON.stringify(['борщ','вареники','традиційна кухня']), rating: 4.9 },
    { id: '6', name: 'Barista Way', type: 'coffee', city: 'Київ', address: 'вул. Велика Васильківська, 5', description: "Преміальна кав'ярня у центрі Києва. Авторські рецепти кави, свіжа випічка щодня та уважний сервіс. Ідеальне місце для зустрічей та роботи.", cuisine: 'Кава та снеки', phone: '+380 44 234-56-78', workingHours: 'Пн–Пт: 07:30 – 22:00, Сб–Нд: 08:00 – 23:00', website: '', photos: JSON.stringify(['https://picsum.photos/seed/coffe3main/800/600','https://picsum.photos/seed/coffe3a/800/600']), tags: JSON.stringify(['кава','сніданки','десерти']), rating: 4.6 },
    { id: '7', name: 'Italiano Vero', type: 'restaurant', city: 'Київ', address: 'вул. Андріївський узвіз, 10', description: 'Справжній італійський ресторан від шеф-кухаря з Риму. Паста, піца та ризото з імпортних інгредієнтів, найкращі вина Апеннінського півострова. Романтична атмосфера старого Рима.', cuisine: 'Італійська', phone: '+380 44 345-67-89', workingHours: 'Пн–Нд: 12:00 – 23:30', website: '', photos: JSON.stringify(['https://picsum.photos/seed/ital1main/800/600','https://picsum.photos/seed/ital1a/800/600','https://picsum.photos/seed/ital1b/800/600']), tags: JSON.stringify(['паста','піца','вино','романтика']), rating: 4.7 },
    { id: '8', name: 'SkyBar Lounge', type: 'lounge', city: 'Київ', address: 'вул. Хрещатик, 29, 18-й поверх', description: 'Панорамний лаундж-бар на 18 поверсі з приголомшливим видом на Київ. Авторські коктейлі від топ-бармена, DJ-вечірки щовихідних та VIP-обслуговування.', cuisine: 'Міжнародна', phone: '+380 44 456-78-90', workingHours: 'Чт–Нд: 18:00 – 04:00', website: 'https://skybar.ua', photos: JSON.stringify(['https://picsum.photos/seed/skybar1main/800/600','https://picsum.photos/seed/skybar1a/800/600','https://picsum.photos/seed/skybar1b/800/600']), tags: JSON.stringify(['коктейлі','DJ','панорама','вечірка','VIP']), rating: 4.8 },
    { id: '9', name: 'Вареничная №1', type: 'cafe', city: 'Полтава', address: 'вул. Жовтнева, 8', description: 'Затишне кафе з домашніми варениками та пиріжками. Понад 30 видів начинок — від класичних картоплі зі шкварками до авторського варенику з рикотою та полуницею.', cuisine: 'Домашня українська', phone: '+380 532 12-34-56', workingHours: 'Пн–Нд: 09:00 – 21:00', website: '', photos: JSON.stringify(['https://picsum.photos/seed/cafe1main/800/600','https://picsum.photos/seed/cafe1a/800/600']), tags: JSON.stringify(['вареники','домашня їжа','сніданки']), rating: 4.5 },
    { id: '10', name: 'Jazz Corner', type: 'bar', city: 'Полтава', address: 'вул. Пушкіна, 3', description: "Стильний джаз-бар із живою музикою щоп'ятниці та суботи. Широкий вибір вискі, авторські коктейлі та закуски. Місце, де час зупиняється.", cuisine: 'Закуски та напої', phone: '+380 532 23-45-67', workingHours: 'Ср–Нд: 17:00 – 01:00', website: '', photos: JSON.stringify(['https://picsum.photos/seed/jazz1main/800/600','https://picsum.photos/seed/jazz1a/800/600']), tags: JSON.stringify(['джаз','жива музика','виски','коктейлі']), rating: 4.7 },
    { id: '11', name: 'Стейкхаус Дніпро', type: 'restaurant', city: 'Дніпро', address: 'пр. Яворницького, 20', description: "М'ясний ресторан Дніпра. М'ясо від локальних фермерів, відкритий вугільний гриль, розкішний лофт-інтер'єр. Тут знають про стейк все.", cuisine: 'Стейкхаус', phone: '+380 56 123-45-67', workingHours: 'Пн–Нд: 12:00 – 23:00', website: '', photos: JSON.stringify(['https://picsum.photos/seed/steak1main/800/600','https://picsum.photos/seed/steak1a/800/600','https://picsum.photos/seed/steak1b/800/600']), tags: JSON.stringify(['стейк','гриль',"м'ясо","преміум"]), rating: 4.8 },
    { id: '12', name: 'Craft Beer Bar', type: 'bar', city: 'Дніпро', address: 'вул. Гоголя, 15', description: "Craft beer bar із 24 кранами та понад 100 видами пива у пляшках від локальних та світових броварень. Домашні бургери та снеки, живі виступи щоп'ятниці.", cuisine: 'Бургери та снеки', phone: '+380 56 234-56-78', workingHours: 'Пн–Нд: 15:00 – 02:00', website: '', photos: JSON.stringify(['https://picsum.photos/seed/beer1main/800/600','https://picsum.photos/seed/beer1a/800/600']), tags: JSON.stringify(['крафт пиво','бургери','live music']), rating: 4.6 },
    { id: '13', name: 'Море і Риба', type: 'restaurant', city: 'Одеса', address: 'Приморський бульвар, 5', description: 'Ресторан морської кухні з видом на море. Щоденна доставка свіжої риби та морепродуктів прямо з порту. Устриці, лангусти, дорадо на грилі — все тут.', cuisine: 'Морська', phone: '+380 48 123-45-67', workingHours: 'Пн–Нд: 11:00 – 23:00', website: 'https://more-ryba.ua', photos: JSON.stringify(['https://picsum.photos/seed/sea1main/800/600','https://picsum.photos/seed/sea1a/800/600','https://picsum.photos/seed/sea1b/800/600']), tags: JSON.stringify(['риба','морепродукти','вид на море','устриці']), rating: 4.9 },
    { id: '14', name: 'Французький Квартал', type: 'cafe', city: 'Одеса', address: 'вул. Дерибасівська, 12', description: "Паризька атмосфера у серці Одеси. Круасани, тарти, класичний французький кофе та легкі закуски. Все тісто готується щоранку з 5:00. C'est magnifique!", cuisine: 'Французька', phone: '+380 48 234-56-78', workingHours: 'Щодня: 08:00 – 22:00', website: '', photos: JSON.stringify(['https://picsum.photos/seed/french1main/800/600','https://picsum.photos/seed/french1a/800/600']), tags: JSON.stringify(['круасани','кава','французька випічка']), rating: 4.5 },
    { id: '15', name: 'Леопольс', type: 'restaurant', city: 'Львів', address: 'пл. Ринок, 9', description: "Ресторан у середньовічному будинку на площі Ринок. Авторська кухня на основі галицьких традицій, натуральні вина та камін. Гастрономічна перлина Львова.", cuisine: 'Європейська', phone: '+380 32 123-45-67', workingHours: 'Пн–Нд: 11:00 – 23:30', website: 'https://leopols.ua', photos: JSON.stringify(['https://picsum.photos/seed/lviv1main/800/600','https://picsum.photos/seed/lviv1a/800/600','https://picsum.photos/seed/lviv1b/800/600']), tags: JSON.stringify(['галицька кухня','туристам','камін','вино']), rating: 4.6 },
    { id: '16', name: "Кав'ярня Підземелля", type: 'coffee', city: 'Львів', address: 'вул. Вірменська, 35', description: "Унікальна кав'ярня у середньовічному підвалі 15-го століття. Авторська кава, шоколадні цукерки ручної роботи та магічна атмосфера кам'яних стін. Найбільш інстаграмне місце Львова.", cuisine: "Кава та шоколад", phone: '+380 32 234-56-78', workingHours: 'Щодня: 10:00 – 22:00', website: '', photos: JSON.stringify(['https://picsum.photos/seed/lvivcoffe1main/800/600','https://picsum.photos/seed/lvivcoffe1a/800/600']), tags: JSON.stringify(['кава','шоколад','унікальна атмосфера','туристам']), rating: 4.8 },
  ]

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insertPlace.run(row)
  })
  insertMany(places)

  // Seed events with future dates
  const insertEvent = db.prepare(`
    INSERT INTO events (id, place_id, title, description, date, time, type, price, image)
    VALUES (@id, @placeId, @title, @description, @date, @time, @type, @price, @image)
  `)

  const events = [
    { id: 'e1', placeId: '13', title: 'Вечір морських делікатесів', description: "Спеціальне меню зі свіжих морепродуктів та живою музикою. Устриці, краби, лобстери за спеціальними цінами. Попереднє замовлення обов'язкове.", date: addDays(2), time: '18:00', type: 'theme_night', price: 0, image: 'https://picsum.photos/seed/event_sea1/800/400' },
    { id: 'e2', placeId: '10', title: 'Jazz Friday Night', description: 'Живий джаз від квартету Jazz Brothers. Стандарти Дюка Еллінгтона та Майлза Девіса в атмосфері теплих вогнів.', date: addDays(3), time: '20:00', type: 'jazz', price: 150, image: 'https://picsum.photos/seed/event_jazz1/800/400' },
    { id: 'e3', placeId: '8', title: 'DJ Maxim Loud: House Party', description: 'Відомий київський DJ Maxim Loud зіграє 5-годинний сет. Авторські коктейлі від бармена та панорамний вид на нічне місто.', date: addDays(4), time: '22:00', type: 'dj', price: 300, image: 'https://picsum.photos/seed/event_dj1/800/400' },
    { id: 'e4', placeId: '3', title: 'Live Band: The Rovers', description: 'Ірландський рок-гурт The Rovers грає класику pub rock. Спеціальні ціни на пиво весь вечір.', date: addDays(4), time: '20:00', type: 'live_music', price: 0, image: 'https://picsum.photos/seed/event_live1/800/400' },
    { id: 'e5', placeId: '4', title: 'Майстер-клас: Суші від шеф-кухаря', description: 'Навчіться готувати справжні японські суші та роли від нашого шеф-кухаря. Включає всі інгредієнти та дегустацію готових страв.', date: addDays(6), time: '17:00', type: 'master_class', price: 450, image: 'https://picsum.photos/seed/event_sushi1/800/400' },
    { id: 'e6', placeId: '7', title: 'Вечір Тосканських вин', description: 'Дегустація 8 вин з Тоскани з коментарями сомельє. Паринг з авторськими закусками шеф-кухаря. Кількість місць обмежена.', date: addDays(7), time: '19:00', type: 'wine', price: 550, image: 'https://picsum.photos/seed/event_wine1/800/400' },
    { id: 'e7', placeId: '12', title: 'Spring Craft Beer Festival', description: 'Фестиваль весняного крафтового пива. 15 броварень, живі виступи та конкурс на знання пива. Найбільша пивна подія Дніпра!', date: addDays(9), time: '16:00', type: 'beer', price: 200, image: 'https://picsum.photos/seed/event_beer1/800/400' },
    { id: 'e8', placeId: '16', title: "Тиждень Львівської кави", description: "Щоденні каппінги, майстер-класи від барист та дегустації рідкісних моноориджинів. Занурення у світ спеціалізованої кави.", date: addDays(10), time: '11:00', type: 'master_class', price: 100, image: 'https://picsum.photos/seed/event_coffee1/800/400' },
    { id: 'e9', placeId: '1', title: 'Гала-вечеря від шефа', description: "Авторське 7-страв дегустаційне меню від шеф-кухаря Андрія Дудника. Обмежено 30 місцями. Обов'язкова резервація.", date: addDays(11), time: '19:30', type: 'theme_night', price: 800, image: 'https://picsum.photos/seed/event_gala1/800/400' },
    { id: 'e10', placeId: '8', title: 'RnB Night with DJ Smooth', description: 'Найкращий RnB та Soul від DJ Smooth. Зустрічайте вихідні на висоті 18-го поверху з коктейлем у руці!', date: addDays(17), time: '23:00', type: 'dj', price: 200, image: 'https://picsum.photos/seed/event_rnb1/800/400' },
  ]

  const insertEvents = db.transaction((rows) => {
    for (const row of rows) insertEvent.run(row)
  })
  insertEvents(events)

  // Seed users with hashed passwords
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, role, name, place_id, is_active, created_at)
    VALUES (@id, @email, @passwordHash, @role, @name, @placeId, @isActive, @createdAt)
  `)

  const users = [
    { id: 'u1', email: 'admin@goout.ua', password: 'Admin2024', role: 'superadmin', name: 'Головний адміністратор', placeId: null },
    { id: 'u2', email: 'modna@goout.ua', password: 'venue123', role: 'venue', name: 'Модна Кухня', placeId: '1' },
    { id: 'u3', email: 'skybar@goout.ua', password: 'venue123', role: 'venue', name: 'SkyBar Lounge', placeId: '8' },
    { id: 'u4', email: 'jazzbar@goout.ua', password: 'venue123', role: 'venue', name: 'Jazz Corner', placeId: '10' },
  ]

  const now = new Date().toISOString()
  const insertUsersT = db.transaction((rows) => {
    for (const u of rows) {
      const hash = bcrypt.hashSync(u.password, 10)
      insertUser.run({ id: u.id, email: u.email, passwordHash: hash, role: u.role, name: u.name, placeId: u.placeId, isActive: 1, createdAt: now })
    }
  })
  insertUsersT(users)

  console.log('Database seeded.')
}

seedIfEmpty()

module.exports = db
