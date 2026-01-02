const https = require('https');

const API_KEY = 'xlDV3aBg.gQJkVMu0cD0LAeDRUHagcZ3o82pCDjfj';
const HOST = 'api.wisphub.net';

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            path: '/api' + path,
            method: 'GET',
            headers: {
                'Authorization': `Api-Key ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    console.log("Parse Error for path:", path);
                    resolve({});
                }
            });
        });

        req.on('error', (e) => {
            console.error("Request Error:", e.message);
            resolve({});
        });
        req.end();
    });
}

(async function () {
    console.log("--- DIAGNOSING WISPHUB SEARCH (CJS) ---");

    try {
        // 1. Baseline: Get Count of All
        const all = await makeRequest('/clientes/?limit=1');
        const totalCount = all.count || 0;
        console.log(`Total Clients: ${totalCount}`);

        if (totalCount === 0) {
            console.log("API returned 0 clients. Something is wrong with auth or path.");
            return;
        }

        const testTerm = 'quintero';

        // 2. Test Ignored Parameter
        const ignored = await makeRequest('/clientes/?limit=1&foo_bar=zzzzzz');
        console.log(`Ignored Param (foo_bar=zzzzzz): ${ignored.count} (Expected ~${totalCount})`);

        // 3. Test 'nombre__icontains'
        const res1 = await makeRequest(`/clientes/?limit=1&nombre__icontains=${testTerm}`);
        console.log(`nombre__icontains=${testTerm}: ${res1.count}`);

        // 4. Test 'search'
        const res2 = await makeRequest(`/clientes/?limit=1&search=${testTerm}`);
        console.log(`search=${testTerm}: ${res2.count}`);

        // 5. Test 'nombre' (Starts With behavior check)
        // If "quintero" is a surname, this should be low or 0 if startswith
        const res3 = await makeRequest(`/clientes/?limit=1&nombre=${testTerm}`);
        console.log(`nombre=${testTerm}: ${res3.count}`);

    } catch (e) {
        console.error("Fatal Error:", e);
    }
})();
