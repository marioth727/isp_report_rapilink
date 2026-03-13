const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fix() {
    const marioWispId = 'sistemas@rapilink-sas';
    const targets = ['62779', '63003'];

    console.log('--- REPARACIÓN FORZADA DE BANDEJA ---');

    for (const t_id of targets) {
        const { data: proc } = await s.from('workflow_processes').select('id').eq('reference_id', t_id).single();

        if (proc) {
            console.log(`Fixing ticket ${t_id}...`);
            // Reactivar cualquier tarea cerrada o reasignar las pendientes
            const { data: wis } = await s.from('workflow_workitems')
                .select('id, activity_id')
                .eq('workflow_activities.process_id', proc.id);

            if (wis && wis.length > 0) {
                await s.from('workflow_workitems').update({
                    participant_id: marioWispId,
                    updated_at: new Date().toISOString(),
                    status: 'PE'
                }).in('id', wis.map(w => w.id));
                console.log(`  Updated ${wis.length} workitems to ${marioWispId}`);
            } else {
                console.log(`  No workitems for ${t_id}, creating one...`);
                const { data: act } = await s.from('workflow_activities').insert({
                    process_id: proc.id,
                    name: 'Soporte Técnico (REATIVADO)',
                    status: 'Active',
                    started_at: new Date().toISOString()
                }).select().single();

                if (act) {
                    await s.from('workflow_workitems').insert({
                        activity_id: act.id,
                        participant_id: marioWispId,
                        participant_type: 'U',
                        status: 'PE',
                        deadline: new Date(Date.now() + 86400000).toISOString()
                    });
                    console.log('  New workitem created.');
                }
            }
        } else {
            console.log(`  [ERROR] Ticket ${t_id} process not found.`);
        }
    }
    console.log('Fix complete.');
}
fix();
