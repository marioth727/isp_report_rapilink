const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

async function deepSearch() {
    console.log(`--- 🕵️ DEEP SEARCH FOR 'sistemas@rapilink-sas' ---`);

    console.log('Fetching last 500 tickets from WispHub...');
    try {
        const res = await fetch(`https://api.wisphub.io/api/tickets/?limit=500&ordering=-id`, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        const data = await res.json();
        const tickets = data.results || [];
        console.log(`Fetched ${tickets.length} recent tickets.`);

        console.log('\nFetching generic search for "sistemas"...');
        const resSearch = await fetch(`https://api.wisphub.io/api/tickets/?search=sistemas`, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        const dataSearch = await resSearch.json();
        const searchResults = dataSearch.results || [];
        console.log(`Search Query returned ${searchResults.length} tickets.`);

        // Merge them
        tickets.push(...searchResults);

        const matches = [];
        const rawMatches = [];

        for (const t of tickets) {
            const jsonStr = JSON.stringify(t).toLowerCase();
            const searchTerm = 'sistemas@rapilink-sas';

            // Check strictly for the username/email requested
            if (jsonStr.includes(searchTerm) || jsonStr.includes('sistemas')) {
                // Determine exactly WHERE it matched for diagnosis
                let matchType = 'Unknown';
                if (t.tecnico_usuario === 'sistemas') matchType = 'tecnico_usuario';
                if (t.email_tecnico === 'sistemas@rapilink-sas') matchType = 'email_tecnico';
                if (t.tecnico && typeof t.tecnico === 'object') {
                    if (t.tecnico.usuario === 'sistemas') matchType = 'tecnico.usuario';
                    if (t.tecnico.email === 'sistemas@rapilink-sas') matchType = 'tecnico.email';
                }

                // If it matched just "sistemas" but not the specific email, note that
                if (matchType === 'Unknown' && jsonStr.includes('sistemas')) matchType = 'String Match (Contains)';

                matches.push({
                    id: t.id_ticket,
                    state: t.nombre_estado,
                    tech_name: t.nombre_tecnico,
                    match_type: matchType
                });

                if (rawMatches.length < 3) {
                    rawMatches.push(t); // Keep a few raw examples
                }
            }
        }

        console.log(`\nFound ${matches.length} tickets potentially related to 'sistemas':`);
        if (matches.length > 0) {
            console.table(matches);
            console.log('\n--- RAW EXAMPLE (First Match) ---');
            console.dir(rawMatches[0], { depth: null });
        } else {
            console.log("❌ ZERO matches found for 'sistemas' in the last 500 tickets.");
        }

    } catch (e) {
        console.error('Error fetching WispHub:', e);
    }
}

deepSearch();
