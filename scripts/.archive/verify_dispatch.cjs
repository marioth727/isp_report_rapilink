
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars from root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDispatch() {
    console.log('--- Checking dispatch_events ---');
    const { data: events, error: evError } = await supabase
        .from('dispatch_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (evError) console.error('Error fetching dispatch events:', evError);
    else if (!events || events.length === 0) console.log('No entries found in dispatch_events.');
    else {
        console.log('Last 5 entries in dispatch_events:');
        events.forEach((entry, idx) => {
            console.log(`[${idx + 1}] ID: ${entry.id} | User: ${entry.user_id} | Created: ${entry.created_at} | Techs: ${entry.technician_count}`);
        });
    }

    console.log('\n--- Checking workflow_workitems for recent updates ---');
    // Check for items updated in the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: tickets, error: tickError } = await supabase
        .from('workflow_workitems')
        .select('*')
        .gt('updated_at', yesterday.toISOString())
        .order('updated_at', { ascending: false })
        .limit(5);

    if (tickError) console.error('Error fetching workitems:', tickError);
    else if (!tickets || tickets.length === 0) console.log('No recently updated tickets found.');
    else {
        console.log('Last 5 updated tickets:');
        tickets.forEach((t, idx) => {
            // Safe key access
            const title = t.title || t.asunto || t.description || 'No Title';
            const tech = t.participant_id || t.technician_id || 'Unknown';
            console.log(`[${idx + 1}] ID: ${t.id} | Title: ${title} | Status: ${t.status} | Tech: ${tech} | Updated: ${t.updated_at}`);
        });
    }
}


checkDispatch();
