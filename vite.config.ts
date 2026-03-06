import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: false,
      filename: 'bundle-analysis.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Group ALL visualization and 3D libs together
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
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
})
