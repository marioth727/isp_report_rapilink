const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

// ROBUST MATCHING LOGIC (Copied from Service)
const isMatch = (t, profile) => {
    const norm = (s) => (s || '').toString().toLowerCase().trim();
    const pWhId = norm(profile.wisphub_id);
    const pEmail = norm(profile.email);
    const pName = norm(profile.full_name);

    const tUser = norm(t.tecnico_usuario || '');
    const tName = norm(t.nombre_tecnico || '');
    const tEmail = norm(t.email_tecnico || '');

    if (!pWhId && !pEmail && !pName) return false;

    // 1. PRIMARY MATCH: WispHub ID / Username (Priority 1)
    if (tUser && pWhId && tUser === pWhId) return true;
    if (tUser && pEmail && tUser === pEmail) return true;

    // 2. Email Root Match (Handles systems@ vs system@)
    const pBase = pWhId.split('@')[0].replace(/s$/, '');
    const tBase = tUser.split('@')[0].replace(/s$/, '');
    if (pBase && tBase && pBase === tBase && pBase.length > 3) return true;

    // 3. Email Match
    if (tEmail && pEmail && tEmail === pEmail) return true;

    // 4. Full Name Match (Secondary Fallback)
    if (tName && pName && (tName === pName || tName.includes(pName) || pName.includes(tName))) {
        if (tName.length > 5 && pName.length > 5) return true;
    }

    // Special Alejandra/Maira
    if (tName.includes('alejandra') && pWhId.includes('maira.vasquez')) return true;

    return false;
};

async function forceSync() {
    const ticketId = '63003';
    console.log(`\n--- 🔥 FIRE TEST: FORCE SYNC TICKET ${ticketId} ---`);

    // 1. Fetch from WispHub
    try {
        const r = await fetch(`https://api.wisphub.io/api/tickets/${ticketId}/`, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        const rawT = await r.json();

        // ULTRA SAFE EXTRACTION
        let tName = rawT.nombre_tecnico || "Sin asignar";
        let tUser = rawT.tecnico_usuario || null;
        let tEmail = rawT.email_tecnico || null;

        if (rawT.tecnico) {
            if (typeof rawT.tecnico === 'object') {
                tName = rawT.tecnico.nombre || tName;
                tUser = rawT.tecnico.usuario || tUser;
                tEmail = rawT.tecnico.email || tEmail;
            } else if (typeof rawT.tecnico === 'string') {
                tName = rawT.tecnico;
            }
        }

        // Ensure strings
        tName = String(tName || "Sin asignar");
        tUser = tUser ? String(tUser) : null;
        tEmail = tEmail ? String(tEmail) : null;

        // Fallback email split
        if (!tUser && tEmail && tEmail.includes('@')) {
            tUser = tEmail.split('@')[0];
        }

        const t = {
            nombre_tecnico: tName,
            tecnico_usuario: tUser,
            email_tecnico: tEmail
        };

        console.log(`[WispHub] Técnico Actual: "${t.nombre_tecnico}" (User: ${t.tecnico_usuario})`);

        // 2. Resolve Local User
        const { data: profiles } = await supabase.from('profiles').select('*');
        const matchedUser = profiles.find(p => isMatch(t, p));

        if (!matchedUser) {
            console.error("❌ CRITICAL: No matching user found for ticket technician.");
            return;
        }
        console.log(`[Resolved] Matched Local User: "${matchedUser.full_name}" (ID: ${matchedUser.id})`);

        // 3. Get Current DB State
        const { data: proc } = await supabase.from('workflow_processes').select('*').eq('reference_id', ticketId).single();

        if (!proc) { console.log("Process not found locally."); return; }

        const { data: acts } = await supabase.from('workflow_activities').select('id').eq('process_id', proc.id).eq('status', 'Active');
        if (!acts || acts.length === 0) { console.log("No active activities."); return; }

        const actIds = acts.map(a => a.id);
        const { data: wis } = await supabase.from('workflow_workitems').select('*').in('activity_id', actIds).eq('status', 'PE');

        console.log(`[DB BEFORE] Metadata Technician: "${proc.metadata?.technician_name}"`);
        console.log(`[DB BEFORE] WorkItems Assigned To: ${wis.map(w => w.participant_id).join(', ')}`);

        // 4. PERFORM UNCONDITIONAL UPDATE (The "Fix")
        console.log("\n⚡ EXECUTING UNCONDITIONAL UPDATE...");

        // Update Process Metadata
        await supabase.from('workflow_processes').update({
            metadata: {
                ...proc.metadata,
                technician_name: t.nombre_tecnico,
                last_sync_at: new Date().toISOString()
            }
        }).eq('id', proc.id);

        // Update WorkItems (Using Bulk Filter Update - Mimicking successful manual fix)
        if (wis.length > 0) {
            const { error } = await supabase.from('workflow_workitems')
                .update({
                    participant_id: matchedUser.id,
                    participant_type: 'U',
                    updated_at: new Date().toISOString()
                })
                .in('activity_id', actIds)
                .eq('status', 'PE');

            if (error) console.error("Bulk Update Error:", error);
            else console.log("✅ WorkItems Bulk Updated Successfully.");
        }

        // 5. Verify
        const { data: wisAfter } = await supabase.from('workflow_workitems').select('*').in('activity_id', actIds).eq('status', 'PE');
        console.log(`[DB AFTER] WorkItems Assigned To: ${wisAfter.map(w => w.participant_id).join(', ')}`);

        if (wisAfter.every(w => w.participant_id === matchedUser.id)) {
            console.log("\n🎉 SUCCESS: Database reflects WispHub state.");
        } else {
            console.error("\n💀 FAILURE: Database mismatch persisting.");
        }

    } catch (e) {
        console.error("Script Error:", e);
    }
}

forceSync();
