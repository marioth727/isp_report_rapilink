const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkWorkItems62779() {
    console.log('--- ESTADO DE WORKITEMS TICKET 62779 ---');

    // 1. Encontrar el proceso
    const { data: proc } = await supabase
        .from('workflow_processes')
        .select('id, title, metadata')
        .eq('reference_id', '62779')
        .single();

    if (!proc) {
        console.log('Proceso no encontrado');
        return;
    }

    console.log('Proceso ID:', proc.id);
    console.log('Metadata Técnico:', proc.metadata?.technician_name);

    // 2. Encontrar actividades
    const { data: acts } = await supabase
        .from('workflow_activities')
        .select('id, name, status')
        .eq('process_id', proc.id);

    console.log('Actividades encontradas:', acts.length);
    for (const act of acts) {
        console.log(`- Actividad: ${act.name} (ID: ${act.id}, Status: ${act.status})`);

        // 3. Encontrar workitems para cada actividad
        const { data: wis } = await supabase
            .from('workflow_workitems')
            .select('*')
            .eq('activity_id', act.id);

        for (const wi of wis) {
            console.log(`  * WI: ${wi.id} | Status: ${wi.status} | Participant: ${wi.participant_id}`);
        }
    }
}

checkWorkItems62779();
