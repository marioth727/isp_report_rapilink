import { WisphubService } from '../src/lib/wisphub';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

// MOCK FETCH PARA SOPORTAR NODE
const originalFetch = global.fetch;
global.fetch = async (url, options = {}) => {
    let finalUrl = url;
    if (url.startsWith('/api/wisphub')) {
        finalUrl = `https://api.wisphub.io${url.replace('/api/wisphub', '/api')}`;
    }

    const apiKey = process.env.VITE_WISPHUB_API_KEY || '';
    const finalOptions = {
        ...options,
        headers: {
            ...(options.headers || {}),
            'Authorization': `Api-Key ${apiKey}`,
            'Api-Key': apiKey,
        }
    };

    return originalFetch(finalUrl, finalOptions);
};

async function diagnoseTicket(ticketId) {
    console.log(`--- Diagnóstico Ticket #${ticketId} ---`);

    // 1. Obtener de WispHub
    try {
        const tickets = await WisphubService.getAllRecentTickets(100);
        const ticket = tickets.find(t => String(t.id) === String(ticketId));

        if (ticket) {
            console.log('--- Datos WispHub ---');
            console.log('ID:', ticket.id);
            console.log('Asunto:', ticket.asunto);
            console.log('Técnico Nombre (nombre_tecnico):', ticket.nombre_tecnico);
            console.log('Técnico ID (tecnico_id):', ticket.tecnico_id);
            console.log('Técnico Usuario (tecnico_usuario):', ticket.tecnico_usuario);
        } else {
            console.log('Ticket no encontrado en los últimos 100 de WispHub');
            // Intentar buscar por ID directo
            const detail = await WisphubService.getTicketDetail(ticketId);
            if (detail) {
                console.log('--- Datos WispHub (Directo) ---');
                console.log(JSON.stringify(detail, null, 2));
            }
        }
    } catch (e) {
        console.error('Error fetching from WispHub:', e);
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
            console.log('Título:', process.title);
            console.log('Metadata:', JSON.stringify(process.metadata, null, 2));
            console.log('Escalation Level:', process.escalation_level);

            const activeActivity = process.workflow_activities?.find(a => a.status === 'Active');
            if (activeActivity) {
                console.log('Actividad Activa:', activeActivity.name);
                const workItems = activeActivity.workflow_workitems;
                console.log('WorkItems:', JSON.stringify(workItems, null, 2));
            }
        } else {
            console.log('Proceso no encontrado en Supabase con reference_id:', ticketId);
        }
    } catch (e) {
        console.error('Error fetching from Supabase:', e);
    }
}

const ticketId = '63003';
diagnoseTicket(ticketId);
