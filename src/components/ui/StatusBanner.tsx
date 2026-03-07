import React, { useState, useEffect } from 'react';
import { WifiOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StatusBannerProps {
  online?: boolean;
  syncing?: boolean;
}

/**
 * 🛰️ NERVOUS SYSTEM HEALTH BANNER
 * Notifies the user of backend connectivity status in real-time.
 */
export const StatusBanner: React.FC<StatusBannerProps> = ({ online, syncing }) => {
  const [internalOnline, setInternalOnline] = useState(true);
  const [internalSyncing, setInternalSyncing] = useState(false);

  // Use props if provided, otherwise fallback to internal SSE state
  const isOnline = online !== undefined ? online : internalOnline;
  const isSyncing = syncing !== undefined ? syncing : internalSyncing;

  useEffect(() => {
    // Only connect to SSE if props are NOT provided (Standard runtime mode)
    if (online !== undefined || syncing !== undefined) return;

    const eventSource = new EventSource('/api/v1/intelligence/stream');
    
    eventSource.onopen = () => {
      setInternalOnline(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SYNC_START') {
          setInternalSyncing(true);
        }
        if (data.type === 'SYNC_COMPLETE') {
          setInternalSyncing(false);
        }
      } catch {
        // SSE Parse Error ignored
      }
    };

    eventSource.onerror = () => {
      setInternalOnline(false);
    };

    return () => eventSource.close();
  }, [online, syncing]);

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
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Connection Lost: Searching for Backend Nervous System...</span>
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
          <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Neural Re-Indexing in Progress...</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
