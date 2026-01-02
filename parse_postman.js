
const fs = require('fs');
try {
    const raw = fs.readFileSync('wisphub_postman.json', 'utf8'); // Try utf8 first
    const data = JSON.parse(raw);

    function findTickets(items) {
        for (const item of items) {
            if (item.name && item.name.toLowerCase().includes('ticket')) {
                console.log('--- Found Ticket Item: ' + item.name + ' ---');
                if (item.request) {
                    console.log('Method:', item.request.method);
                    console.log('URL:', item.request.url.raw);
                    if (item.request.body) {
                        console.log('Body:', JSON.stringify(item.request.body, null, 2));
                    }
                }
            }
            if (item.item) {
                findTickets(item.item);
            }
        }
    }

    findTickets(data.item);
} catch (e) {
    console.error(e);
}
