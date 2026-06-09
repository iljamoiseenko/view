import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Header from './components/Header/Header'
import Footer from './components/Footer/Footer'
import HomePage from './pages/HomePage/HomePage'
import PlaceDetailPage from './pages/PlaceDetailPage/PlaceDetailPage'
import EventsPage from './pages/EventsPage/EventsPage'
import LoginPage from './pages/LoginPage/LoginPage'
import SuperAdminPage from './pages/SuperAdmin/SuperAdminPage'
import VenueAdminPage from './pages/VenueAdmin/VenueAdminPage'
import RegisterPage from './pages/RegisterPage/RegisterPage'
import SpecialPage from './pages/SpecialPage/SpecialPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <div className="app">
            <Header />
            <main className="main-content">
              <Routes>
                {/* Public */}
                <Route path="/" element={<HomePage />} />
                <Route path="/place/:id" element={<PlaceDetailPage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/special/:slug" element={<SpecialPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Super admin */}
                <Route path="/admin" element={
                  <ProtectedRoute role="superadmin">
                    <SuperAdminPage />
                  </ProtectedRoute>
                } />

                {/* Venue admin */}
                <Route path="/venue" element={
                  <ProtectedRoute role="venue">
                    <VenueAdminPage />
                  </ProtectedRoute>
                } />

                {/* Redirects */}
                <Route path="/subscription" element={<Navigate to="/" replace />} />
                <Route path="/admin-old" element={<Navigate to="/admin" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
