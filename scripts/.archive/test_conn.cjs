const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function run() {
    const ticketId = '62779';
    // USAR SIEMPRE LA VITE_ QUE ES LA LARGA Y CORRECTA
    const apiKey = process.env.VITE_WISPHUB_API_KEY;

    console.log('--- TEST CONEXIÓN WISPHUB ---');
    console.log('Key Length:', apiKey ? apiKey.length : 0);

    try {
        const url = `https://api.wisphub.net/api/tickets/${ticketId}/`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });

        console.log('Status:', res.status);
        const data = await res.json();

        if (res.ok) {
            console.log('Técnico en WispHub:', data.nombre_tecnico);
            console.log('Usuario en WispHub:', data.tecnico_usuario);

            // Forzar actualización local
            const { data: proc } = await supabase.from('workflow_processes').select('id').eq('reference_id', ticketId).single();
            if (proc) {
                const { data: wi } = await supabase.from('workflow_workitems')
                    .select('id, participant_id, workflow_activities!inner(process_id)')
                    .eq('workflow_activities.process_id', proc.id)
                    .eq('status', 'PE')
                    .maybeSingle();

                if (wi) {
                    const matchedTech = data.tecnico_usuario || data.nombre_tecnico || "Sin asignar";
                    console.log(`Cambiando de ${wi.participant_id} -> ${matchedTech}`);
                    await supabase.from('workflow_workitems').update({ participant_id: matchedTech }).eq('id', wi.id);
                    console.log('¡Actualización forzada completada!');
                }
            }
        } else {
            console.log('Error de API:', data);
        }
    } catch (e) {
        console.error('Error fatal:', e);
    }
}
run();
