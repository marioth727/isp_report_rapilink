
import fs from 'fs';

try {
    const raw = fs.readFileSync('wisphub.json', 'utf8');
    const data = JSON.parse(raw);

    function search(items) {
        items.forEach(item => {
            if (item.item) {
                search(item.item);
            }
            if (item.request && item.request.method === 'POST') {
                const url = typeof item.request.url === 'string' ? item.request.url : (item.request.url && item.request.url.raw ? item.request.url.raw : '');
                console.log('Action:', item.name);
                console.log('URL:', url);
                console.log('---');
            }
        });
    }

    if (data.item) search(data.item);
} catch (e) {
    console.error(e);
}
