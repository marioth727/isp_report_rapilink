const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// Simulación de la lógica de WorkflowService.syncWithWispHub
async function testAutomation() {
    const marioWispId = 'sistemas@rapilink-sas';
    const javierWispId = 'tecnico1@rapilink-sas';
    const ticketId = '63003';

    console.log(`--- PROBANDO AUTOMATIZACIÓN PARA TICKET ${ticketId} ---`);

    // 1. Identificar el proceso
    const { data: proc } = await s.from('workflow_processes').select('*').eq('reference_id', ticketId).single();
    if (!proc) {
        console.log('Error: Proceso no encontrado.');
        return;
    }

    // 2. Moverlo INTENCIONALMENTE a Javier (Simular error o cambio externo)
    console.log('Paso 1: Moviendo ticket a Javier Olivera (Simulación)...');
    await s.from('workflow_workitems').update({ participant_id: javierWispId }).eq('workflow_activities.process_id', proc.id).eq('status', 'PE');

    // 3. Ejecutar LÓGICA DE SINCRONIZACIÓN (Simulada)
    console.log('Paso 2: Ejecutando motor de sincronización automática...');

    // Obtenemos perfiles (equivalente a getPlatformUsers lite)
    const { data: profiles } = await s.from('profiles').select('wisphub_id, full_name');

    // Simular que WispHub dice que es de Mario (como está en el ticket)
    const currentTechInWispHub = "Mario Vasquez - sistemas@rapilink-sas";

    const cleanName = (n) => n.split(/ - | @|@/)[0].toLowerCase().trim();
    const targetClean = cleanName(currentTechInWispHub);
    const normalizeUser = (u) => u ? u.toLowerCase().trim() : '';

    const matchedUser = profiles.find(p => {
        if (!p.wisphub_id) return false;
        const pUser = normalizeUser(p.wisphub_id).split(/@/)[0];
        const pName = cleanName(p.full_name || '');
        return pUser === targetClean || pName === targetClean;
    });

    const targetParticipantId = matchedUser ? matchedUser.wisphub_id : currentTechInWispHub;
    console.log(`  > Motor detecta que el técnico real es: ${targetParticipantId}`);

    // Buscar tareas pendientes
    const { data: pendingWIs } = await s.from('workflow_workitems')
        .select('id, participant_id, workflow_activities!inner(process_id)')
        .eq('workflow_activities.process_id', proc.id)
        .eq('status', 'PE');

    const needsUpdate = pendingWIs?.some(wi => wi.participant_id !== targetParticipantId);

    if (needsUpdate) {
        console.log(`  > DISCREPANCIA DETECTADA. Corrigiendo asignación automáticamente...`);
        const wiIds = pendingWIs.map(wi => wi.id);
        await s.from('workflow_workitems').update({
            participant_id: targetParticipantId,
            updated_at: new Date().toISOString()
        }).in('id', wiIds);
        console.log(`  > RESULTADO: Ticket devuelto a ${targetParticipantId} con éxito.`);
    } else {
        console.log(`  > No se detectó discrepancia. Todo en orden.`);
    }
}

testAutomation();
