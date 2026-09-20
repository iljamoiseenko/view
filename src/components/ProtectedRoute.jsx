import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Where a logged-in user lands when they hit a route meant for a different
// role — e.g. a guest account wandering into /venue, or a venue owner into
// /my-bookings. Keep in sync with the equivalent redirect in LoginPage.jsx.
function homeFor(role) {
  if (role === 'superadmin') return '/admin'
  if (role === 'user') return '/my-bookings'
  return '/venue'
}

export default function ProtectedRoute({ role, children }) {
  const { currentUser, loading } = useAuth()

  if (loading) return null
  if (!currentUser) return <Navigate to="/login" replace />
  if (role && currentUser.role !== role) {
    return <Navigate to={homeFor(currentUser.role)} replace />
  }

  return children
}
