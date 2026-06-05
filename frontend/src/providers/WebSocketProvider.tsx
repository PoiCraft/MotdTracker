import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"

type WsStatus = "connecting" | "connected" | "disconnected"

interface WebSocketContextValue {
  status: WsStatus
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WsStatus>("connecting")
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queryClient = useQueryClient()

  const connect = useCallback(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
    const ws = new WebSocket(`${proto}//${window.location.host}/api/ws`)
    wsRef.current = ws

    ws.onopen = () => setStatus("connected")
    ws.onclose = () => {
      setStatus("disconnected")
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      reconnectTimer.current = setTimeout(connect, 3000)
    }
    ws.onerror = () => setStatus("disconnected")
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.event === "poll_complete") {
          queryClient.invalidateQueries({ queryKey: ["servers"] })
          queryClient.invalidateQueries({ queryKey: ["nodes"] })
          queryClient.invalidateQueries({ queryKey: ["players"] })
          queryClient.invalidateQueries({ queryKey: ["groups"] })
        }
      } catch {
        // ignore
      }
    }
  }, [queryClient])

  useEffect(() => {
    connect()
    return () => {
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
