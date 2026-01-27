const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function findMario() {
    console.log('--- Searching for Mario ---');
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or('full_name.ilike.%Mario%,wisphub_id.ilike.%Mario%');

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

findMario();
