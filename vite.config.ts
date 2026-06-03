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

            if (normalizedId.includes('/src/components/webmail/')) {
              return 'webmail-module';
            }

            if (!normalizedId.includes('node_modules/')) {
              return undefined;
            }

            if (
              normalizedId.includes('/node_modules/react/') ||
              normalizedId.includes('/node_modules/react-dom/') ||
              normalizedId.includes('/node_modules/scheduler/')
            ) {
              return 'react-vendor';
            }

            if (
              normalizedId.includes('/node_modules/react-router/') ||
              normalizedId.includes('/node_modules/react-router-dom/')
            ) {
              return 'router-vendor';
            }

            if (normalizedId.includes('/node_modules/tinymce/plugins/')) {
              return 'tinymce-plugins';
            }

            if (normalizedId.includes('/node_modules/tinymce/icons/')) {
              return 'tinymce-icons';
            }

            if (normalizedId.includes('/node_modules/tinymce/models/')) {
              return 'tinymce-models';
            }

            if (normalizedId.includes('/node_modules/tinymce/themes/')) {
              return 'tinymce-themes';
            }

            if (normalizedId.includes('/node_modules/tinymce/skins/')) {
              return 'tinymce-skins';
            }

            if (normalizedId.includes('/node_modules/@tinymce/tinymce-react/')) {
              return 'tinymce-react';
            }

            if (
              normalizedId.includes('/node_modules/tinymce/') ||
              normalizedId.includes('/node_modules/@tinymce/')
            ) {
              return 'tinymce-core';
            }

            if (normalizedId.includes('/node_modules/emoji-picker-react/')) {
              return 'emoji-picker';
            }

            if (
              normalizedId.includes('/node_modules/lucide-react/') ||
              normalizedId.includes('/node_modules/date-fns/') ||
              normalizedId.includes('/node_modules/framer-motion/') ||
              normalizedId.includes('/node_modules/motion/')
            ) {
              return 'ui-vendor';
            }

            return undefined;
          },
        },
      },
    },
    server: {
      hmr: true,
      watch: {
        ignored: ['**/debug_*', '**/cookies_*', '**/*.html', '**/*.txt']
      }
    },
  };
});
