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

            if (!normalizedId.includes('node_modules') && !normalizedId.includes('/src/components/webmail/')) {
              return undefined;
            }

            if (normalizedId.includes('@tinymce/tinymce-react')) {
              return 'tinymce-react';
            }

            if (normalizedId.includes('/tinymce/plugins/')) {
              const pluginName = normalizedId.split('/tinymce/plugins/')[1]?.split('/')[0] || '';
              if (['advlist', 'anchor', 'autolink', 'charmap', 'code', 'fullscreen', 'help'].includes(pluginName)) {
                return 'tinymce-plugins-a';
              }

              return 'tinymce-plugins-b';
            }

            if (normalizedId.includes('/tinymce/themes/')) {
              return 'tinymce-theme';
            }

            if (normalizedId.includes('/tinymce/icons/')) {
              return 'tinymce-icons';
            }

            if (normalizedId.includes('/tinymce/models/')) {
              return 'tinymce-model';
            }

            if (normalizedId.includes('/tinymce/')) {
              return 'tinymce-runtime';
            }

            if (normalizedId.includes('/src/components/webmail/email_rich_text_editor')) {
              return 'webmail-editor';
            }

            if (normalizedId.includes('/src/components/webmail/rc_webmail') || normalizedId.includes('/src/lib/gmail_api')) {
              return 'webmail-shell';
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
              normalizedId.includes('/node_modules/react-router-dom/') ||
              normalizedId.includes('/node_modules/@remix-run/')
            ) {
              return 'router-vendor';
            }

            if (normalizedId.includes('lucide-react') || normalizedId.includes('motion')) {
              return 'ui-vendor';
            }

            return undefined;
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    server: {
      hmr: true,
      watch: {
        ignored: ['**/debug_*', '**/cookies_*', '**/*.html', '**/*.txt']
      }
    },
  };
});
