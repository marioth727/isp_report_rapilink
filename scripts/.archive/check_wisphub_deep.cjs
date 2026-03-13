const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;
const targets = ['62779', '63003'];

async function checkWispHubDeep() {
    console.log('--- DEEP CHECK WHISPHUB ---');
    for (const id of targets) {
        try {
            const res = await fetch(`https://api.wisphub.io/api/tickets/${id}/`, {
                headers: { 'Authorization': `Api-Key ${apiKey}` }
            });
            if (res.ok) {
                const data = await res.json();
                console.log(`\nTICKET ${id} DATA:`, JSON.stringify(data, null, 2));
            } else {
                console.log(`\nTICKET ${id} FAIL: ${res.status}`);
                const text = await res.text();
                console.log(`Response: ${text.substring(0, 200)}`);
            }
        } catch (e) {
            console.log(`\nTICKET ${id} ERROR: ${e.message}`);
        }
    }
}

checkWispHubDeep();
