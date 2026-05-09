import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        name: 'Memoria Timeline',
        short_name: 'Memoria',
        description: 'Your premium personal history timeline.',
        theme_color: '#faf8f5',
        icons: []
      }
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,           // ✦ OFF in prod — halves bundle size
    minify: 'esbuild',          // ✦ Fastest minifier
    cssMinify: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split massive vendor libraries into separately-cached chunks
          if (id.includes('node_modules/three') || id.includes('@react-three')) {
            return 'vendor-three';
          }
          if (id.includes('@vladmandic/face-api')) {
            return 'vendor-faceapi';
          }
          if (id.includes('@xenova/transformers')) {
            return 'vendor-transformers';
          }
          if (id.includes('framer-motion')) {
            return 'vendor-framer';
          }
          if (id.includes('react-globe') || id.includes('globe.gl')) {
            return 'vendor-globe';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
