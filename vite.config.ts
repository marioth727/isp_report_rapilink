import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/wisphub': {
          target: 'https://api.wisphub.io',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/wisphub/, '/api'),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, _req, _res) => {
              const apiKey = env.VITE_WISPHUB_API_KEY || '';
              proxyReq.setHeader('Authorization', `Api-Key ${apiKey}`);
              proxyReq.setHeader('Api-Key', apiKey);
              proxyReq.setHeader('Origin', 'https://api.wisphub.io');
              proxyReq.setHeader('Referer', 'https://api.wisphub.io/');
              proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            });
          },
        },
        '/api/smartolt': {
          target: 'https://rapilinksas.smartolt.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/smartolt/, '/api'),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, _req, _res) => {
              const apiKey = env.VITE_SMARTOLT_API_KEY || '';
              proxyReq.setHeader('X-Token', apiKey);
            });
          },
        },
      },
    },
  }
})
