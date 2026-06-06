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

const STORAGE_KEY = "motdtracker_auth"

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true
  try {
    return new Date(expiresAt).getTime() < Date.now()
  } catch {
    return true
  }
}

function readStorage(): { token: string | null; expiresAt: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { token: null, expiresAt: null }
    const parsed = JSON.parse(raw)
    if (isExpired(parsed.expiresAt)) {
      localStorage.removeItem(STORAGE_KEY)
      return { token: null, expiresAt: null }
    }
    return { token: parsed.token ?? null, expiresAt: parsed.expiresAt ?? null }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return { token: null, expiresAt: null }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ token, expiresAt }, setAuth] = useState(readStorage)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.admin.login(username, password)
      const payload = { token: res.token, expiresAt: res.expires_at }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      setAuth({ token: res.token, expiresAt: res.expires_at })
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
      const payload = { token: res.token, expiresAt: res.expires_at }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      setAuth({ token: res.token, expiresAt: res.expires_at })
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
    setAuth({ token: null, expiresAt: null })
    setError(null)
  }, [token])

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: !!token && !isExpired(expiresAt),
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
