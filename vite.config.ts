import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'android-chrome-192x192.png',
        'android-chrome-512x512.png',
        'icon.svg',
      ],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.destination === 'document' ||
              request.destination === 'script' ||
              request.destination === 'style' ||
              request.destination === 'image' ||
              request.destination === 'font' ||
              request.destination === 'manifest' ||
              url.origin === self.location.origin,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cozy-pocket-static',
            },
          },
        ],
      },
    }),
  ],
  base: '/Cozy-Pocket/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'react-vendor';
          }
          if (id.includes('/@google/genai/')) {
            return 'ai-vendor';
          }
          if (id.includes('/date-fns/')) {
            return 'date-vendor';
          }
          if (id.includes('/dexie/')) {
            return 'db-vendor';
          }
          if (id.includes('/lucide-react/')) {
            return 'icons-vendor';
          }

          return undefined;
        },
      },
    },
  }
});
