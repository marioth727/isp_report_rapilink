
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanup() {
    console.log('Connecting to:', supabaseUrl);

    // 1. Identify Items (ONU/ONT)
    const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id, name')
        .or('name.ilike.%onu%,name.ilike.%ont%');

    if (itemsError || !items || items.length === 0) {
        console.log('No ONU/ONT items found or error:', itemsError);
        return;
    }

    console.log(`Found ${items.length} items to clean up:`, items.map(i => i.name));
    const itemIds = items.map(i => i.id);

    // 2. Break Circular Dependency
    await supabase.from('inventory_assets').update({ last_movement_id: null }).in('item_id', itemIds);

    // 3. Find Assets
    const { data: assets } = await supabase.from('inventory_assets').select('id').in('item_id', itemIds);
    const assetIds = assets?.map(a => a.id) || [];

    if (assetIds.length > 0) {
        console.log(`Deleting ${assetIds.length} assets and their movements...`);
        await supabase.from('inventory_movements').delete().in('asset_id', assetIds);
        await supabase.from('inventory_assets').delete().in('id', assetIds);
    } else {
        console.log('No assets found (clean).');
    }

    // 4. Update Items to Non-Serialized
    console.log('Updating ONUs to be NON-serialized...');
    await supabase.from('inventory_items').update({ is_serialized: false }).in('id', itemIds);

    console.log('Done.');
}

cleanup();
