
const fs = require('fs');

try {
    const raw = fs.readFileSync('wisphub_postman.json');
    // Remove BOM if present
    const cleanRaw = raw.toString().replace(/^\uFEFF/, '');
    const data = JSON.parse(cleanRaw);

    function search(items) {
        items.forEach(item => {
            if (item.item) {
                search(item.item);
            }
            if (item.name && item.name.toLowerCase().includes('ticket')) {
                console.log('Name:', item.name);
                if (item.request) {
                    console.log('Method:', item.request.method);
                    console.log('URL:', typeof item.request.url === 'string' ? item.request.url : item.request.url.raw);
                    if (item.request.body) {
                        console.log('Body:', JSON.stringify(item.request.body, null, 2));
                    }
                }
                console.log('-------------------');
            }
        });
    }

    search(data.item);
} catch (error) {
    console.error('Error:', error.message);
}
