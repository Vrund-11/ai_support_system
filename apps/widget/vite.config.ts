import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const isTest = Boolean(process.env.VITEST);

export default defineConfig({
  ...(isTest
    ? {}
    : {
        define: {
          'process.env.NODE_ENV': JSON.stringify('production'),
          'process.env': {},
        },
      }),
  plugins: [react(), tailwindcss()],
  build: {
    lib: {
      entry: './src/embed.tsx',
      name: 'SupportPilotWidget',
      fileName: 'widget',
      formats: ['umd', 'es'],
    },
  },
  server: {
    host: true,
    port: 5174,
  },
  // @ts-expect-error vitest config field
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
