import React, { useState, useEffect } from 'react';
import { WifiOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 🛰️ NERVOUS SYSTEM HEALTH BANNER
 * Notifies the user of backend connectivity status in real-time.
 */
export const StatusBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // 1. Monitor SSE Stream for connectivity
    const eventSource = new EventSource('/api/v1/intelligence/stream');
    
    eventSource.onopen = () => {
      setIsOnline(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SYNC_COMPLETE') {
          setIsSyncing(false);
        }
      } catch (err) {}
    };

    eventSource.onerror = () => {
      setIsOnline(false);
    };

    return () => eventSource.close();
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[200] bg-rose-600 text-white py-1.5 px-4 flex items-center justify-center gap-3 shadow-xl"
        >
          <WifiOff size={14} className="animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Connection Lost: Searching for Backend Nervous System...</span>
        </motion.div>
      )}
      
      {isSyncing && isOnline && (
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[200] bg-cyan-600 text-white py-1 px-4 flex items-center justify-center gap-3 shadow-xl"
        >
          <Loader2 size={12} className="animate-spin" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Neural Re-Indexing in Progress...</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
