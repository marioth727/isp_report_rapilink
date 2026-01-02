
import https from 'https';

const options = {
    hostname: 'api.wisphub.io',
    path: '/api/clientes/?limit=1',
    headers: {
        'Authorization': 'Api-Key xlDV3aBg.gQJkVMu0cD0LAeDRUHagcZ3o82pCDjfj'
    }
};

https.get(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.results && json.results.length > 0) {
                const client = json.results[0];
                console.log('Client Keys:', Object.keys(client));
                // Print date-like fields
                console.log('Possible Date Fields:');
                for (const key in client) {
                    if (key.includes('fecha') || key.includes('date') || key.includes('created') || key.includes('instalacion')) {
                        console.log(`${key}: ${client[key]}`);
                    }
                }
            } else {
                console.log('No results found');
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw data sample:', data.substring(0, 200));
        }
    });
}).on('error', (e) => {
    console.error(e);
});
