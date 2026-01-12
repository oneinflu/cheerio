import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://seal-app-6t78w.ondigitalocean.app',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'https://seal-app-6t78w.ondigitalocean.app',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
