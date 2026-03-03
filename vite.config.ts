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
            // Three.js is the largest dependency (~1MB), isolate it completely
            if (id.includes('three')) {
              return 'three-vendor';
            }
            // Group other visualization tools
            if (id.includes('react-force-graph') || id.includes('d3-force')) {
              return 'graph-vendor';
            }
            // Group markdown processing
            if (id.includes('react-markdown') || id.includes('remark') || id.includes('unified')) {
              return 'markdown-vendor';
            }
            // Group core UI frameworks
            if (id.includes('lucide-react') || id.includes('framer-motion')) {
              return 'ui-vendor';
            }
            // Everything else goes to a standard vendor chunk
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 800, // 800kB is a healthy limit for granular chunks
  },
})
