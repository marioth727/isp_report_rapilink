const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function cleanup() {
    const targets = ['62779', '63003'];
    console.log('--- LIMPIEZA DE PROCESOS DUPLICADOS ---');

    for (const t_id of targets) {
        const { data: procs } = await s.from('workflow_processes').select('id, created_at').eq('reference_id', t_id).order('created_at', { ascending: false });

        if (procs && procs.length > 1) {
            console.log(`Found ${procs.length} processes for ticket ${t_id}.`);
            // Keep the newest one
            const keepId = procs[0].id;
            const deleteIds = procs.slice(1).map(p => p.id);

            console.log(`  Keeping process ${keepId} (newest).`);
            for (const did of deleteIds) {
                console.log(`  Deleting duplicate process ${did}...`);
                const { data: acts } = await s.from('workflow_activities').select('id').eq('process_id', did);
                if (acts && acts.length > 0) {
                    const actIds = acts.map(a => a.id);
                    await s.from('workflow_workitems').delete().in('activity_id', actIds);
                    await s.from('workflow_activities').delete().in('id', actIds);
                }
                await s.from('workflow_processes').delete().eq('id', did);
            }
        } else {
            console.log(`No duplicates for ticket ${t_id}.`);
        }
    }
    console.log('Cleanup complete.');
}
cleanup();
