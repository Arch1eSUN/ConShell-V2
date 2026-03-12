/**
 * API barrel — 导出api client + WebSocket hook
 */
export { api, type HealthResponse, type ChatResponse, type MetricsResponse, type ConfigResponse } from './client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ── WebSocket Hook ────────────────────────────────────────────────────

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export interface WsMessage {
  type: string;
  data: any;
  timestamp: number;
}

export function useWebSocket(url?: string) {
  const wsUrl = url ?? `ws://${window.location.hostname}:4200/ws`;
  const [status, setStatus] = useState<WsStatus>('disconnected');
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const msg: WsMessage = {
          type: parsed.type ?? 'unknown',
          data: parsed,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev.slice(-200), msg]); // keep last 200
      } catch {
        setMessages(prev => [...prev.slice(-200), {
          type: 'raw',
          data: { text: event.data },
          timestamp: Date.now(),
        }]);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      // Auto-reconnect
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, [wsUrl]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { status, messages, send };
}
