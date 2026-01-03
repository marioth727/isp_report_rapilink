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

    const url = new URL(req.url, https://);
    const fullPath = url.pathname;
    
    // Improved path extraction: remove /api/wisphub and ensure no leading slash for the target api path
    let apiPath = fullPath.replace(/^\/api\/wisphub/, '');
    if (apiPath.startsWith('/')) apiPath = apiPath.substring(1);
    
    const searchParams = url.search;

    // Diagnostic endpoint
    if (apiPath === 'health') {
        // Try both with and without VITE_ prefix
        const key = process.env.WISPHUB_API_KEY || process.env.VITE_WISPHUB_API_KEY || '';
        return res.status(200).json({
            status: 'ok',
            config: {
                hasKey: !!key,
                keyLength: key.length,
                keyPrefix: key.substring(0, 4),
                keySuffix: key.substring(key.length - 4),
                nodeVersion: process.version,
                envType: process.env.NODE_ENV,
                originalPath: fullPath,
                extractedApiPath: apiPath,
                envVars: {
                    hasWISPHUB_API_KEY: !!process.env.WISPHUB_API_KEY,
                    hasVITE_WISPHUB_API_KEY: !!process.env.VITE_WISPHUB_API_KEY
                }
            }
        });
    }

    // Try both with and without VITE_ prefix for compatibility
    const API_KEY = process.env.WISPHUB_API_KEY || process.env.VITE_WISPHUB_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({
            error: 'API Key is missing in Vercel environment.',
            tip: 'Go to Vercel Dashboard -> Settings -> Environment Variables and ensure WISPHUB_API_KEY (without VITE_ prefix) is set.',
            debug: {
                hasWISPHUB_API_KEY: !!process.env.WISPHUB_API_KEY,
                hasVITE_WISPHUB_API_KEY: !!process.env.VITE_WISPHUB_API_KEY
            }
        });
    }

    // WispHub is very strict with trailing slashes. 
    // If the path does not end in a slash and it is not a file access, we add it.
    let finalPath = apiPath;
    if (finalPath && !finalPath.endsWith('/') && !finalPath.includes('.')) {
        finalPath += '/';
    }

    const targetUrl = https://api.wisphub.io/api/;
    console.log([Proxy] Forwarding  to: );

    try {
        const fetchOptions = {
            method: req.method,
            headers: {
                'Authorization': Api-Key ,
                'Api-Key': API_KEY,
                'Accept': 'application/json',
            }
        };

        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
            fetchOptions.headers['Content-Type'] = req.headers['content-type'] || 'application/json';
            fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        }

        const response = await fetch(targetUrl, fetchOptions);

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
