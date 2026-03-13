const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkUser(uuid) {
    console.log(`--- Checking User ${uuid} ---`);
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uuid)
        .single();

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

checkUser('7146be65-447d-44b7-b6de-a21e5f161b93');
