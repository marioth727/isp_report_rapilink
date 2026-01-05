import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Diagnóstico inicial
const apiKey = (process.env.WISPHUB_API_KEY || process.env.VITE_WISPHUB_API_KEY || '').trim();
console.log('--- [PRODUCCIÓN] ISP REPORTS APP ---');
console.log(`Puerto: ${PORT}`);
console.log(`API Key: ${apiKey ? 'CONFIGURADA (' + apiKey.substring(0, 4) + '...)' : 'FALTANTE'}`);
console.log('-------------------------------------');

app.get('/api/proxy-status', (req, res) => {
    res.json({
        online: true,
        key_status: apiKey ? 'presente' : 'faltante',
        target_domain: 'api.wisphub.io'
    });
});

app.all('/api/wisphub/*', async (req, res) => {
    const currentKey = (process.env.WISPHUB_API_KEY || process.env.VITE_WISPHUB_API_KEY || '').trim();

    if (!currentKey) {
        return res.status(500).json({ error: 'Falta WISPHUB_API_KEY en Dokploy' });
    }

    // Extraemos el subpath (ej: clientes/)
    let subPath = req.params[0] || '';
    if (!subPath && req.path.includes('/api/wisphub/')) {
        subPath = req.path.split('/api/wisphub/')[1];
    }

    const queryString = req.url.split('?')[1] || '';

    // IMPORTANTE: Vite usa api.wisphub.io
    const targetUrl = `https://api.wisphub.io/api/${subPath}${queryString ? '?' + queryString : ''}`;

    console.log(`[Proxy] Redirigiendo ${req.method} a: ${targetUrl}`);

    try {
        const headers = {
            'Authorization': `Api-Key ${currentKey}`,
            'Api-Key': currentKey,
            'Accept': 'application/json',
            // SECRETO PARA EVITAR 403: Imitar a Vite local
            'Origin': 'https://api.wisphub.io',
            'Referer': 'https://api.wisphub.io/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        if (!['GET', 'HEAD'].includes(req.method)) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body)
        });

        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = { message: text.substring(0, 500) };
        }

        console.log(`[Proxy] Respuesta WispHub: ${response.status}`);
        res.status(response.status).json(data);

    } catch (error) {
        console.error('[Proxy Fatal]:', error.message);
        res.status(500).json({ error: 'Error de conexión', detalles: error.message });
    }
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ejecutándose en puerto ${PORT}`);
});
