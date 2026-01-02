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
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.log("Parse Error for path:", path, data.substring(0, 100));
                    resolve({});
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function run() {
    console.log("--- DIAGNOSING WISPHUB SEARCH ---");

    // 1. Baseline: Get Count of All
    const all = await makeRequest('/clientes/?limit=1');
    const totalCount = all.count;
    console.log(`Total Clients: ${totalCount}`);

    // 2. Test Ignored Parameter
    // If a param is ignored, it should return totalCount (or close to it)
    const ignored = await makeRequest('/clientes/?limit=1&foo_bar=zzzzzz');
    console.log(`Ignored Param (foo_bar=zzzzzz) Count: ${ignored.count} (Should be ${totalCount})`);

    // 3. Test 'nombre__icontains'
    // Search for something rare like "w" or "z" or a likely substring
    const p1 = 'nombre__icontains';
    const val = 'quintero';
    const res1 = await makeRequest(`/clientes/?limit=1&${p1}=${val}`);
    console.log(`Param '${p1}=${val}' Count: ${res1.count}`);

    // 4. Test 'search'
    const p2 = 'search';
    const res2 = await makeRequest(`/clientes/?limit=1&${p2}=${val}`);
    console.log(`Param '${p2}=${val}' Count: ${res2.count}`);

    // 5. Test 'q'
    const p3 = 'q';
    const res3 = await makeRequest(`/clientes/?limit=1&${p3}=${val}`);
    console.log(`Param '${p3}=${val}' Count: ${res3.count}`);

    // 6. Test 'nombre' (Starts With)
    const p4 = 'nombre';
    const res4 = await makeRequest(`/clientes/?limit=1&${p4}=${val}`);
    console.log(`Param '${p4}=${val}' Count: ${res4.count}`);

    console.log("--- CONCLUSION ---");
    if (res1.count < totalCount && res1.count > 0) console.log("Suggestion: Use 'nombre__icontains'");
    else if (res2.count < totalCount && res2.count > 0) console.log("Suggestion: Use 'search'");
    else console.log("No obvious substring search found.");
}

run();
