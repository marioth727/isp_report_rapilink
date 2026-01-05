import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Necesario para leer el cuerpo de los POST si los hay
app.use(express.json());

// Proxy Manual para WispHub (Basado en la lógica exitosa de Vercel)
app.all('/api/wisphub/*', async (req, res) => {
    const apiKey = (process.env.WISPHUB_API_KEY || process.env.VITE_WISPHUB_API_KEY || '').trim();
    // Extraemos la parte de la URL después de /api/wisphub/
    const targetPath = req.params[0] || req.path.replace('/api/wisphub/', '');
    const queryString = req.url.split('?')[1] || '';

    if (!apiKey) {
        console.error('[Proxy Error] WISPHUB_API_KEY no encontrada en variables de entorno');
        return res.status(500).json({ error: 'Falta la API Key en el servidor (Env Var)' });
    }

    const targetUrl = `https://wisphub.net/api/${targetPath}${queryString ? '?' + queryString : ''}`;
    console.log(`[Proxy] Solicitud a WispHub: ${req.method} ${targetUrl}`);

    try {
        const fetchOptions = {
            method: req.method,
            headers: {
                'Authorization': `Api-Key ${apiKey}`,
                'Api-Key': apiKey,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        if (!['GET', 'HEAD'].includes(req.method)) {
            fetchOptions.body = JSON.stringify(req.body);
        }

        const response = await fetch(targetUrl, fetchOptions);

        // WispHub puede devolver errores que no son JSON (ej. HTML de error)
        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            data = { message: text.substring(0, 500) }; // Solo los primeros 500 caracteres
        }

        console.log(`[Proxy] WispHub respondió con status: ${response.status}`);
        res.status(response.status).json(data);
    } catch (error) {
        console.error('[Proxy Error] Error fatal al conectar:', error.message);
        res.status(500).json({ error: `Fallo crítico de conexión: ${error.message}` });
    }
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'dist')));

// SPA Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor ejecutándose en puerto ${PORT} (0.0.0.0)`);
});
