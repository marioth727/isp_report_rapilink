
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const uuid = '4a00f8e6-9323-4d69-b7f9-d8ff405b333b';
    const { data } = await s.from('profiles').select('full_name, wisphub_id').eq('id', uuid);
    console.log("ID belongs to:", data);

    const procId = '9314fd7e-4ccf-4cfd-ae3a-8669787e86e4';
    const { data: p } = await s.from('workflow_processes').select('status').eq('id', procId);
    console.log("Process Status:", p);
}
check();
