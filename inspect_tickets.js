
import https from 'https';

const options = {
    hostname: 'api.wisphub.io',
    // Try to list tickets. We might need a client ID or service ID.
    // Based on common patterns: /tickets/ or /tickets/?servicio=ID
    // Let's try listing recent tickets generally first, or assume we filter by service.
    path: '/api/tickets/?limit=5',
    headers: {
        'Authorization': 'Api-Key xlDV3aBg.gQJkVMu0cD0LAeDRUHagcZ3o82pCDjfj'
    }
};

console.log(`Checking: ${options.hostname}${options.path}`);

https.get(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            console.log('Status:', res.statusCode);
            const json = JSON.parse(data);
            if (json.results) {
                console.log('Tickets Found:', json.results.length);
                if (json.results.length > 0) {
                    console.log('Sample Ticket:', JSON.stringify(json.results[0], null, 2));
                }
            } else {
                console.log('Response Structure:', Object.keys(json));
            }
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw data:', data.substring(0, 500));
        }
    });
}).on('error', (e) => {
    console.error(e);
});
