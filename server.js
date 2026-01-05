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

// Diagnóstico de inicio para ver en los logs de Dokploy
const apiKey = (process.env.WISPHUB_API_KEY || process.env.VITE_WISPHUB_API_KEY || '').trim();
console.log('--- [DIAGNÓSTICO] ISP REPORTS APP ---');
console.log(`Puerto de escucha: ${PORT}`);
console.log(`Variable WISPHUB_API_KEY: ${process.env.WISPHUB_API_KEY ? 'Detectada' : 'No detectada'}`);
console.log(`Variable VITE_WISPHUB_API_KEY: ${process.env.VITE_WISPHUB_API_KEY ? 'Detectada' : 'No detectada'}`);
console.log(`Llave final a usar: ${apiKey ? apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4) : 'VACÍA'}`);
console.log('--------------------------------------');

// Ruta de diagnóstico rápido (accede a /api/proxy-status en tu navegador)
app.get('/api/proxy-status', (req, res) => {
    res.json({
        online: true,
        key_status: apiKey ? 'configurada' : 'faltante',
        key_preview: apiKey ? `${apiKey.substring(0, 4)}...` : 'n/a',
        node: process.version
    });
});

app.all('/api/wisphub/*', async (req, res) => {
    const currentKey = (process.env.WISPHUB_API_KEY || process.env.VITE_WISPHUB_API_KEY || '').trim();

    if (!currentKey) {
        console.error('[Proxy Error] No hay API Key configurada');
        return res.status(500).json({ error: 'API Key no configurada en Dokploy' });
    }

    // Limpiamos el path para asegurar que la URL es correcta
    let targetPath = req.params[0] || req.path.replace('/api/wisphub/', '');
    if (targetPath.startsWith('/')) targetPath = targetPath.substring(1);

    const queryString = req.url.split('?')[1] || '';
    const targetUrl = `https://wisphub.net/api/${targetPath}${queryString ? '?' + queryString : ''}`;

    console.log(`[Proxy] Mandando ${req.method} a: ${targetUrl}`);

    try {
        const headers = {
            'Authorization': `Api-Key ${currentKey}`,
            'Api-Key': currentKey,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        // IMPORTANTE: Solo enviamos Content-Type si NO es un GET/HEAD
        // Enviar Content-Type en un GET puede causar 403 en algunos proxies de seguridad
        if (!['GET', 'HEAD'].includes(req.method)) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body)
        });

        console.log(`[Proxy] WispHub respondió con STATUS: ${response.status}`);

        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
            // Si hay error, lo logueamos para verlo en Dokploy
            if (response.status >= 400) {
                console.error('[Proxy Response Error]:', JSON.stringify(data));
            }
        } else {
            const text = await response.text();
            data = { message: text.substring(0, 300) };
            if (response.status >= 400) {
                console.error('[Proxy Response HTML Error]:', text.substring(0, 300));
            }
        }

        res.status(response.status).json(data);

    } catch (error) {
        console.error('[Proxy Fatal Error]:', error.message);
        res.status(500).json({ error: 'Error de conexión con la API', detallles: error.message });
    }
});

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor listo en puerto ${PORT}`);
});
