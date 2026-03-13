const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkSistemas() {
    console.log('--- Checking Profile for sistemas ---');
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or('email.ilike.%sistemas%,wisphub_id.ilike.%sistemas%,full_name.ilike.%sistemas%');

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

checkSistemas();
