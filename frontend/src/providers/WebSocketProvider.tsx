import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"

type WsStatus = "connecting" | "connected" | "disconnected"

interface WebSocketContextValue {
  status: WsStatus
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

const AUTH_STORAGE_KEY = "motdtracker_auth"

function readToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.token ?? null
  } catch {
    return null
  }
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WsStatus>("connecting")
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount = useRef(0)
  const queryClient = useQueryClient()

  // 用 ref 持有 connect 函数，避免 useCallback 自引用的前向声明问题
  const connectRef = useRef<() => void>(() => {})

  const connect = useCallback(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
    const token = readToken()
    const qs = token ? `?token=${encodeURIComponent(token)}` : ""
    const ws = new WebSocket(`${proto}//${window.location.host}/api/ws${qs}`)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus("connected")
      retryCount.current = 0
    }
    ws.onclose = () => {
      setStatus("disconnected")
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      const backoff = Math.min(3000 * Math.pow(2, retryCount.current), 30000)
      retryCount.current++
      reconnectTimer.current = setTimeout(() => connectRef.current(), backoff)
    }
    ws.onerror = () => setStatus("disconnected")
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.event === "poll_complete") {
          queryClient.invalidateQueries({ queryKey: ["tree"] })
          queryClient.invalidateQueries({ queryKey: ["servers"] })
          queryClient.invalidateQueries({ queryKey: ["nodes"] })
          queryClient.invalidateQueries({ queryKey: ["players"] })
          queryClient.invalidateQueries({ queryKey: ["groups"] })
          queryClient.invalidateQueries({ queryKey: ["trend"] })
        }
      } catch {
        // ignore
      }
    }
  }, [queryClient])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    connect()
    // 监听 localStorage 变化以同步 token
    function handleStorage(e: StorageEvent) {
      if (e.key === AUTH_STORAGE_KEY) {
        const wasAuthenticated = wsRef.current !== null
        wsRef.current?.close()
        retryCount.current = 0
        // Token changed or cleared — reconnect only if there's a new token
        if (readToken() || wasAuthenticated) {
          connect()
        }
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => {
      window.removeEventListener("storage", handleStorage)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return (
    <WebSocketContext.Provider value={{ status }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext)
  if (!ctx) throw new Error("useWebSocket must be used within WebSocketProvider")
  return ctx
}
