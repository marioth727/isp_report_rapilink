const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

const targets = ['62779', '63003'];

async function audit() {
    console.log(`\n🔍 AUDITORÍA FORENSE - ${new Date().toISOString()}`);
    
    for (const ref of targets) {
        console.log(`\n==================================================`);
        console.log(` 🎫 TICKET: ${ref}`);
        console.log(`==================================================`);

        // 1. VERDAD EN WISPHUB (API DIRECTA)
        console.log(`[WISPHUB API CHECK]`);
        try {
            const res = await fetch(`https://api.wisphub.io/api/tickets/${ref}/`, {
                headers: { 'Authorization': `Api-Key ${apiKey}` }
            });
            if (res.ok) {
                const wh = await res.json();
                console.log(`  > STATUS ID: ${wh.id_estado} | NOMBRE: ${wh.nombre_estado || wh.estado}`);
                console.log(`  > TECNICO  : ${wh.nombre_tecnico || wh.tecnico}`);
                console.log(`  > USUARIO  : ${wh.tecnico_usuario}`);
                // Dump raw technical fields just in case
                console.log(`  > RAW KEYS : tecnico=${JSON.stringify(wh.tecnico)}, tecnico_id=${wh.tecnico_id}`);
            } else {
                console.log(`  > ERROR HTTP: ${res.status}`);
            }
        } catch (e) {
            console.log(`  > ERROR FETCH: ${e.message}`);
        }

        // 2. VERDAD EN SUPABASE (PROCESOS)
        console.log(`\n[SUPABASE DB CHECK]`);
        const { data: procs, error: procError } = await s
            .from('workflow_processes')
            .select('*')
            .eq('reference_id', ref);

        if (procError) console.log(`  > DB ERROR: ${procError.message}`);
        console.log(`  > PROCESOS ENCONTRADOS: ${procs?.length || 0}`);

        if (procs) {
            for (const p of procs) {
                console.log(`  -------------`);
                console.log(`  Process ID: ${p.id}`);
                console.log(`  Status    : ${p.status}`);
                console.log(`  Metadata  : Tech="${p.metadata?.technician_name}"`);
                
                // 3. VERDAD EN SUPABASE (WORKITEMS)
                const { data: wis } = await s
                    .from('workflow_workitems')
                    .select('*')
                    .eq('activity_id', (await s.from('workflow_activities').select('id').eq('process_id', p.id).single()).data?.id); // Simplified lookup via logic, acts might be multiple, better query below 

                // Better query for WIs
                const { data: acts } = await s.from('workflow_activities').select('id, name').eq('process_id', p.id);
                if (acts && acts.length > 0) {
                     const actIds = acts.map(a => a.id);
                     const { data: realWis } = await s.from('workflow_workitems').select('*').in('activity_id', actIds);
                     
                     console.log(`  > WorkItems (${realWis?.length || 0}):`);
                     realWis?.forEach(wi => {
                         console.log(`    - WI ID: ${wi.id}`);
                         console.log(`      Status: ${wi.status}`);
                         console.log(`      Participant: "${wi.participant_id}"`);
                         console.log(`      Updated: ${wi.updated_at}`);
                     });
                } else {
                    console.log(`  > NO ACTIVITIES FOUND`);
                }
            }
        }
    }
    console.log(`\n==================================================`);
}

audit();
