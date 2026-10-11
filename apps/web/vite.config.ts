import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:3000';

const VENDOR_PACKAGES =
  /^(react|react-dom|react-router|react-router-dom|scheduler|zustand|@tanstack)\//;
const REALTIME_PACKAGES =
  /^(socket\.io-client|socket\.io-parser|engine\.io-client|engine\.io-parser|@socket\.io)\//;

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Libraries change with a dependency bump, the app with every deploy. Kept apart, a
        // phone that has the libraries does not download them again for each release.
        manualChunks(id) {
          // pnpm nests packages, so the one a file belongs to is named after the last of these.
          const name = id.split('/node_modules/').slice(1).pop();
          if (!name) return undefined;
          if (REALTIME_PACKAGES.test(name)) return 'realtime';
          if (VENDOR_PACKAGES.test(name)) return 'vendor';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': API_TARGET,
      '/socket.io': { target: API_TARGET, ws: true },
    },
  },
});
