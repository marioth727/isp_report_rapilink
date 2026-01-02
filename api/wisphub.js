
export default async function handler(req, res) {
    // 1. Handle CORS Preflight
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const url = new URL(req.url, `https://${req.headers.host}`);
    const fullPath = url.pathname;
    const apiPath = fullPath.replace(/^\/api\/wisphub\//, '');
    const searchParams = url.search;

    // Diagnostic endpoint
    if (apiPath === 'health') {
        const key = process.env.VITE_WISPHUB_API_KEY || '';
        return res.status(200).json({
            status: 'ok',
            config: {
                hasKey: !!key,
                keyLength: key.length,
                keyPrefix: key.substring(0, 4),
                keySuffix: key.substring(key.length - 4),
                nodeVersion: process.version,
                envType: process.env.NODE_ENV
            }
        });
    }

    const API_KEY = process.env.VITE_WISPHUB_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({
            error: 'VITE_WISPHUB_API_KEY is missing in Vercel environment.',
            tip: 'Go to Vercel Dashboard -> Settings -> Environment Variables and ensure VITE_WISPHUB_API_KEY is set.'
        });
    }

    const targetUrl = `https://api.wisphub.io/api/${apiPath}${searchParams}`;
    console.log(`[Proxy] Forwarding ${req.method} to: ${targetUrl}`);

    try {
        const fetchOptions = {
            method: req.method,
            headers: {
                'Authorization': `Api-Key ${API_KEY}`,
                'Api-Key': API_KEY, // Doubling up for compatibility
                'Accept': 'application/json',
            }
        };

        // If it's a POST/PUT request, forward the body
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
            fetchOptions.headers['Content-Type'] = req.headers['content-type'] || 'application/json';
            fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        }

        const response = await fetch(targetUrl, fetchOptions);

        // Handle non-JSON responses gracefully
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            return res.status(response.status).json(data);
        } else {
            const text = await response.text();
            return res.status(response.status).send(text);
        }
    } catch (error) {
        console.error('[Proxy Error]', error);
        return res.status(500).json({ error: 'Proxy Exception', message: error.message });
    }
}
