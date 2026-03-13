const https = require('https');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.VITE_WISPHUB_API_KEY;

const options = {
    hostname: 'api.wisphub.net',
    path: '/api/staff/',
    headers: {
        'Authorization': `Api-Key ${apiKey}`
    }
};

https.get(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const results = JSON.parse(data).results;
            const target = results.find(s => String(s.id) === '1425025');
            console.log('--- Target Staff (1425025) ---');
            console.log(JSON.stringify(target, null, 2));
        } catch (e) {
            console.error('Error parsing JSON');
            console.log(data);
        }
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
