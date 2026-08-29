import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

// CI checks out shallow, so GITHUB_SHA is the only reliable source there; the
// git call covers local builds and 'unknown' covers a build from a tarball.
const resolveBuildCommit = (): string => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
};

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
  // Every build gets a fresh __BUILD_TIME__, so the main chunk hash always
  // changes and the service worker precache revision always advances.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_COMMIT__: JSON.stringify(resolveBuildCommit()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
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
