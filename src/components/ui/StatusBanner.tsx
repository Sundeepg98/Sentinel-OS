import React, { useState, useEffect } from 'react';
import { WifiOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StatusBannerProps {
  online?: boolean;
  syncing?: boolean;
  onSyncComplete?: () => void;
}

/**
 * 🛰️ NERVOUS SYSTEM HEALTH BANNER
 * Notifies the user of backend connectivity status in real-time.
 */
export const StatusBanner: React.FC<StatusBannerProps> = ({ online, syncing, onSyncComplete }) => {
  const [internalOnline, setInternalOnline] = useState(navigator.onLine);
  const [internalSyncing, setInternalSyncing] = useState(false);

  // Use props if provided, otherwise fallback to internal state
  const isOnline = online !== undefined ? online : internalOnline;
  const isSyncing = syncing !== undefined ? syncing : internalSyncing;

  useEffect(() => {
    // 🌐 BROWSER CONNECTIVITY DETECTION
    const handleOnline = () => setInternalOnline(true);
    const handleOffline = () => setInternalOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Only connect to SSE if props are NOT provided (Standard runtime mode)
    if (online !== undefined || syncing !== undefined) {
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    let reconnectTimer: number | null = null;
    let backoffDelay = 1000; // Start with 1s

    const connect = () => {
      const eventSource = new EventSource('/api/v1/intelligence/stream');

      eventSource.onopen = () => {
        setInternalOnline(true);
        backoffDelay = 1000; // Reset on success
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'SYNC_START') {
            setInternalSyncing(true);
          }
          if (data.type === 'SYNC_COMPLETE') {
            setInternalSyncing(false);
            if (onSyncComplete) onSyncComplete();
          }
        } catch {
          // SSE Parse Error ignored
        }
      };

      eventSource.onerror = () => {
        setInternalOnline(false);
        eventSource.close();

        // 🛡️ STAFF BASIC: Exponential Backoff Jitter
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(() => {
          console.warn(`[SSE] Reconnecting in ${backoffDelay}ms...`);
          connect();
          backoffDelay = Math.min(backoffDelay * 2, 30000); // Cap at 30s
        }, backoffDelay);
      };

      return eventSource;
    };

    const es = connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es.close();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [online, syncing, onSyncComplete]);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          role="alert"
          aria-live="assertive"
          className="fixed top-0 left-0 right-0 z-[200] bg-rose-600 text-white py-1.5 px-4 flex items-center justify-center gap-3 shadow-xl"
        >
          <WifiOff size={14} className="animate-pulse" aria-hidden="true" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
            Connection Lost: Searching for Backend Nervous System...
          </span>
        </motion.div>
      )}

      {isSyncing && isOnline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          role="status"
          aria-live="polite"
          className="fixed top-0 left-0 right-0 z-[200] bg-cyan-600 text-white py-1 px-4 flex items-center justify-center gap-3 shadow-xl"
        >
          <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
            Neural Re-Indexing in Progress...
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
