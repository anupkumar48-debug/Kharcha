import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1500 },
  server: { host: true, port: 5173 },
});
