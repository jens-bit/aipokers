import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./e2e', testMatch:'show-landing.spec.js', workers:1, retries:0,
  use:{ baseURL:'http://127.0.0.1:5291', viewport:{width:390,height:844} },
  webServer:{ command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5291 --strictPort', url:'http://127.0.0.1:5291', reuseExistingServer:false },
});
