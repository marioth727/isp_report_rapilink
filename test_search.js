import fetch from 'node-fetch';

const API_KEY = 'xlDV3aBg.gQJkVMu0cD0LAeDRUHagcZ3o82pCDjfj';
const BASE_URL = 'https://api.wisphub.net/api';

async function testSearch(param, query) {
    try {
        console.log(`\n--- Testing ${param}=${query} ---`);
        const url = `${BASE_URL}/clientes/?limit=5&${param}=${encodeURIComponent(query)}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Api-Key ${API_KEY}` }
        });

        if (!response.ok) {
            console.log("Error:", response.status, response.statusText);
            return;
        }

        const data = await response.json();
        console.log(`Results: ${data.count || 0}`);
        if (data.results && data.results.length > 0) {
            data.results.forEach(c => console.log(` - ${c.nombre} (ID: ${c.id_servicio})`));
        } else {
            console.log("No results found.");
        }

    } catch (error) {
        console.error("Exception:", error.message);
    }
}

async function run() {
    // 1. Test basic name (Expected to work)
    await testSearch('nombre', 'Juan');

    // 2. Test full name (User reported failure) - I'll try a common name likely to exist or just "Juan Perez" failure case
    // To make this valid, I need a name that actually exists. 
    // From previous logs/context, I don't have a specific client name. 
    // I will try to find a client first, then search for them.

    console.log("\n--- Finding a client to test with ---");
    const initResponse = await fetch(`${BASE_URL}/clientes/?limit=1`, {
        headers: { 'Authorization': `Api-Key ${API_KEY}` }
    });
    const initData = await initResponse.json();
    const client = initData.results[0];

    if (client) {
        console.log(`Using Client: ${client.nombre}`);
        const parts = client.nombre.split(' ');
        if (parts.length > 1) {
            const firstName = parts[0];
            const fullName = client.nombre;

            // 3. Test exact full name with 'nombre'
            await testSearch('nombre', fullName);

            // 4. Test 'nombre__icontains' with full name
            await testSearch('nombre__icontains', fullName);

            // 5. Test 'search' with full name
            await testSearch('search', fullName);
        }
    }
}

run();
