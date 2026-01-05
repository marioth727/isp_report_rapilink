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
app.use('/api/wisphub', (req, res, next) => {
    console.log(`[Proxy] Solicitud recibida: ${req.method} ${req.url}`);
    next();
}, createProxyMiddleware({
    target: 'https://wisphub.net/api',
    changeOrigin: true,
    pathRewrite: {
        '^/api/wisphub': '',
    },
    onProxyReq: (proxyReq, req, res) => {
        const apiKey = (process.env.WISPHUB_API_KEY || '').trim();

        if (!apiKey) {
            console.error('[Proxy Error] WISPHUB_API_KEY no encontrada en variables de entorno');
        } else {
            console.log(`[Proxy] Aplicando API Key: ${apiKey.substring(0, 4)}***`);

            // Replicamos la configuración exacta que funcionaba en Vercel
            proxyReq.setHeader('Authorization', `Api-Key ${apiKey}`);
            proxyReq.setHeader('Api-Key', apiKey);
            proxyReq.setHeader('Accept', 'application/json');
            proxyReq.setHeader('Host', 'wisphub.net');
        }

        // Limpiar cabeceras que pueden causar conflictos de seguridad (403)
        proxyReq.removeHeader('Origin');
        proxyReq.removeHeader('Referer');
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    },
    onError: (err, req, res) => {
        console.error('[Proxy Error] Error al conectar con WispHub:', err.message);
        res.status(500).json({ error: 'Error de conexión con el proveedor (Proxy)' });
    },
    logLevel: 'debug'
}));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'dist')));

// SPA Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ejecutándose en puerto ${PORT} (0.0.0.0)`);
});
