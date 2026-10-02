const fs = require('fs')
const path = require('path')

const APP_URL = process.env.APP_URL || 'https://viewtoday.site'
const DEFAULT_IMAGE = `${APP_URL}/favicon.png`

// dist/index.html is a static build artifact — read it once and reuse the
// string for every request instead of hitting the filesystem each time.
let cachedHtml = null
function loadIndexHtml(distPath) {
  if (!cachedHtml) cachedHtml = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8')
  return cachedHtml
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Strips HTML/markdown-ish leftovers and collapses whitespace so a venue's
// free-text description reads cleanly as a one-line meta description.
function toPlainSummary(text, maxLen = 200) {
  const plain = String(text || '').replace(/\s+/g, ' ').trim()
  return plain.length > maxLen ? `${plain.slice(0, maxLen - 1)}…` : plain
}

// A stored photo/image can be an absolute URL (pasted in by an admin) or a
// relative one from our own /uploads — OG/Twitter image tags require an
// absolute URL either way.
function toAbsoluteUrl(url) {
  if (!url) return DEFAULT_IMAGE
  return /^https?:\/\//.test(url) ? url : `${APP_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

// Swaps the page's default <title>/meta tags (see index.html) for real
// content — this is what makes a shared /place or /event link show the
// venue's actual name/photo in Telegram, Facebook, etc. Those bots don't
// execute JS, so this has to happen before the HTML leaves the server; a
// client-side-only fix (e.g. updating document.title in React) would not
// have worked for link previews, only for the browser tab/search indexing.
function renderPageHtml(distPath, { title, description, image, url, type = 'website' }) {
  const html = loadIndexHtml(distPath)
  const safeTitle = escapeHtml(title)
  const safeDesc = escapeHtml(toPlainSummary(description))
  const safeImage = escapeHtml(toAbsoluteUrl(image))
  const safeUrl = escapeHtml(url)

  return html
    .replace(/<title>.*?<\/title>/, `<title>${safeTitle}</title>`)
    .replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${safeDesc}">`)
    .replace(/<link rel="canonical" href=".*?">/, `<link rel="canonical" href="${safeUrl}">`)
    .replace(/<meta property="og:type" content=".*?">/, `<meta property="og:type" content="${escapeHtml(type)}">`)
    .replace(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${safeTitle}">`)
    .replace(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${safeDesc}">`)
    .replace(/<meta property="og:image" content=".*?">/, `<meta property="og:image" content="${safeImage}">`)
    .replace(/<meta property="og:url" content=".*?">/, `<meta property="og:url" content="${safeUrl}">`)
    .replace(/<meta name="twitter:title" content=".*?">/, `<meta name="twitter:title" content="${safeTitle}">`)
    .replace(/<meta name="twitter:description" content=".*?">/, `<meta name="twitter:description" content="${safeDesc}">`)
    .replace(/<meta name="twitter:image" content=".*?">/, `<meta name="twitter:image" content="${safeImage}">`)
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// `entries` is [{ path, lastmod?, changefreq?, priority? }] — lastmod is an
// ISO date string, the rest are the usual sitemap-protocol hints.
function buildSitemapXml(entries) {
  const urls = entries.map(e => [
    '  <url>',
    `    <loc>${escapeXml(APP_URL + e.path)}</loc>`,
    e.lastmod ? `    <lastmod>${escapeXml(e.lastmod)}</lastmod>` : '',
    e.changefreq ? `    <changefreq>${escapeXml(e.changefreq)}</changefreq>` : '',
    e.priority != null ? `    <priority>${e.priority}</priority>` : '',
    '  </url>',
  ].filter(Boolean).join('\n')).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

module.exports = { APP_URL, DEFAULT_IMAGE, renderPageHtml, buildSitemapXml, toAbsoluteUrl }
