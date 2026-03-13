import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: false,
      hmr: {
        port: 5173,
        host: 'localhost'
      },
      proxy: {
        '/api/wisphub': {
          target: 'https://api.wisphub.io',
          changeOrigin: true,
          secure: false, // OBLIGATORIO: El certificado de api.wisphub.io puede ser visto como expirado por Node
          rewrite: (path) => path.replace(/^\/api\/wisphub/, '/api'),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, _req, _res) => {
              const apiKey = env.VITE_WISPHUB_API_KEY || '';
              // Solo dejamos la cabecera que confirmamos que funciona en el script standalone
              proxyReq.setHeader('Authorization', `Api-Key ${apiKey}`);
              proxyReq.setHeader('Accept', 'application/json');
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
