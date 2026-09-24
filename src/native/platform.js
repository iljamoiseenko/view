import { Capacitor } from '@capacitor/core'

// True inside the iOS app (Capacitor), false on the website.
export const isNative = Capacitor.isNativePlatform()

// Public site origin. On the web everything is same-origin, so relative URLs
// just work. In the app the bundle is served from capacitor://localhost, so API
// calls and /uploads images have to point at the real server explicitly.
export const SITE_ORIGIN = import.meta.env.VITE_SITE_ORIGIN || 'https://viewtoday.site'
export const API_ORIGIN = isNative ? SITE_ORIGIN : ''

// Links meant to be shared/opened by other people (booking links etc.) must
// always use the public domain — window.location.origin is capacitor://localhost
// inside the app.
export const publicOrigin = () => (isNative ? SITE_ORIGIN : window.location.origin)
