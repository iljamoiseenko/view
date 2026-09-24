import { App } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { isNative, API_ORIGIN, SITE_ORIGIN } from './platform'

// Everything the iOS app needs before React renders. No-op on the website.
export function setupNative() {
  if (!isNative) return

  document.documentElement.classList.add('is-native')
  const viewport = document.querySelector('meta[name="viewport"]')
  if (viewport) viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover'

  patchFetch()

  StatusBar.setStyle({ style: Style.Light }).catch(() => {})
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
  StatusBar.setBackgroundColor({ color: '#ffffff' }).catch(() => {})

  // Universal links (https://viewtoday.site/event/123) open the matching
  // in-app route instead of the website.
  App.addListener('appUrlOpen', ({ url }) => {
    try {
      const u = new URL(url)
      const path = u.pathname + u.search + u.hash
      if (path && path !== window.location.pathname + window.location.search) {
        window.history.pushState({}, '', path)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
    } catch { /* ignore malformed urls */ }
  })

  // Hide the splash once the first frame is painted.
  requestAnimationFrame(() => SplashScreen.hide().catch(() => {}))
}

// The app bundle is served from capacitor://localhost, so every '/api/...' and
// '/uploads/...' request is rewritten to the real server. Image paths stored as
// '/uploads/x.jpg' come back absolute (so <img src> works) and are made
// relative again on the way out, so the DB keeps the same values the website writes.
function patchFetch() {
  const originalFetch = window.fetch.bind(window)
  const uploadsAbs = `"${SITE_ORIGIN}/uploads/`

  window.fetch = async (input, init = {}) => {
    if (typeof input === 'string' && (input.startsWith('/api/') || input.startsWith('/uploads/'))) {
      input = API_ORIGIN + input
      if (typeof init.body === 'string') {
        init = { ...init, body: init.body.split(uploadsAbs).join('"/uploads/') }
      }
      const res = await originalFetch(input, init)
      const json = res.json.bind(res)
      res.json = async () => {
        const text = await res.clone().text().catch(() => null)
        if (text == null) return json()
        return JSON.parse(text.split('"/uploads/').join(uploadsAbs))
      }
      return res
    }
    return originalFetch(input, init)
  }
}
