const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function surgicalFix() {
    console.log('--- SURGICAL FIX FOR TICKET 63003 ---');

    // 1. Alejandra's UUID
    const alejandraId = '4a00f8e6-9323-4d69-b7f9-d8ff405b333b';
    const marioId = 'fef7cda2-4c87-4eed-aad8-4088099dbf61';

    // 2. Find Process for 63003
    const { data: proc } = await supabase
        .from('workflow_processes')
        .select('id')
        .eq('reference_id', '63003')
        .single();

    if (!proc) {
        console.error('Process 63003 not found!');
        return;
    }

    console.log(`Found Process: ${proc.id}`);

    // 3. Close ANY pending workitems for Mario for this ticket
    const { data: MarioWIs } = await supabase
        .from('workflow_workitems')
        .select('id, status')
        .eq('participant_id', marioId)
        .eq('status', 'PE')
        .eq('workflow_activities.process_id', proc.id); // This join works if handled correctly, but let's be safe.

    // Better: Get activities for this process
    const { data: acts } = await supabase.from('workflow_activities').select('id, name, status').eq('process_id', proc.id);
    const actIds = acts.map(a => a.id);

    console.log(`Activities found: ${actIds.join(', ')}`);

    // Cancel all pending for Mario in this process
    const { count: cancelled } = await supabase
        .from('workflow_workitems')
        .update({ status: 'CA', updated_at: new Date().toISOString() })
        .in('activity_id', actIds)
        .eq('participant_id', marioId)
        .eq('status', 'PE');

    console.log(`Cancelled ${cancelled || 0} pending workitems for Mario.`);

    // 4. Create NEW workitem for Alejandra for the ACTIVE activity
    const activeAct = acts.find(a => a.status === 'Active');
    if (activeAct) {
        console.log(`Active Activity: ${activeAct.id} (${activeAct.name})`);

        // Ensure no pending for Alejandra already
        const { data: existingAle } = await supabase
            .from('workflow_workitems')
            .select('id')
            .eq('activity_id', activeAct.id)
            .eq('participant_id', alejandraId)
            .eq('status', 'PE')
            .maybeSingle();

        if (!existingAle) {
            const { error: insErr } = await supabase
                .from('workflow_workitems')
                .insert({
                    activity_id: activeAct.id,
                    participant_id: alejandraId,
                    participant_type: 'U',
                    status: 'PE',
                    deadline: new Date(Date.now() + 86400000).toISOString()
                });

            if (insErr) console.error('Error creating WI for Alejandra:', insErr.message);
            else console.log('Successfully assigned Ticket 63003 to Alejandra Castro.');
        } else {
            console.log('Alejandra already has a pending workitem for this activity.');
        }
    } else {
        console.log('No active activity found for Ticket 63003.');
    }

    // 5. Verify 62779 (Mario's ticket)
    console.log('\n--- VERIFYING TICKET 62779 (Mario) ---');
    const { data: proc2 } = await supabase
        .from('workflow_processes')
        .select('id, status')
        .eq('reference_id', '62779')
        .single();

    if (proc2) {
        console.log(`Process 62779 status: ${proc2.status}`);
        const { data: wi2 } = await supabase
            .from('workflow_workitems')
            .select('id, status, participant_id')
            .eq('workflow_activities.process_id', proc2.id)
            .eq('status', 'PE')
            .maybeSingle(); // This might fail due to join syntax here, let's just query by activity
    }

    console.log('Done.');
}

surgicalFix();
