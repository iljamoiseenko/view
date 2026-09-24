# View — iOS app

Capacitor wrapper around the same React app as viewtoday.site. The web bundle
(`dist/`) ships inside the app; API calls and `/uploads` images go to
`https://viewtoday.site` (see `src/native/`).

## Everyday workflow

```bash
npm run ios:sync   # vite build + copy into the Xcode project (needs Node 20+)
npm run ios:open   # open in Xcode → pick a simulator → ▶
```

Run `ios:sync` after every frontend change you want in the app.

## What's different in the app

- `src/native/platform.js` — `isNative`, API origin, public origin for share/booking links.
- `src/native/bootstrap.js` — rewrites `/api` and `/uploads` fetches to the server, status bar, splash, universal-link routing.
- `src/native/native.css` — safe-area padding; hides `.web-only` (WayForPay payments —
  App Store requires In-App Purchase for in-app payments, so subscriptions/credits are bought on the site).
- `ios/App/App/ViewNative.swift` — `ViewCalendar` plugin (native "New Event" sheet), registered by `ViewBridgeViewController`.
- Server: CORS allows `capacitor://localhost`; `DELETE /api/auth/me` for account deletion (App Store requirement).

## Publishing checklist

1. Apple Developer Program ($99/yr) → in Xcode: App target → Signing & Capabilities → select Team.
2. App Store Connect → new app, bundle ID `site.viewtoday.app`.
3. Deploy the server changes first (CORS + account deletion) — the app talks to production.
4. Xcode → Product → Archive → Distribute → App Store Connect → TestFlight.
5. Store listing: screenshots (6.9" iPhone), description, privacy policy URL, support URL,
   App Privacy form (email, name, phone for bookings; Google Analytics), a demo venue account for review.
