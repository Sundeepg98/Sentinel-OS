import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/clerk-react';
import { registerSW } from 'virtual:pwa-register';
import { env } from './lib/env';
import { reportError } from './lib/api';
import './index.css';
import App from './App.tsx';

// --- 🛠️ ENGINEERING BASIC: PWA REGISTRATION ---
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('A new neural update is available. Reload now to synchronize?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('📡 [PWA] Offline Mode Ready.');
  },
});

// --- 🛰️ ENGINEERING BASIC: GLOBAL TELEMETRY ---
window.addEventListener('error', (event) => {
  reportError(event.error || new Error(event.message));
});

window.addEventListener('unhandledrejection', (event) => {
  reportError(
    event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
    'UNHANDLED_PROMISE_REJECTION'
  );
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PUBLISHABLE_KEY = env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {PUBLISHABLE_KEY ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ClerkProvider>
    ) : (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-4">
          <div className="text-rose-500 font-bold text-xl uppercase tracking-widest">
            Configuration Error
          </div>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Technical keys are missing. Please ensure{' '}
            <code className="text-indigo-400">VITE_CLERK_PUBLISHABLE_KEY</code> is defined.
          </p>
        </div>
      </div>
    )}
  </StrictMode>
);
