
import fs from 'fs';

try {
    const raw = fs.readFileSync('wisphub.json', 'utf8');
    const data = JSON.parse(raw);

    function search(items) {
        items.forEach(item => {
            if (item.item) {
                search(item.item);
            }
            if (item.request) {
                const method = item.request.method;
                const url = typeof item.request.url === 'string' ? item.request.url : (item.request.url && item.request.url.raw ? item.request.url.raw : '');

                if (method === 'POST' && url.includes('ticket')) {
                    console.log('Action Name:', item.name);
                    console.log('Method:', method);
                    console.log('URL:', url);
                    if (item.request.body) {
                        console.log('Body:', JSON.stringify(item.request.body, null, 2));
                    }
                    console.log('====================================');
                }
            }
        });
    }

    if (data.item) search(data.item);
} catch (e) {
    console.error("Parse Error:", e);
}
