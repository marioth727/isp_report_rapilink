import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/wisphub': {
        target: 'https://api.wisphub.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/wisphub/, '/api'),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            proxyReq.setHeader('Origin', 'https://api.wisphub.io');
            proxyReq.setHeader('Referer', 'https://api.wisphub.io/');
            // Keep a standard browser UA just in case
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          });
        },
      },
    },
  },
})
