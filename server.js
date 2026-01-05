import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración del Proxy para WispHub
app.use('/api/wisphub', createProxyMiddleware({
    target: 'https://wisphub.net/api',
    changeOrigin: true,
    pathRewrite: {
        '^/api/wisphub': '',
    },
    onProxyReq: (proxyReq) => {
        const apiKey = process.env.WISPHUB_API_KEY;
        if (apiKey) {
            proxyReq.setHeader('Authorization', `Api-Key ${apiKey}`);
        }
    },
    logLevel: 'debug'
}));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'dist')));

// SPA Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en puerto ${PORT}`);
});
