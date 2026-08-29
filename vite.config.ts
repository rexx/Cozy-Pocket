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
      // public/manifest.json is the single source of truth, so the plugin must
      // not emit a competing one.
      manifest: false,
      // No includeAssets: Vite already copies public/ into dist, where
      // globPatterns below picks the icons up. Listing them again would put
      // duplicate entries in the precache manifest.
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
  // Must stay aligned with id / start_url / scope in public/manifest.json and
  // the icon paths in index.html. A mismatch installs fine but makes an offline
  // cold start request a URL the service worker never cached.
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
