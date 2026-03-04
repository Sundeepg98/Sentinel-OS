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
            // Group ALL visualization and 3D libs together to avoid circularity
            if (
              id.includes('three') || 
              id.includes('react-force-graph') || 
              id.includes('d3-force') ||
              id.includes('3d-force-graph') ||
              id.includes('postprocessing')
            ) {
              return 'visualization-bundle';
            }
            // Group markdown processing
            if (id.includes('react-markdown') || id.includes('remark') || id.includes('unified')) {
              return 'markdown-bundle';
            }
            // Standard vendor for everything else
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1500, // Three.js is big, acknowledge it
  },
})
