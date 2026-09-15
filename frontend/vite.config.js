import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Vite checks the Host header to prevent DNS-rebinding attacks.
    // When Nginx proxies to us, it forwards Host: frontend (the container
    // name), which Vite doesn't recognize by default. Allow it explicitly.
    allowedHosts: ['frontend', 'localhost', '127.0.0.1'],
    // Lets you hit :5173 directly during dev and still have /api/* work,
    // by forwarding to Nginx (which then routes to the right service).
    // This mirrors what Nginx does on :8080, just for dev convenience.
    proxy: {
      '/api': {
        target: 'http://nginx:8080',
        changeOrigin: true,
      },
    },
  },
});
