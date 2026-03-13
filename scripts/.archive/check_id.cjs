const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function checkSpecificId() {
    console.log('--- Checking Profile for ID 1153b433-ad23-4000-a577-bf6ab36cc600 ---');
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', '1153b433-ad23-4000-a577-bf6ab36cc600')
        .maybeSingle();

    console.log('Profile:', JSON.stringify(profile, null, 2));

    console.log('--- Checking Auth Users (if possible via metadata in profiles) ---');
    // We can't query auth.users directly with anon key usually, but let's see if metadata helps
}

checkSpecificId();
