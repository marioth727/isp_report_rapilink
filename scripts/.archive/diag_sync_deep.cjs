const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function diag() {
    const targets = ['62779', '63003'];
    const { data: profiles } = await s.from('profiles').select('*');

    const normalize = (u) => u ? u.toLowerCase().trim() : '';

    console.log('--- DEEP SYNC DIAGNOSIS ---');

    for (const t_id of targets) {
        console.log(`\nTicket ${t_id}:`);
        const { data: proc } = await s.from('workflow_processes').select('*').eq('reference_id', t_id).single();

        if (!proc) {
            console.log('  [ERROR] Process not found in DB');
            continue;
        }

        const techName = proc.metadata?.technician_name || 'Sin asignar';
        console.log(`  Technician in Metadata: "${techName}"`);

        // Simulating the matching logic
        let matched = null;
        profiles.forEach(p => {
            const pUser = normalize(p.wisphub_id);
            const pName = normalize(p.full_name);
            const target = normalize(techName);

            const matchWisp = pUser && target.includes(pUser);
            const matchName = pName && target.includes(pName);

            if (matchWisp || matchName) {
                console.log(`  [MATCH ATTEMPT] Profile: ${p.full_name} | WispID: ${p.wisphub_id}`);
                console.log(`    -> Match Wisp: ${matchWisp} | Match Name: ${matchName}`);
                matched = p;
            }
        });

        if (!matched) {
            console.log('  [RESULT] No profile matched. Would use raw name as participant_id.');
        } else {
            console.log(`  [RESULT] Matched with: ${matched.full_name} (${matched.wisphub_id})`);
        }

        const { data: wis } = await s.from('workflow_workitems')
            .select('*, workflow_activities!inner(name)')
            .eq('workflow_activities.process_id', proc.id)
            .eq('status', 'PE');

        console.log(`  Current Pending WorkItems: ${wis.length}`);
        wis.forEach(wi => {
            console.log(`    * WI: ${wi.id} | Participant: ${wi.participant_id} | Name: ${wi.workflow_activities.name}`);
        });
    }
}
diag();
