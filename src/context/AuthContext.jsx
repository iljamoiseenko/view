import { createContext, useContext, useState, useEffect } from 'react'
import { api, setToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('view_token')
    if (!token) { setLoading(false); return }
    api.get('/auth/me')
      .then(({ user }) => setCurrentUser(user))
      .catch(() => { setToken(null) })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const { token, user } = await api.post('/auth/login', { email, password })
    setToken(token)
    setCurrentUser(user)
    return user
  }

  const logout = () => {
    setToken(null)
    setCurrentUser(null)
  }

  const registerUser = async ({ email, password, name, place }) => {
    const { token, user, place: createdPlace } = await api.post('/auth/register', { email, password, name, place })
    setToken(token)
    setCurrentUser(user)
    return { success: true, user, place: createdPlace }
  }

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout, registerUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
