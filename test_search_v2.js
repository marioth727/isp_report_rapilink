const https = require('https');

const API_KEY = 'xlDV3aBg.gQJkVMu0cD0LAeDRUHagcZ3o82pCDjfj';
const BASE_URL = 'api.wisphub.net';

function fetchUrl(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            path: '/api' + path,
            method: 'GET',
            headers: {
                'Authorization': `Api-Key ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error(`Status Code: ${res.statusCode}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function testSearch(param, query) {
    try {
        console.log(`\n--- Testing ${param}=${query} ---`);
        const path = `/clientes/?limit=5&${param}=${encodeURIComponent(query)}`;
        const data = await fetchUrl(path);

        console.log(`Results: ${data.count || 0}`);
        if (data.results && data.results.length > 0) {
            data.results.forEach(c => console.log(` - ${c.nombre} (ID: ${c.id_servicio})`));
        } else {
            console.log("No results found.");
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

async function run() {
    try {
        console.log("Fetching a sample client...");
        const initData = await fetchUrl('/clientes/?limit=1');
        const client = initData.results[0];

        if (client) {
            console.log(`Using Client: ${client.nombre}`);

            // Test 1: Exact Match (What we have now)
            await testSearch('nombre', client.nombre);

            // Test 2: Partial Match / Contains
            await testSearch('nombre__icontains', client.nombre);

            // Test 3: Generic Search
            await testSearch('search', client.nombre);
        }
    } catch (e) {
        console.error("Fatal:", e);
    }
}

run();
