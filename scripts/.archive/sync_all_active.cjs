const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

async function syncAllActive() {
    console.log('--- RE-SYNCING ALL LOCALLY ACTIVE TICKETS ---');

    // 1. Get all tickets with pending workitems in Supabase
    const { data: dbProcs } = await s.from('workflow_processes')
        .select('id, reference_id, metadata')
        .eq('status', 'PE');

    console.log(`Found ${dbProcs.length} active processes in DB.`);

    const results = [];

    for (const proc of dbProcs) {
        try {
            const res = await fetch(`https://api.wisphub.io/api/tickets/${proc.reference_id}/`, {
                headers: { 'Authorization': `Api-Key ${apiKey}` }
            });

            if (res.ok) {
                const wh = await res.json();
                const whStatus = wh.id_estado || wh.estado;
                const whTech = wh.nombre_tecnico || wh.tecnico;
                const whTechUser = wh.tecnico_usuario || (wh.tecnico && typeof wh.tecnico === 'object' ? wh.tecnico.usuario : null);

                const localTech = proc.metadata?.technician_name;

                // Detection
                const techChanged = whTech !== localTech;
                const statusClosed = (whStatus !== 1 && whStatus !== 2 && whStatus !== 'Nuevo' && whStatus !== 'En Progreso');

                if (techChanged || statusClosed) {
                    console.log(`\nDISCREPANCY DETECTED for Ticket ${proc.reference_id}:`);
                    console.log(`  Local Tech: ${localTech}`);
                    console.log(`  WispHub Tech: ${whTech} (${whTechUser})`);
                    console.log(`  WispHub Status: ${whStatus}`);
                    results.push({ id: proc.id, ref: proc.reference_id, tech: whTech, techUser: whTechUser, status: whStatus, closed: statusClosed });
                }
            } else if (res.status === 404 || res.status === 403) {
                console.log(`\nTicket ${proc.reference_id} NOT ACCESSIBLE (Status ${res.status}). Should probably close locally.`);
                results.push({ id: proc.id, ref: proc.reference_id, error: res.status });
            }
        } catch (e) {
            // console.log(`Error for ${proc.reference_id}: ${e.message}`);
        }
    }

    console.log(`\nSummary: ${results.length} discrepancies found.`);
    // console.log(JSON.stringify(results, null, 2));

    // Optional: Auto-fix for Mario's tickets if found
    const marioTargets = ['62779', '63003'];
    for (const r of results) {
        if (marioTargets.includes(r.ref)) {
            console.log(`\nAUTO-FIXING Mario's ticket ${r.ref}...`);
            if (r.closed || r.error) {
                await s.from('workflow_workitems').update({ status: 'CO' }).eq('status', 'PE').match({ 'workflow_activities.process_id': r.id }); // This query is complex, let's keep it simple
                await s.from('workflow_processes').update({ status: 'CO' }).eq('id', r.id);
                console.log(`  Ticket ${r.ref} marked as COMPLETED locally.`);
            } else {
                // Update technician
                await s.from('workflow_processes').update({
                    metadata: { ...dbProcs.find(p => p.id === r.id).metadata, technician_name: r.tech }
                }).eq('id', r.id);
                // We also need to move the WorkItem...
                console.log(`  Ticket ${r.ref} updated to technician ${r.tech}.`);
            }
        }
    }
}

syncAllActive();
