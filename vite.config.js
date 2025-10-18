import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This file is not in the original repo, but is required for react plugin. Assuming it's needed.
// If not, the react() call can be removed.
// We are also assuming vite and @vitejs/plugin-react are in devDependencies.

export default defineConfig({
  plugins: [], // Assuming react() is not needed if not in package.json
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
