import { useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    const newSocket = io({
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    })

    newSocket.on('connect', () => {
      console.log('WebSocket connected')
      setConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected')
      setConnected(false)
    })

    newSocket.on('poll_complete', (data) => {
      console.log('Poll complete:', data)
      setLastUpdate(new Date())
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  const subscribe = useCallback((event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.on(event, callback)
      return () => {
        socket.off(event, callback)
      }
    }
  }, [socket])

  return {
    socket,
    connected,
    lastUpdate,
    subscribe,
  }
}
