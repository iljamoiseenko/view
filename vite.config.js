import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// WayForPay's returnUrl redirect is a POST, not a GET. In production that lands on
// the same Express server as the API and gets caught by its app.all('*') SPA fallback;
// in dev the frontend is served by Vite instead, which only has a GET fallback for
// client-side routes — so treat non-API POSTs as GET before Vite's own middleware sees them.
function wayforpayPostFallback() {
  return {
    name: 'wayforpay-post-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method === 'POST' && !req.url.startsWith('/api') && !req.url.startsWith('/uploads')) {
          req.method = 'GET'
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), wayforpayPostFallback()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
