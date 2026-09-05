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
    // Process real CSS instead of stubbing the imports, so getComputedStyle
    // sees stylesheet rules and not just inline styles. The BUG-02 font-size
    // check is worthless without it: every text field styled from a .css file
    // would read as jsdom's 16px default and pass by accident.
    css: true,
  },
});
