import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    hmr: {
      clientPort: 5000
    },
    allowedHosts: true,
    headers: {
      'X-Frame-Options': 'ALLOWALL'
    }
  }
});
