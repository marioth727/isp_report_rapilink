
export default async function handler(req, res) {
    // 1. Get the path from the query (Vercel provides it in req.url or we can extract it)
    const url = new URL(req.url, `https://${req.headers.host}`);
    const fullPath = url.pathname; // e.g., /api/wisphub/clientes/

    // 2. Extract the part after /api/wisphub/
    const apiPath = fullPath.replace(/^\/api\/wisphub\//, '');
    const searchParams = url.search;

    // 3. Construct the target URL
    const targetUrl = `https://api.wisphub.net/api/${apiPath}${searchParams}`;

    const API_KEY = process.env.VITE_WISPHUB_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: 'VITE_WISPHUB_API_KEY is not configured in Vercel environment variables.' });
    }

    console.log(`[Proxy] Forwarding to: ${targetUrl}`);

    try {
        const options = {
            method: req.method,
            headers: {
                'Authorization': `Api-Key ${API_KEY}`,
                'Content-Type': 'application/json',
            }
        };

        // If it's a POST/PUT request, forward the body
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            // Check if it's FormData or JSON
            if (req.headers['content-type']?.includes('multipart/form-data')) {
                // For FormData, we might need a more complex handling if using a library, 
                // but for simple cases we can try to pass the buffer if provided.
                // However, the CRM mostly uses JSON for everything except tickets which uses FormData.
                // Let's handle regular json body for now.
                options.body = req.body;
            } else {
                options.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
        }

        const response = await fetch(targetUrl, options);
        const data = await response.json().catch(() => null);

        res.status(response.status).json(data || { status: response.statusText });
    } catch (error) {
        console.error('[Proxy Error]', error);
        res.status(500).json({ error: 'Error connecting to WispHub API', details: error.message });
    }
}
