import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        timeout: 30 * 60 * 1000,
        proxyTimeout: 30 * 60 * 1000,
      },
      '/health': 'http://127.0.0.1:8080',
    },
  },
});
