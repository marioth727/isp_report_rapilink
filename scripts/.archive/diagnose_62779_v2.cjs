const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function diagnose62779Sync() {
    console.log('--- DIAGNÓSTICO PROFUNDO TICKET 62779 ---');

    const ticketId = '62779';
    const apiKey = process.env.VITE_WISPHUB_API_KEY;

    // 1. Obtener estado actual en WispHub
    console.log('Consultando WispHub API (Direct ID)...');
    try {
        const response = await fetch(`https://api.wisphub.net/api/tickets/${ticketId}/`, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        const ticket = await response.json();

        if (!ticket || ticket.detail === 'No encontrado.') {
            console.log('ERROR: Ticket no encontrado en WispHub:', ticket);
            return;
        }

        console.log('WispHub Técnico Actual:', ticket.nombre_tecnico);
        console.log('WispHub Técnico Usuario:', ticket.tecnico_usuario);
        console.log('WispHub Técnico ID:', ticket.tecnico_id);

        // 2. Obtener estado actual en DB Local
        const { data: proc } = await supabase
            .from('workflow_processes')
            .select('id, metadata, escalation_level')
            .eq('reference_id', ticketId)
            .single();

        if (!proc) {
            console.log('ERROR: Proceso no encontrado en DB Local');
            return;
        }

        console.log('DB Local Técnico Guardado:', proc.metadata?.technician_name);

        const { data: currentWI } = await supabase
            .from('workflow_workitems')
            .select('participant_id, id, status, workflow_activities!inner(process_id)')
            .eq('workflow_activities.process_id', proc.id)
            .eq('status', 'PE')
            .maybeSingle();

        console.log('DB Local Responsable Actual (WorkItem):', currentWI?.participant_id);

        // 3. Simular lógica de matching
        const { data: profiles } = await supabase.from('profiles').select('*');
        const normalizeUser = (u) => u ? u.toLowerCase().trim() : '';

        const matchedUser = profiles.find(p => {
            if (!p.wisphub_id) return false;
            const pUser = normalizeUser(p.wisphub_id);
            if (ticket.tecnico_usuario && pUser === normalizeUser(ticket.tecnico_usuario)) return true;
            if (ticket.tecnico_id && String(p.wisphub_user_id) === String(ticket.tecnico_id)) return true;
            if (ticket.nombre_tecnico && pUser === normalizeUser(ticket.nombre_tecnico)) return true;
            return false;
        });

        const newParticipantId = matchedUser ? matchedUser.wisphub_id : (ticket.tecnico_usuario || ticket.tecnico_id || ticket.nombre_tecnico);
        console.log('MATCHED Participant ID (Nuevo calculado):', newParticipantId);

        if (currentWI && newParticipantId !== currentWI.participant_id) {
            console.log(`=> SE REQUIERE ACTUALIZACIÓN: ${currentWI.participant_id} -> ${newParticipantId}`);
        } else {
            console.log('=> NO SE REQUIERE ACTUALIZACIÓN o no hay WorkItem pendiente.');
        }

    } catch (e) {
        console.error('Error en diagnóstico:', e);
    }
}

diagnose62779Sync();
