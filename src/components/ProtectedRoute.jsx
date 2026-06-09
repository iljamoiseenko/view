import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ role, children }) {
  const { currentUser } = useAuth()

  if (!currentUser) return <Navigate to="/login" replace />
  if (role && currentUser.role !== role) {
    return <Navigate to={currentUser.role === 'superadmin' ? '/admin' : '/venue'} replace />
  }

  return children
}
