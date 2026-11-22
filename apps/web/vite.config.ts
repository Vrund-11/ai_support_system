import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:4000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if ('writeHead' in res && !res.headersSent) {
              res.writeHead(404, { 'Content-Type': 'application/problem+json' });
              res.end(
                JSON.stringify({
                  type: '/errors/not-found',
                  title: 'Not Found',
                  status: 404,
                  detail: 'Endpoint or service unavailable',
                }),
              );
            }
          });
        },
      },
    },
  },
  // @ts-expect-error vitest config field
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
