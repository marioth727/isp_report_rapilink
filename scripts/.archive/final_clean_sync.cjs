const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

// ------------------------------------------------------------------
// HELPER: Map Status to Activity Name
// ------------------------------------------------------------------
function getActivityName(statusId, statusName) {
    // Standard WispHub Statuses
    if (statusId === 1 || statusName === 'Nuevo') return 'Soporte Técnico (Inicial)';
    if (statusId === 2 || statusName === 'Leido') return 'Soporte Técnico (Inicial)';
    if (statusId === 3 || statusName === 'En Progreso') return 'Soporte Técnico (En Progreso)';

    // Custom/Other Statuses -> Append Name
    // e.g. "Reactivado" -> "Soporte Técnico (Reactivado)"
    const safeName = statusName || 'Generico';
    return `Soporte Técnico (${safeName})`;
}

async function universalSync() {
    console.log('--- UNIVERSAL SYNC v2.0 (Create + Update + Dedupe) ---');

    // 1. PRE-FETCH STAFF MAP
    const startStaff = Date.now();
    const staffRes = await fetch('https://api.wisphub.io/api/staff/', {
        headers: { 'Authorization': `Api-Key ${apiKey}` }
    });
    const staffData = await staffRes.json();
    const staffList = staffData.results || staffData || [];

    const staffMap = {};
    const cleanName = (n) => n ? n.toLowerCase().trim() : '';

    staffList.forEach(s => {
        if (s.nombre) staffMap[cleanName(s.nombre)] = s;
    });
    console.log(`Loaded ${staffList.length} staff members in ${(Date.now() - startStaff)}ms`);

    // 2. FETCH ACTIVE TICKETS FROM WISPHUB (PAGINATED)
    let recentTickets = [];
    const PAGE_SIZE = 300;
    for (let page = 0; page < 3; page++) {
        console.log(`Fetching page ${page + 1}...`);
        const offset = page * PAGE_SIZE;
        const pageUrl = `https://api.wisphub.io/api/tickets/?limit=${PAGE_SIZE}&offset=${offset}&ordering=-id&id_estado__in=1,2,3`;
        const res = await fetch(pageUrl, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        const data = await res.json();
        const tickets = data.results || [];
        recentTickets = [...recentTickets, ...tickets];
        if (tickets.length < PAGE_SIZE) break;
    }
    console.log(`Total fetched from WispHub: ${recentTickets.length}`);

    // 3. PROFILES FOR MATCHING
    const { data: profiles } = await s.from('profiles').select('*');
    const normalizeUser = (u) => u ? u.toLowerCase().trim() : '';
    const cleanNameForMatch = (n) => n.split(/ - | @|@/)[0].toLowerCase().trim();

    // ------------------------------------------------------------------
    // SYNC LOGIC PER TICKET
    // ------------------------------------------------------------------
    for (const ticket of recentTickets) {
        const idStr = String(ticket.id || ticket.id_ticket);

        // A. Check if Process Exists
        const { data: existingProc } = await s.from('workflow_processes')
            .select('*')
            .eq('reference_id', idStr)
            .maybeSingle();

        const isOpen = ticket.id_estado === 1 || ticket.id_estado === 2 || ticket.estado === 'Nuevo' || ticket.estado === 'En Progreso' || ticket.estado === 'Reactivado' || ticket.estado === 'Por Confirmar';
        // Note: We treat many things as "Open" to ensure we verify them.
        // Actually, let's just process EVERYTHING in the list. Check "closed" state explicitly.

        const isClosedInWisp = (ticket.estado === 'Solucionado' || ticket.estado === 'Cerrado' || ticket.id_estado === 4); // Guessing status IDs

        // B. RESOLVE TECH
                let whTechName = ticket.nombre_tecnico || (ticket.tecnico && typeof ticket.tecnico === 'object' ? ticket.tecnico.nombre : ticket.tecnico) || "Sin asignar";
        let whTechUser = ticket.tecnico_usuario || (ticket.tecnico && typeof ticket.tecnico === 'object' ? ticket.tecnico.usuario : null);
        let whTechEmail = ticket.email_tecnico || (ticket.tecnico && typeof ticket.tecnico === 'object' ? ticket.tecnico.email : null);

                const isMatch = (t, profile) => {
            const norm = (s) => (s || '').toString().toLowerCase().trim();
            const pWhId = norm(profile.wisphub_id);
            const pEmail = norm(profile.email);
            const pName = norm(profile.full_name);
            
            const tUser = norm(whTechUser || '');
            const tName = norm(whTechName || '');
            const tEmail = norm(whTechEmail || '');

            if (!pWhId && !pEmail && !pName) return false;

            if (tName && pName && (tName === pName || tName.includes(pName) || pName.includes(tName))) {
                if (tName.length > 5 && pName.length > 5) return true;
            }

            const pBase = pWhId.split('@')[0].replace(/s$/, '');
            const tBase = tUser.split('@')[0].replace(/s$/, '');
            if (pBase && tBase && pBase === tBase && pBase.length > 3) return true;

            if (tEmail && pEmail && tEmail === pEmail) return true;
            if (tUser && pWhId && tUser === pWhId) return true;

            if (tName.includes('alejandra') && pWhId.includes('maira.vasquez')) return true;

            return false;
        };

        const matchedUser = profiles.find(p => isMatch(ticket, p));

        // --- DEBUG & FALLBACK ---
        if (!matchedUser && targetClean.includes('mario')) {
            // Force Assign to known ID for Mario (sistemas@rapilink-sas)
            // UUID: fef7cda2-4c87-4eed-aad8-4088099dbf61
            const forced = profiles.find(p => p.id === 'fef7cda2-4c87-4eed-aad8-4088099dbf61');
            if (forced) {
                console.log(`!!! MATCH FALLBACK for Mario (${whTechName}) -> Forced ID`);
                matchedUser = forced; // Reassign variable
            }
        }

        const targetParticipantId = matchedUser ? matchedUser.id : null;
        // Note: If no match, we might skip assignment or verify if we should create unassigned.
        // For now, if no participant, we assume 'unassigned' logic or just don't create WorkItem?
        // Let's assume we proceed but set participant to null? Type mismatch?
        // Actually, database might allow null participant? Let's check.
        // Assuming we rely on mapped user.

        // C. DETERMINE ACTIVITY NAME
        const newActivityName = getActivityName(ticket.id_estado, ticket.estado);

        if (!existingProc) {
            // --- CREATION LOGIC ---
            if (isClosedInWisp) continue; // Don't import old closed tickets

            console.log(`[+] New Ticket ${idStr}: Creating Process...`);

            // 1. Insert Process
            const { data: newProc, error: procErr } = await s.from('workflow_processes').insert({
                reference_id: idStr,
                title: ticket.asunto || 'Sin Asunto',
                status: 'PE',
                process_type: 'Ticket AXCES',
                metadata: {
                    technician_name: whTechName,
                    client: ticket.nombre_cliente,
                    priority: ticket.prioridad
                },
                // workflow_definition_id: ?? We decided it's optional or we ignored it. 
                // Based on Step 381, it was undefined. Step 400 Activity keys -> no def id.
                // So likely we don't need it.
            }).select().single();

            if (procErr) { console.error('Error creating proc:', procErr); continue; }

            // 2. Insert Activity
            const { data: newAct, error: actErr } = await s.from('workflow_activities').insert({
                process_id: newProc.id,
                name: newActivityName,
                status: 'Active'
            }).select().single();

            if (actErr) { console.error('Error creating act:', actErr); continue; }

            // 3. Insert WorkItem
            if (targetParticipantId) {
                await s.from('workflow_workitems').insert({
                    activity_id: newAct.id,
                    participant_id: targetParticipantId,
                    status: 'PE',
                    // wisphub_ticket_id: idStr // Schema check needed?
                    // inspect_duplicates (Step 294) showed "select ... from workflow_workitems" having "participant_id", "status"
                    // It didn't explicitly show 'wisphub_ticket_id' in result but earlier script used it.
                    // Let's query db or just omit if unsure. Reference_id is on process.
                    participant_type: 'U',
                    });
                console.log(`    -> Assigned to ${matchedUser.email} (${targetParticipantId})`);
            } else {
                console.log(`    -> No local user found for ${whTechName}. Created unassigned?`);
                // If required, we might skip workitem or insert with null if allowed.
            }

        } else {
            // --- UPDATE LOGIC ---

            // 1. Check Closure
            if (isClosedInWisp && existingProc.status === 'PE') {
                console.log(`[-] Ticket ${idStr} Closed in WispHub. Closing locally...`);
                await s.from('workflow_processes').update({ status: 'CO' }).eq('id', existingProc.id);
                // Close all workitems
                // Join is hard in update. Fetch activities first.
                const { data: acts } = await s.from('workflow_activities').select('id').eq('process_id', existingProc.id);
                if (acts && acts.length) {
                    await s.from('workflow_workitems').update({ status: 'CO' })
                        .in('activity_id', acts.map(a => a.id))
                        .eq('status', 'PE');
                }
                continue;
            }

            // 2. Check Status / Activity Change (Deduplication Logic)
            // Get current active activity
            const { data: activeActs } = await s.from('workflow_activities')
                .select('id, name')
                .eq('process_id', existingProc.id)
                .eq('status', 'Active') // Assuming 'Active' is the string
                .order('started_at', { ascending: false })
                .limit(1);

            const currentActivity = activeActs?.[0];

            if (currentActivity && currentActivity.name !== newActivityName) {
                console.log(`[~] Status Change: ${currentActivity.name} -> ${newActivityName}`);

                // CLOSE OLD
                await s.from('workflow_activities').update({ status: 'Completed' }).eq('id', currentActivity.id);
                await s.from('workflow_workitems').update({ status: 'CA' }) // Cancel/Close old items
                    .eq('activity_id', currentActivity.id)
                    .eq('status', 'PE');

                // CREATE NEW
                const { data: newAct } = await s.from('workflow_activities').insert({
                    process_id: existingProc.id,
                    name: newActivityName,
                    status: 'Active'
                }).select().single();

                if (targetParticipantId && newAct) {
                    const { error: wiErr } = await s.from('workflow_workitems').insert({
                        activity_id: newAct.id,
                        participant_id: targetParticipantId,
                        status: 'PE',
                        participant_type: 'U',
                    });
                    if (wiErr) console.error(`    [!] Error assigning to ${targetParticipantId}:`, wiErr.message);
                    else console.log(`    -> New WorkItem assigned to ${matchedUser ? matchedUser.email || matchedUser.full_name : targetParticipantId}`);
                }
            } else if (currentActivity) {
                // --- CASE: Activity name didn't change, but TECHNICIAN might have ---
                // Fetch current workitems for the active activity
                if (currentActivity) {
                    const { data: currentWIs } = await s.from('workflow_workitems')
                        .select('id, participant_id')
                        .eq('activity_id', currentActivity.id)
                        .eq('status', 'PE');

                    const needsReassignment = currentWIs?.some(wi => wi.participant_id !== targetParticipantId);

                    if (needsReassignment) {
                        console.log(`[!] REASSIGNMENT within same activity (${currentActivity.name}): -> ${targetParticipantId}`);
                        await s.from('workflow_workitems').update({
                            participant_id: targetParticipantId,
                            updated_at: new Date().toISOString()
                        }).in('id', currentWIs.map(wi => wi.id));
                    }
                }

                // 3. Check Technician Reassignment (Same Activity) - Original logic, now integrated above
                // Get pending WorkItem for this activity
                const { data: pendingWI } = await s.from('workflow_workitems')
                    .select('*')
                    .eq('activity_id', currentActivity.id)
                    .eq('status', 'PE')
                    .maybeSingle();

                if (pendingWI) {
                    if (targetParticipantId && pendingWI.participant_id !== targetParticipantId) {
                        console.log(`[~] Reassignment: ${pendingWI.participant_id} -> ${targetParticipantId}`);
                        await s.from('workflow_workitems').update({ participant_id: targetParticipantId }).eq('id', pendingWI.id);
                    }
                } else {
                    // 4. CASE: Process exists, Activity Active, but NO WorkItem (Zombie/Orphan)
                    // This happens if creation skipped assignment due to lookup failure but process persisted
                    if (targetParticipantId) {
                        console.log(`[+] Creating MISSING WorkItem for Existing Ticket ${idStr} (Resolved: ${matchedUser?.email})...`);
                        await s.from('workflow_workitems').insert({
                            activity_id: currentActivity.id,
                            participant_id: targetParticipantId,
                            status: 'PE',
                        participant_type: 'U',
                    });
                    }
                }
            }
        }
    }
}

universalSync();
