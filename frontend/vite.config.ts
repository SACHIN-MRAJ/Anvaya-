import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api and the did:web document go to the FastAPI backend (backend/, port 8000) during development,
// so cookies are same-origin and no CORS set-up is needed in the browser.
const backend = { target: 'http://127.0.0.1:8000', changeOrigin: false };

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5180, strictPort: true, proxy: { '/api': backend, '/.well-known': backend } },
  preview: { host: '0.0.0.0', port: 5180, strictPort: true, proxy: { '/api': backend, '/.well-known': backend } },
  build: {
    // Raise the warning threshold so Recharts (large charting lib) doesn't trigger it,
    // and split vendor code into its own chunk so the main bundle stays smaller.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui':       ['framer-motion', 'lucide-react'],
          'vendor-charts':   ['recharts'],
          'vendor-flow':     ['@xyflow/react'],
        },
      },
    },
  },
});
