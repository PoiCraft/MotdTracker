import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";

const SOCKET_BASE = (import.meta.env.VITE_SOCKET_BASE_URL || window.location.origin).replace(/\/$/, "");

const WsContext = createContext({ status: "connecting" });

export function WebSocketProvider({ children }) {
  const [status, setStatus] = useState("connecting");
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const subscribers = useRef(new Set());
  const aliveRef = useRef(true);

  const connect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      try { wsRef.current.close(); } catch {}
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${SOCKET_BASE.replace(/^https?:\/\//, "")}/api/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (aliveRef.current) setStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "poll_complete") {
          for (const cb of subscribers.current) {
            try { cb(msg.data); } catch {}
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      if (!aliveRef.current) return;
      setStatus("disconnected");
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      if (aliveRef.current) setStatus("disconnected");
    };
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    connect();
    return () => {
      aliveRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        try { wsRef.current.close(); } catch {}
      }
    };
  }, [connect]);

  const subscribe = useCallback((cb) => {
    subscribers.current.add(cb);
    return () => subscribers.current.delete(cb);
  }, []);

  const ctx = useMemo(() => ({ status, subscribe }), [status, subscribe]);

  return (
    <WsContext.Provider value={ctx}>
      {children}
    </WsContext.Provider>
  );
}

export function useWsEvent(callback) {
  const { status, subscribe } = useContext(WsContext);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return subscribe((data) => callbackRef.current(data));
  }, [subscribe]);

  return status;
}
