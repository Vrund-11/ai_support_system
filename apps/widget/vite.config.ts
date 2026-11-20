import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
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
    port: 5174,
  },
  // @ts-expect-error vitest config field
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
