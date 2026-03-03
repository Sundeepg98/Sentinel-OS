import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Explicitly separate the heaviest dependencies
          if (id.includes('node_modules/three/')) {
            return 'three-core';
          }
          if (id.includes('node_modules/react-force-graph-3d/')) {
            return 'graph-3d';
          }
          if (id.includes('node_modules/react-markdown/') || id.includes('remark') || id.includes('unified')) {
            return 'markdown-engine';
          }
          if (id.includes('node_modules/framer-motion/')) {
            return 'animation-engine';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons';
          }
          // General vendor for other dependencies
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1200, // Three.js is inherently large
  },
})
