const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function forceFix() {
    console.log('--- FORZANDO REPARACIÓN DE BANDEJA DE MARIO ---');

    // Ticket 62779: Debería estar con Alejandra Castro
    const { data: proc779 } = await s.from('workflow_processes').select('id').eq('reference_id', '62779').single();
    if (proc779) {
        console.log('Reparando 62779 -> Moviendo WorkItems a Alejandra Castro');
        await s.from('workflow_workitems')
            .update({ participant_id: 'Alejandra Castro', updated_at: new Date().toISOString() })
            .eq('status', 'PE')
            .eq('workflow_activities.process_id', proc779.id);

        // El query anterior fallará por el join en un update. Usamos subquery.
        const { data: wis } = await s.from('workflow_workitems')
            .select('id, workflow_activities!inner(process_id)')
            .eq('workflow_activities.process_id', proc779.id)
            .eq('status', 'PE');

        if (wis && wis.length > 0) {
            await s.from('workflow_workitems').update({ participant_id: 'Alejandra Castro' }).in('id', wis.map(w => w.id));
            console.log(`  Actualizados ${wis.length} WorkItems para 62779.`);
        }
    }

    // Ticket 63003: Asegurar que esté asignado a él pero con metadatos correctos
    const { data: proc003 } = await s.from('workflow_processes').select('id').eq('reference_id', '63003').single();
    if (proc003) {
        console.log('Reparando 63003 -> Asegurando asignación a Mario');
        await s.from('workflow_processes').update({
            metadata: { technician_name: 'Mario Vasquez', last_sync_at: new Date().toISOString() }
        }).eq('id', proc003.id);
    }

    console.log('--- REPARACIÓN COMPLETADA ---');
}

forceFix();
