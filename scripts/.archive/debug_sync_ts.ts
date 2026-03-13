import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import fetch from 'node-fetch';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Emulate global fetch for WisphubService if needed
if (!global.fetch) {
    (global as any).fetch = fetch;
}

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Mock the BASE_URL to point to the real API for the script
const WISPHUB_BASE_URL = 'https://api.wisphub.net/api';
const API_KEY = process.env.WISPHUB_API_KEY || process.env.VITE_WISPHUB_API_KEY;

async function run() {
    console.log('--- SYNC DEBUG VIA TS-NODE ---');
    const ticketId = '62779';

    // 1. Fetch from WispHub using the same logic as the app
    const url = `${WISPHUB_BASE_URL}/tickets/${ticketId}/`;
    const res = await fetch(url, {
        headers: { 'Authorization': `Api-Key ${API_KEY}` }
    });
    const ticket: any = await res.json();

    console.log('WispHub Response for 62779:');
    console.log(' Technician:', ticket.nombre_tecnico);
    console.log(' Tech User:', ticket.tecnico_usuario);
    console.log(' Tech ID:', ticket.tecnico_id);
    console.log(' Status ID:', ticket.id_estado);

    // 2. Fetch local process
    const { data: proc } = await supabase
        .from('workflow_processes')
        .select('*')
        .eq('reference_id', ticketId)
        .single();

    if (!proc) return console.log('Process not found in DB');
    console.log('Local Process Tech:', proc.metadata?.technician_name);

    // 3. Check for workitem
    const { data: currentWI } = await supabase
        .from('workflow_workitems')
        .select('*, workflow_activities!inner(process_id)')
        .eq('workflow_activities.process_id', proc.id)
        .eq('status', 'PE')
        .maybeSingle();

    if (!currentWI) return console.log('No pending workitem found for this process');
    console.log('Current WorkItem Participant:', currentWI.participant_id);

    // 4. Trace the matching logic
    const currentTechName = ticket.nombre_tecnico || "Sin asignar";
    const savedTechName = proc.metadata?.technician_name;
    const isNumericId = /^\d+$/.test(currentWI.participant_id);

    console.log(`Condition (currentTechName !== savedTechName): ${currentTechName !== savedTechName} ('${currentTechName}' !== '${savedTechName}')`);
    console.log(`Condition (isNumericId): ${isNumericId}`);

    if (currentTechName !== savedTechName || isNumericId) {
        console.log('===> SHOULD UPDATE');
    } else {
        console.log('===> SKIPPING UPDATE');
    }
}

run().catch(console.error);
