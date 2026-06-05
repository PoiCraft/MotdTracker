import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { api } from "@/api/endpoints"

interface AuthContextValue {
  token: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  setup: (username: string, password: string) => Promise<void>
  logout: () => void
  error: string | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = "motdtracker_auth_token"

function isTokenExpired(token: string | null): boolean {
  if (!token) return true
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isTokenExpired(stored)) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return stored
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.admin.login(username, password)
      localStorage.setItem(STORAGE_KEY, res.token)
      setToken(res.token)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Login failed"
      setError(message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const setup = useCallback(async (username: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.admin.setup(username, password)
      localStorage.setItem(STORAGE_KEY, res.token)
      setToken(res.token)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Setup failed"
      setError(message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    if (token) {
      api.admin.logout(token).catch(() => {})
    }
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setError(null)
  }, [token])

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: !!token && !isTokenExpired(token),
        login,
        setup,
        logout,
        error,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
