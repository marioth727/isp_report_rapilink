const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

const WISPHUB_API_URL = 'https://api.wisphub.io/api';
const API_KEY = process.env.VITE_WISPHUB_API_KEY;

async function diagnoseTicket(ticketId) {
    console.log(`--- Diagnóstico Ticket #${ticketId} ---`);

    // 1. Obtener de WispHub
    try {
        const url = `${WISPHUB_API_URL}/tickets/${ticketId}/`;
        console.log(`Petición WispHub: ${url}`);

        // In node 18+ fetch is available, otherwise use axios or similar. 
        // Assuming node 18+ as seen in previous logs (v24.11.1)
        const res = await fetch(url, {
            headers: {
                'Authorization': `Api-Key ${API_KEY}`,
                'Api-Key': API_KEY
            }
        });

        if (res.ok) {
            const ticket = await res.json();
            console.log('--- Datos WispHub (Directo) ---');
            console.log('ID:', ticket.id);
            console.log('Asunto:', ticket.asunto);
            console.log('Técnico:', JSON.stringify(ticket.tecnico, null, 2));
            console.log('Técnico Nombre (extra):', ticket.nombre_tecnico);
        } else {
            console.log(`Error WispHub: ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.log('Respuesta:', text);
        }
    } catch (e) {
        console.error('Error fetching from WispHub:', e.message);
    }

    // 2. Obtener de Supabase
    try {
        const { data: process, error } = await supabase
            .from('workflow_processes')
            .select('*, workflow_activities(*, workflow_workitems(*))')
            .eq('reference_id', String(ticketId))
            .maybeSingle();

        if (error) throw error;
        if (process) {
            console.log('\n--- Datos Supabase (Local) ---');
            console.log('ID Proceso:', process.id);
            console.log('Metadata:', JSON.stringify(process.metadata, null, 2));
            console.log('Escalation Level:', process.escalation_level);

            const activeActivity = process.workflow_activities?.find(a => a.status === 'Active');
            if (activeActivity) {
                console.log('Actividad Activa:', activeActivity.name);
                console.log('Responsables:', JSON.stringify(activeActivity.workflow_workitems.map(wi => wi.participant_id), null, 2));
            }
        } else {
            console.log('Proceso no encontrado en Supabase');
        }
    } catch (e) {
        console.error('Error fetching from Supabase:', e.message);
    }
}

const ticketId = '63003';
diagnoseTicket(ticketId);
