const path = require('path')
const express = require('express')
const db = require('../db')
const { renderPageHtml, buildSitemapXml, APP_URL } = require('../seo')

const router = express.Router()

// Mirrors src/data/initialData.js's COLLECTIONS slugs — duplicated here
// because that file is an ES module the CommonJS server can't require, and
// the category list changes rarely enough that keeping two short arrays in
// sync by hand is simpler than wiring up a build step to share it.
const COLLECTION_SLUGS = [
  'romantic_evening', 'business_lunch_spot', 'corporate_party', 'morning_coffee',
  'live_music_night', 'summer_terrace_spot', 'karaoke_night', 'dance_night',
  'date_spot', 'beer_spot', 'pizza_spot', 'burger_spot', 'hookah_spot',
  'sushi_spot', 'cocktail_spot', 'board_games_spot', 'playstation_spot', 'cultural_event',
]

const STATIC_PAGES = ['/', '/events', '/collections', '/about', '/contacts', '/terms', '/refund-policy']

module.exports = function seoPagesRouter(distPath) {
  const sendDefault = (res) => res.sendFile(path.join(distPath, 'index.html'))

  // /place/:id — swaps in the venue's real name/description/photo so a
  // shared link previews correctly instead of showing the generic site tags.
  router.get('/place/:id', (req, res) => {
    const place = db.prepare('SELECT * FROM places WHERE id = ? AND published = 1').get(req.params.id)
    if (!place) return sendDefault(res)
    const photos = JSON.parse(place.photos || '[]')
    const html = renderPageHtml(distPath, {
      title: `${place.name} — ${place.city} | View`,
      description: place.description || `${place.name} у ${place.city} — фото, адреса та контакти на View.`,
      image: photos[0],
      url: `${APP_URL}/place/${place.id}`,
    })
    res.send(html)
  })

  router.get('/event/:id', (req, res) => {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id)
    if (!event) return sendDefault(res)
    const html = renderPageHtml(distPath, {
      title: `${event.title} | View`,
      description: event.description || 'Подія на View — дата, час та деталі заходу.',
      image: event.image,
      url: `${APP_URL}/event/${event.id}`,
      type: 'article',
    })
    res.send(html)
  })

  router.get('/curated/:id', (req, res) => {
    const list = db.prepare('SELECT * FROM curated_lists WHERE id = ? AND active = 1').get(req.params.id)
    if (!list) return sendDefault(res)
    const html = renderPageHtml(distPath, {
      title: `${list.title} — підбірка від ${list.author_name} | View`,
      description: `Підбірка закладів «${list.title}» від ${list.author_name} на View.`,
      image: list.cover_image,
      url: `${APP_URL}/curated/${list.id}`,
    })
    res.send(html)
  })

  router.get('/sitemap.xml', (_req, res) => {
    const places = db.prepare('SELECT id FROM places WHERE published = 1').all()
    const events = db.prepare('SELECT id FROM events').all()
    const curatedLists = db.prepare('SELECT id FROM curated_lists WHERE active = 1').all()

    const entries = [
      ...STATIC_PAGES.map(p => ({ path: p, changefreq: 'daily', priority: p === '/' ? 1.0 : 0.6 })),
      ...COLLECTION_SLUGS.map(slug => ({ path: `/collections/${slug}`, changefreq: 'weekly', priority: 0.5 })),
      ...places.map(p => ({ path: `/place/${p.id}`, changefreq: 'weekly', priority: 0.8 })),
      ...events.map(e => ({ path: `/event/${e.id}`, changefreq: 'daily', priority: 0.7 })),
      ...curatedLists.map(l => ({ path: `/curated/${l.id}`, changefreq: 'weekly', priority: 0.5 })),
    ]

    res.type('application/xml').send(buildSitemapXml(entries))
  })

  return router
}
