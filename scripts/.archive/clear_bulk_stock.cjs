const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearBulkStock() {
    console.log('Clearing warehouse stock for Tensores and Conectores...');

    // 1. Find items matching 'tensor%' or 'conector%'
    const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id, name')
        .or('name.ilike.%tensor%,name.ilike.%conector%');

    if (itemsError) {
        console.error('Error fetching items:', itemsError);
        return;
    }

    if (!items || items.length === 0) {
        console.log('No matching items found.');
        return;
    }

    console.log(`Found ${items.length} items to clear:`);
    items.forEach(i => console.log(`- ${i.name}`));

    const itemIds = items.map(i => i.id);

    // 2. Delete assets in 'warehouse' for these items
    // We check for status 'warehouse' to avoid messing up assigned stock if any.
    const { data: deleted, error: deleteError } = await supabase
        .from('inventory_assets')
        .delete()
        .in('item_id', itemIds)
        .eq('status', 'warehouse')
        .select();

    if (deleteError) {
        console.error('Error deleting assets:', deleteError);
    } else {
        console.log(`Deleted ${deleted.length} warehouse assets.`);
    }
}

clearBulkStock();
