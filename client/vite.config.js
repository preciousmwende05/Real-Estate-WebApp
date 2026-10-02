import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the React app talks to both back-ends through this proxy,
// so the browser only ever sees one origin (no CORS issues, no hard-coded ports).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',      // Node.js / Express
      '/uploads': 'http://localhost:4000',  // property images
      '/search': 'http://localhost:5001',   // Flask search & analytics
    },
  },
});
