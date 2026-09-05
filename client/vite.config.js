import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': 'http://localhost:8765',
    },
  },
  // TEST-1: client tests run under jsdom. Test files are *.test.jsx so the
  // server's src/**/*.test.js discovery never picks them up.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.jsx'],
    restoreMocks: true,
  },
});
