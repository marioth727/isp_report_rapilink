const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Dynamic import for node-fetch
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function run() {
    console.log('--- SYNC DEBUG V3 ---');
    const ticketId = '62779';
    const API_KEY = process.env.WISPHUB_API_KEY || process.env.VITE_WISPHUB_API_KEY;

    try {
        // 1. Fetch from WispHub
        console.log('Fetching from WispHub...');
        const url = `https://api.wisphub.net/api/tickets/${ticketId}/`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Api-Key ${API_KEY}` }
        });
        const ticket = await res.json();

        console.log('WispHub Response:');
        console.log('  Technician Name:', ticket.nombre_tecnico);
        console.log('  Technician User:', ticket.tecnico_usuario);
        console.log('  Technician ID:', ticket.tecnico_id);
        console.log('  Status:', ticket.id_estado);

        // 2. Fetch from Supabase
        console.log('Fetching from Supabase...');
        const { data: proc } = await supabase.from('workflow_processes').select('*').eq('reference_id', ticketId).single();
        if (!proc) return console.log('Process not found');
        console.log('  Local Metadata Tech:', proc.metadata?.technician_name);

        const { data: currentWI } = await supabase
            .from('workflow_workitems')
            .select('*, workflow_activities!inner(process_id)')
            .eq('workflow_activities.process_id', proc.id)
            .eq('status', 'PE')
            .maybeSingle();

        if (!currentWI) return console.log('  No pending WorkItem found');
        console.log('  Current Participant:', currentWI.participant_id);

        // 3. Profiles Check
        const { data: profiles } = await supabase.from('profiles').select('wisphub_id, full_name, wisphub_user_id');
        const normalizeUser = (u) => u ? u.toLowerCase().trim() : '';

        const matchedUser = profiles.find(p => {
            if (!p.wisphub_id) return false;
            const pUser = normalizeUser(p.wisphub_id);
            if (ticket.tecnico_usuario && pUser === normalizeUser(ticket.tecnico_usuario)) return true;
            if (ticket.tecnico_id && String(p.wisphub_user_id) === String(ticket.tecnico_id)) return true;
            if (ticket.nombre_tecnico && pUser === normalizeUser(ticket.nombre_tecnico)) return true;
            return false;
        });

        const newParticipantId = matchedUser ? matchedUser.wisphub_id : (ticket.tecnico_usuario || ticket.tecnico_id || ticket.nombre_tecnico || "Sin asignar");
        console.log('Calculated New Participant:', newParticipantId);

        if (newParticipantId !== currentWI.participant_id) {
            console.log('===> MISMATCH DETECTED. FORCING REASSIGNMENT...');
            const { error: updErr } = await supabase.from('workflow_workitems').update({ participant_id: newParticipantId }).eq('id', currentWI.id);
            if (updErr) console.log('Error updating:', updErr);
            else console.log('Successfully updated WorkItem to:', newParticipantId);

            await supabase.from('workflow_processes').update({
                metadata: { ...proc.metadata, technician_name: ticket.nombre_tecnico || "Sin asignar" }
            }).eq('id', proc.id);
            console.log('Successfully updated Process Metadata.');
        } else {
            console.log('===> IDs ALREADY MATCH. No update needed.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
