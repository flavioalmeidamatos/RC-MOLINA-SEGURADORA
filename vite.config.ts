import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');

            if (normalizedId.includes('node_modules/')) {
              return normalizedId.split('node_modules/')[1].split('/')[0].replace('@', '');
            }

            if (normalizedId.includes('/src/components/webmail/')) {
              return 'webmail-module';
            }

            return undefined;
          },
        },
      },
      chunkSizeWarningLimit: 2500,
    },
    server: {
      hmr: true,
      watch: {
        ignored: ['**/debug_*', '**/cookies_*', '**/*.html', '**/*.txt']
      }
    },
  };
});
