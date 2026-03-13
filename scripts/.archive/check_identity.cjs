
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data } = await s.from('profiles').select('full_name, wisphub_id, email').eq('wisphub_id', 'cartera@rapilink-sas');
    console.log("Cartera Identity:", data);
}
check();
