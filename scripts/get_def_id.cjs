
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data } = await s.from('workflow_processes')
        .select('process_type')
        .limit(1);
    console.log("Process Type:", data?.[0]);
}
check();
