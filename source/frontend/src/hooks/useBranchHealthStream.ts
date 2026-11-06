import { useEffect, useRef, useCallback } from 'react';
import { BranchHealth } from '../types';

export function useBranchHealthStream(
  branchId: string | undefined,
  onUpdate: (health: BranchHealth[]) => void,
  enabled: boolean = true
) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (!enabled || !branchId) return;
    if (eventSourceRef.current) return;

    const token = localStorage.getItem('bb_it_token');
    if (!token) return;

    const baseUrl = import.meta.env.VITE_API_BASE || '';
    const url = `${baseUrl}/api/monitoring/stream?branchId=${encodeURIComponent(branchId)}&token=${encodeURIComponent(token)}`;

    const es = new EventSource(url);

    es.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        if (data.branchHealth) {
          onUpdate(data.branchHealth);
        }
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    es.onerror = () => {
      if (!isMountedRef.current) return;
      es.close();
      eventSourceRef.current = null;
      reconnectTimeoutRef.current = window.setTimeout(
        () => connectRef.current(),
        5000,
      );
    };

    eventSourceRef.current = es;
  }, [branchId, enabled, onUpdate]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { reconnect: connect };
}