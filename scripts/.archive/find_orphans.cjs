const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

async function findOrphans() {
    console.log('--- FINDING ORPHAN TICKETS ---');

    // 1. Get active tickets from WispHub
    const res = await fetch('https://api.wisphub.io/api/tickets/?limit=100&id_estado__in=1,2', {
        headers: { 'Authorization': `Api-Key ${apiKey}` }
    });
    const whData = await res.json();
    const whIds = new Set((whData.results || []).map(t => String(t.id)));

    console.log(`Active tickets in WispHub: ${whIds.size}`);

    // 2. Get active processes from Supabase
    const { data: dbProcs } = await s.from('workflow_processes')
        .select('id, reference_id, metadata')
        .eq('status', 'PE');

    console.log(`Active processes in Supabase: ${dbProcs.length}`);

    // 3. Compare
    for (const proc of dbProcs) {
        if (!whIds.has(proc.reference_id)) {
            console.log(`\nPotential Orphan Found: Ticket ${proc.reference_id}`);
            console.log(`  Tech in DB: ${proc.metadata?.technician_name}`);

            // Try to fetch it individually to see why it's missing from the list
            try {
                const individualRes = await fetch(`https://api.wisphub.io/api/tickets/${proc.reference_id}/`, {
                    headers: { 'Authorization': `Api-Key ${apiKey}` }
                });
                if (individualRes.ok) {
                    const t = await individualRes.json();
                    console.log(`  Individual Fetch OK!`);
                    console.log(`  Real State in WH: ${t.nombre_estado} (ID: ${t.id_estado})`);
                    console.log(`  Real Tech in WH: ${t.nombre_tecnico} (${t.tecnico_usuario})`);
                } else {
                    console.log(`  Individual Fetch FAIL: ${individualRes.status}`);
                    const text = await individualRes.text();
                    console.log(`  Error detail: ${text.substring(0, 100)}`);
                }
            } catch (e) {
                console.log(`  Fetch error: ${e.message}`);
            }
        }
    }
}

findOrphans();
