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
          if (id.includes('node_modules')) {
            // Group 3D and heavy visualization libraries
            if (id.includes('three') || id.includes('react-force-graph') || id.includes('d3-force')) {
              return 'visualization-vendor';
            }
            if (id.includes('react-markdown') || id.includes('remark') || id.includes('unified')) {
              return 'markdown-vendor';
            }
            if (id.includes('lucide-react') || id.includes('framer-motion')) {
              return 'ui-vendor';
            }
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Reasonable limit for a high-intelligence dashboard
  },
})
