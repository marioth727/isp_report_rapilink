const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function finalCleanup() {
    console.log('--- FINAL CLEANUP FOR TICKET 63003 ---');

    // 1. Get process
    const { data: proc } = await supabase
        .from('workflow_processes')
        .select('*')
        .eq('reference_id', '63003')
        .single();

    if (!proc) return console.error('63003 not found');

    // 2. Fix Metadata
    const updatedMetadata = {
        ...proc.metadata,
        client_name: "MARIO SABANAGRANDE",
        subject: "CONECTOR DAÑADO",
        description: "CONECTOR DAÑADO - MARIO SABANAGRANDE"
    };

    const { error: metaErr } = await supabase
        .from('workflow_processes')
        .update({ metadata: updatedMetadata })
        .eq('id', proc.id);

    if (metaErr) console.error('Error metadata:', metaErr);
    else console.log('Metadata updated for 63003.');

    // 3. Cancel stale "Inicial" activity if "REACTIVADO" exists
    const { data: acts } = await supabase
        .from('workflow_activities')
        .select('id, name, status')
        .eq('process_id', proc.id);

    const reactAct = acts.find(a => a.name.includes('REATIVADO') || a.name.includes('REACTIVADO'));
    const initialAct = acts.find(a => a.name.includes('Inicial'));

    if (reactAct && initialAct && initialAct.status === 'Active') {
        process.stdout.write('Cancelling stale Initial activity...\n');
        await supabase.from('workflow_activities').update({ status: 'Completed' }).eq('id', initialAct.id);
        await supabase.from('workflow_workitems').update({ status: 'CA' }).eq('activity_id', initialAct.id).eq('status', 'PE');
        console.log('Initial activity cancelled.');
    }

    // 4. Double check Mario's assignments for 63003
    const marioId = 'fef7cda2-4c87-4eed-aad8-4088099dbf61';
    const { count: marioCleaned } = await supabase
        .from('workflow_workitems')
        .update({ status: 'CA' })
        .eq('participant_id', marioId)
        .eq('status', 'PE')
        .in('activity_id', acts.map(a => a.id));

    console.log(`Cleaned ${marioCleaned || 0} stale items for Mario on this ticket.`);

    console.log('--- Done. ---');
}

finalCleanup();
