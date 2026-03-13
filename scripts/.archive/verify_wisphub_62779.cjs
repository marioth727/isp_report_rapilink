const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function run() {
    const ticketId = '62779';
    const apiKey = process.env.VITE_WISPHUB_API_KEY;

    console.log('--- WISPHUB API DATA TICKET 62779 ---');
    try {
        const response = await fetch(`https://api.wisphub.net/api/tickets/${ticketId}/`, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });

        if (!response.ok) {
            console.log('API Error:', response.status, await response.text());
            return;
        }

        const ticket = await response.json();

        console.log('Ticket Data:', JSON.stringify({
            id: ticket.id,
            nombre_tecnico: ticket.nombre_tecnico,
            tecnico_usuario: ticket.tecnico_usuario,
            tecnico_id: ticket.tecnico_id,
            id_estado: ticket.id_estado
        }, null, 2));

        // Ver perfiles relevantes
        const { data: profiles, error } = await s.from('profiles').select('wisphub_id, full_name, wisphub_user_id');
        if (error) {
            console.log('Error fetching profiles:', error);
            return;
        }

        console.log('\nRelevant Profiles:');
        (profiles || []).forEach(p => {
            if (p.full_name?.toLowerCase().includes('mario') ||
                p.full_name?.toLowerCase().includes('tomas') ||
                p.full_name?.toLowerCase().includes('moreno') ||
                p.wisphub_id === ticket.tecnico_usuario) {
                console.log(`- ${p.full_name} | WispHubID: ${p.wisphub_id} | WispHubUserID: ${p.wisphub_user_id}`);
            }
        });

    } catch (e) {
        console.error('Fatal:', e);
    }
}
run();
