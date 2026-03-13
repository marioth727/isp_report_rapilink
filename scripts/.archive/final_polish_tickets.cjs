const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function finalPolish() {
    console.log('--- FINAL POLISH START ---');

    const tickets = ['63003', '62779'];

    for (const ref of tickets) {
        console.log(`Processing Ticket ${ref}...`);

        const { data: proc } = await supabase
            .from('workflow_processes')
            .select('id, metadata')
            .eq('reference_id', ref)
            .single();

        if (!proc) {
            console.log(`! Ticket ${ref} not found.`);
            continue;
        }

        // 1. Correct Metadata if needed
        const client = "MARIO SABANAGRANDE";
        const subject = ref === '63003' ? "CONECTOR DAÑADO" : "NO RESPONDE EL ROUTER WIFI";

        const newMetadata = {
            ...proc.metadata,
            client_name: client,
            subject: subject,
            description: `${subject} - ${client}`
        };

        await supabase.from('workflow_processes').update({ metadata: newMetadata }).eq('id', proc.id);
        console.log(`  -> Metadata updated.`);

        // 2. Cancel ALL but the newest activity
        const { data: acts } = await supabase
            .from('workflow_activities')
            .select('id, name, status, created_at')
            .eq('process_id', proc.id)
            .eq('status', 'Active')
            .order('created_at', { ascending: false });

        if (acts && acts.length > 1) {
            const [keep, ...discard] = acts;
            console.log(`  -> Found ${acts.length} active activities. Keeping ${keep.name} (${keep.id})`);
            for (const d of discard) {
                await supabase.from('workflow_activities').update({ status: 'Completed' }).eq('id', d.id);
                await supabase.from('workflow_workitems').update({ status: 'CA' }).eq('activity_id', d.id).eq('status', 'PE');
            }
        } else if (acts && acts.length === 1) {
            console.log(`  -> Single active activity: ${acts[0].name}`);
        }

        // 3. Deduplicate WorkItems for active activity
        const activeIds = (acts || []).filter(a => a.status === 'Active' || a.id === (acts?.[0]?.id)).map(a => a.id);
        if (activeIds.length > 0) {
            const { data: wis } = await supabase
                .from('workflow_workitems')
                .select('id, participant_id, activity_id')
                .in('activity_id', activeIds)
                .eq('status', 'PE');

            const seen = new Set();
            for (const wi of (wis || [])) {
                const key = `${wi.activity_id}-${wi.participant_id}`;
                if (seen.has(key)) {
                    console.log(`  -> Cancelling dupe workitem ${wi.id} for user ${wi.participant_id}`);
                    await supabase.from('workflow_workitems').update({ status: 'CA' }).eq('id', wi.id);
                } else {
                    seen.add(key);
                }
            }
        }
    }

    console.log('--- FINAL POLISH DONE ---');
}

finalPolish();
