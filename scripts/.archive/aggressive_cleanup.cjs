const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function aggressiveCleanup() {
    console.log('--- AGGRESSIVE CLEANUP START ---');

    // 1. Fetch all pending workitems with their process IDs
    const { data: wis } = await supabase
        .from('workflow_workitems')
        .select(`
            id, 
            status, 
            participant_id, 
            activity_id,
            created_at,
            workflow_activities!inner(
                id, 
                name, 
                status,
                process_id,
                workflow_processes!inner(reference_id)
            )
        `)
        .eq('status', 'PE');

    // 2. Group by reference_id
    const groups = {};
    for (const wi of wis) {
        const ref = wi.workflow_activities.workflow_processes.reference_id;
        if (!groups[ref]) groups[ref] = [];
        groups[ref].push(wi);
    }

    for (const ref in groups) {
        const items = groups[ref];
        if (items.length > 1) {
            console.log(`Ticket ${ref} has ${items.length} pending items. Keeping newest.`);
            // Sort by created_at descending
            items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            const [keep, ...discard] = items;
            console.log(`  -> Keeping WI ${keep.id} (${keep.workflow_activities.name})`);

            for (const d of discard) {
                console.log(`  -> Cancelling WI ${d.id} (${d.workflow_activities.name}) for user ${d.participant_id}`);
                await supabase.from('workflow_workitems').update({ status: 'CA' }).eq('id', d.id);

                // If the activity has no more active items, we might want to complete it, but let's be safe.
                // Just cancelling the workitem is enough for the UI.
            }
        }
    }

    // 3. One last metadata fix for 63003 and 62779
    const fixes = [
        { ref: '63003', client: 'MARIO SABANAGRANDE', subject: 'CONECTOR DAÑADO' },
        { ref: '62779', client: 'MARIO SABANAGRANDE', subject: 'NO RESPONDE EL ROUTER WIFI' }
    ];

    for (const f of fixes) {
        const { data: p } = await supabase.from('workflow_processes').select('id, metadata').eq('reference_id', f.ref).single();
        if (p) {
            const m = {
                ...p.metadata,
                client_name: f.client,
                subject: f.subject,
                description: `${f.subject} - ${f.client}`,
                client: f.client // Adding both just in case UI uses 'client'
            };
            await supabase.from('workflow_processes').update({ metadata: m }).eq('id', p.id);
        }
    }

    console.log('--- AGGRESSIVE CLEANUP DONE ---');
}

aggressiveCleanup();
