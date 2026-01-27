const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkAllPossibleMarios() {
    console.log('--- Searching Profiles ---');
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, wisphub_id, role')
        .or('full_name.ilike.%Mario%,email.ilike.%Mario%,wisphub_id.ilike.%sistemas%');

    console.log(JSON.stringify(data, null, 2));
}

checkAllPossibleMarios();
