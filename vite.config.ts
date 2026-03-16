import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
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
