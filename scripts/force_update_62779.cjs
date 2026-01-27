
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function force() {
    console.log("Forcing update for Ticket 62779 WI...");

    // WorkItem ID from duplicates.txt
    const wiId = '62a5cd87-c3d6-42ab-b6fa-6f891879c225';
    const marioId = 'fef7cda2-4c87-4eed-aad8-4088099dbf61';

    // 1. Check current
    const { data: before } = await s.from('workflow_workitems').select('participant_id').eq('id', wiId);
    console.log("Before:", before);

    // 2. Update
    const { data, error } = await s.from('workflow_workitems')
        .update({ participant_id: marioId })
        .eq('id', wiId)
        .select();

    if (error) console.error("Update Error:", error);
    else console.log("Update Success:", data);
}

force();
