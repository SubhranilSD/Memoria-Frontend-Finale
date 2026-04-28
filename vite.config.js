import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6MB
      },
      // includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Memoria Timeline',
        short_name: 'Memoria',
        description: 'Your premium personal history timeline.',
        theme_color: '#faf8f5',
        icons: [
          // {
          //   src: 'pwa-192x192.png',
          //   sizes: '192x192',
          //   type: 'image/png'
          // },
          // {
          //   src: 'pwa-512x512.png',
          //   sizes: '512x512',
          //   type: 'image/png',
          //   purpose: 'any maskable'
          // }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
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
