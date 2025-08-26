import React, { createContext, useContext, useEffect, useState } from 'react'
import api, { setAuthToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))

  useEffect(() => { setAuthToken(token) }, [token])
  useEffect(() => { if (token) localStorage.setItem('token', token); else localStorage.removeItem('token') }, [token])

  // Load current user on initial mount if token exists
  useEffect(() => {
    (async () => {
      if (token && !user) {
        try { const res = await api.get('/auth/me'); setUser(res.data) } catch { /* ignore */ }
      }
    })()
  }, [token])

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    setToken(res.data.token)
    try { const me = await api.get('/auth/me'); setUser(me.data) } catch { setUser(res.data.user) }
  }

  const logout = () => { setToken(null); setUser(null) }

  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }