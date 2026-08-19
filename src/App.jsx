import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import ProtectedRoute from './components/ProtectedRoute'
import Header from './components/Header/Header'
import Footer from './components/Footer/Footer'
import HomePage from './pages/HomePage/HomePage'
import PlaceDetailPage from './pages/PlaceDetailPage/PlaceDetailPage'
import EventDetailPage from './pages/EventDetailPage/EventDetailPage'
import EventsPage from './pages/EventsPage/EventsPage'
import LoginPage from './pages/LoginPage/LoginPage'
import SuperAdminPage from './pages/SuperAdmin/SuperAdminPage'
import VenueAdminPage from './pages/VenueAdmin/VenueAdminPage'
import RegisterPage from './pages/RegisterPage/RegisterPage'
import AboutPage from './pages/AboutPage/AboutPage'
import CollectionsPage from './pages/CollectionsPage/CollectionsPage'
import CollectionDetailPage from './pages/CollectionDetailPage/CollectionDetailPage'
import TermsPage from './pages/LegalPages/TermsPage'
import RefundPolicyPage from './pages/LegalPages/RefundPolicyPage'
import ContactsPage from './pages/LegalPages/ContactsPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage/ResetPasswordPage'
import ScrollToTop from './components/ScrollToTop'

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
      <AuthProvider>
        <AppProvider>
          <div className="app">
            <ScrollToTop />
            <Header />
            <main className="main-content">
              <Routes>
                {/* Public */}
                <Route path="/" element={<HomePage />} />
                <Route path="/place/:id" element={<PlaceDetailPage />} />
                <Route path="/event/:id" element={<EventDetailPage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/collections" element={<CollectionsPage />} />
                <Route path="/collections/:slug" element={<CollectionDetailPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/refund-policy" element={<RefundPolicyPage />} />
                <Route path="/contacts" element={<ContactsPage />} />

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
      </LanguageProvider>
    </BrowserRouter>
  )
}
