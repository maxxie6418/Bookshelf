import { defineConfig } from 'vite';

// SPA 构建到 dist/，由 Cloudflare Worker 的 Workers Assets 托管。
export default defineConfig({
  root: 'src/web',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});