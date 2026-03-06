import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-8 right-8 z-[200] flex flex-col gap-3 min-w-[320px] max-w-md">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "p-4 rounded-xl border flex items-start gap-3 shadow-2xl backdrop-blur-xl relative overflow-hidden group",
                t.type === 'error' ? "bg-rose-500/10 border-rose-500/20 text-rose-200" :
                t.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-200" :
                "bg-indigo-500/10 border-indigo-500/20 text-indigo-200"
              )}
            >
              <div className={cn(
                "absolute top-0 left-0 w-1 h-full",
                t.type === 'error' ? "bg-rose-500" : t.type === 'success' ? "bg-emerald-500" : "bg-indigo-500"
              )} />

              <div className="mt-0.5">
                {t.type === 'error' ? <AlertCircle size={18} /> : 
                 t.type === 'success' ? <CheckCircle2 size={18} /> : 
                 <Info size={18} />}
              </div>

              <div className="flex-1 text-xs font-medium leading-relaxed tracking-wide">
                {t.message}
              </div>

              <button onClick={() => remove(t.id)} className="text-neutral-500 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
