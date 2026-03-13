const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function fix62779() {
    const ticketId = '62779';
    const apiKey = process.env.WISPHUB_API_KEY || process.env.VITE_WISPHUB_API_KEY;

    console.log('--- FORZAR LIMPIEZA TICKET 62779 ---');

    try {
        // 1. Ver quién es el técnico en WispHub
        const res = await fetch(`https://api.wisphub.net/api/tickets/${ticketId}/`, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        const ticket = await res.json();
        console.log('WispHub Técnico:', ticket.nombre_tecnico, 'Usuario:', ticket.tecnico_usuario);

        // 2. Encontrar el proceso local
        const { data: proc } = await supabase.from('workflow_processes').select('id, metadata').eq('reference_id', ticketId).single();
        if (!proc) return console.log('Ticket no encontrado en base de datos local');

        // 3. Ver WorkItems pendientes de Mario
        const { data: wis } = await supabase.from('workflow_workitems')
            .select('id, participant_id, workflow_activities!inner(process_id)')
            .eq('workflow_activities.process_id', proc.id)
            .eq('status', 'PE');

        if (!wis || wis.length === 0) {
            console.log('No hay WorkItems pendientes para este ticket.');
            return;
        }

        console.log('WorkItems pendientes encontrados:', wis.length);

        // 4. Mapear al nuevo técnico
        const { data: profiles } = await supabase.from('profiles').select('*');
        const normalize = (u) => u ? u.toLowerCase().trim() : '';
        const targetTech = ticket.tecnico_usuario || ticket.nombre_tecnico;

        const matched = profiles.find(p =>
            (p.wisphub_id && normalize(p.wisphub_id) === normalize(ticket.tecnico_usuario)) ||
            (p.full_name && normalize(p.full_name) === normalize(ticket.nombre_tecnico))
        );

        const newId = matched ? matched.wisphub_id : targetTech;
        console.log('Nuevo responsable debería ser:', newId);

        // 5. ACTUALIZAR TODO
        for (const wi of wis) {
            console.log(`Actualizando WorkItem ${wi.id} (${wi.participant_id} -> ${newId})`);
            await supabase.from('workflow_workitems').update({ participant_id: newId }).eq('id', wi.id);
        }

        await supabase.from('workflow_processes').update({
            metadata: { ...proc.metadata, technician_name: ticket.nombre_tecnico }
        }).eq('id', proc.id);

        console.log('¡Ticket 62779 actualizado con éxito!');
    } catch (e) {
        console.error('Error:', e);
    }
}
fix62779();
