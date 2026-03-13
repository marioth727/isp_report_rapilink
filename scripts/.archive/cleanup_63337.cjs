
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function cleanup() {
    console.log("Cleanup Duplicates for 63337...");
    const { data: procs } = await s.from('workflow_processes')
        .select('*')
        .eq('reference_id', '63337')
        .order('created_at', { ascending: false });

    if (!procs || procs.length === 0) {
        console.log("No processes found.");
        return;
    }

    console.log(`Found ${procs.length} processes.`);

    // DELETE ALL (No Keeper) to force clean recreation
    const toDelete = procs.map(p => p.id);
    console.log(`Deleting ALL ${toDelete.length} processes for fresh start...`);

    if (toDelete.length > 0) {
        console.log("Deleting children first...");

        // 1. Logs
        const { error: logErr } = await s.from('workflow_logs').delete().in('process_id', toDelete);
        if (logErr) console.error("Error deleting Logs", logErr);

        // 2. Activities (and their WorkItems)
        const { data: acts } = await s.from('workflow_activities').select('id').in('process_id', toDelete);
        const actIds = acts ? acts.map(a => a.id) : [];
        console.log(`  Found ${actIds.length} activities to clean.`);

        if (actIds.length > 0) {
            const { error: wiErr } = await s.from('workflow_workitems').delete().in('activity_id', actIds);
            if (wiErr) console.error("Error deleting WorkItems", wiErr);

            const { error: actErr } = await s.from('workflow_activities').delete().in('id', actIds);
            if (actErr) console.error("Error deleting Activities", actErr);
        }

        // 3. Processes
        const { error } = await s.from('workflow_processes')
            .delete()
            .in('id', toDelete);

        if (error) console.error("Error deleting procs:", error);
        else console.log("Deleted successfully.");
    }
}
cleanup();
