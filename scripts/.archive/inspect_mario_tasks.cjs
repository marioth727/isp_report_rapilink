const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
    console.log('--- INSPECCIÓN DE PERFILES Y TAREAS PENDIENTES ---');

    // 1. Buscar perfiles relacionados con Mario o Moreno
    const { data: profiles } = await s.from('profiles').select('*');
    console.log('\nResultados de Perfiles:');
    profiles.forEach(p => {
        const fn = (p.full_name || '').toLowerCase();
        const wid = (p.wisphub_id || '').toLowerCase();
        if (fn.includes('mario') || fn.includes('moreno') || wid.includes('mario') || wid.includes('sistemas')) {
            console.log(`- FullName: ${p.full_name} | ID: ${p.id} | WispID: ${p.wisphub_id} | Email: ${p.email}`);
        }
    });

    // 2. Buscar procesos para los tickets objetivo
    const targets = ['62779', '63003'];
    const { data: procs } = await s.from('workflow_processes').select('*').in('reference_id', targets);

    console.log('\n--- ESTADO DE LOS TICKETS 62779 y 63003 ---');
    for (const proc of procs) {
        console.log(`\nTicket ${proc.reference_id} (Process ${proc.id}):`);
        console.log(`  Metadata Tech: ${proc.metadata?.technician_name}`);

        const { data: wis } = await s.from('workflow_workitems')
            .select('*, workflow_activities!inner(name)')
            .eq('workflow_activities.process_id', proc.id)
            .eq('status', 'PE');

        console.log(`  Pending WorkItems (${wis.length}):`);
        wis.forEach(wi => {
            console.log(`    * WI ID: ${wi.id} | Participant: ${wi.participant_id} | Created: ${wi.created_at}`);
        });
    }
}
inspect();
