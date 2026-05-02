import { useEffect, useRef, useCallback, useState } from "react";

const SOCKET_BASE = (import.meta.env.VITE_SOCKET_BASE_URL || window.location.origin).replace(/\/$/, "");

export function useWebSocket(onPollComplete) {
  const wsRef = useRef(null);
  const [status, setStatus] = useState("connecting");
  const reconnectTimer = useRef(null);
  const callbackRef = useRef(onPollComplete);

  useEffect(() => {
    callbackRef.current = onPollComplete;
  }, [onPollComplete]);

  const connect = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${SOCKET_BASE.replace(/^https?:\/\//, "")}/api/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "poll_complete" && callbackRef.current) {
          callbackRef.current(msg.data);
        }
      } catch {}
    };

    ws.onclose = () => {
      setStatus("disconnected");
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      setStatus("disconnected");
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
    };
  }, [connect]);

  return status;
}
