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
            console.log('Total Staff:', results.length);
            const target = results.find(s => String(s.id) === '1425025');
            if (target) {
                console.log('MATCH FOUND:');
                console.log('ID:', target.id);
                console.log('Nombre:', target.nombre);
                console.log('Usuario:', target.usuario);
                console.log('Email:', target.email);
            } else {
                console.log('ID 1425025 not found in staff list');
                // Find Mario
                const mario = results.find(s => s.nombre.toLowerCase().includes('mario'));
                if (mario) {
                    console.log('Found Mario with ID:', mario.id, 'Name:', mario.nombre);
                }
            }
        } catch (e) {
            console.error('Error parsing JSON');
        }
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
