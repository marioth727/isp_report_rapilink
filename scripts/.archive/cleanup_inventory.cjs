
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using Service Role Key for Admin access

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Key in .env');
    console.error('URL:', supabaseUrl);
    console.error('Key exists?', !!supabaseServiceKey);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanup() {
    console.log('Connecting to Self-Hosted Supabase:', supabaseUrl);

    // 1. Identify Items
    const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id, name')
        .or('name.ilike.%conector%,name.ilike.%tensor%');

    if (itemsError) {
        console.error('Error fetching items:', itemsError);
        return;
    }

    if (!items || items.length === 0) {
        console.log('No items found matching "conector" or "tensor".');
        return;
    }

    console.log(`Found ${items.length} items to clean up:`, items.map(i => i.name));
    const itemIds = items.map(i => i.id);

    // 2. Break Circular Dependency (last_movement_id)
    console.log('Breaking circular dependencies...');
    const { error: updateError } = await supabase
        .from('inventory_assets')
        .update({ last_movement_id: null })
        .in('item_id', itemIds);

    if (updateError) console.error('Error updating assets:', updateError);

    // 3. Find Assets to get IDs for movement deletion
    const { data: assets } = await supabase
        .from('inventory_assets')
        .select('id')
        .in('item_id', itemIds);

    const assetIds = assets?.map(a => a.id) || [];

    if (assetIds.length > 0) {
        console.log(`Found ${assetIds.length} assets to delete.`);

        // 4. Delete Movements
        console.log(`Deleting movements for these assets...`);
        const { error: moveError } = await supabase
            .from('inventory_movements')
            .delete()
            .in('asset_id', assetIds);

        if (moveError) console.error('Error deleting movements:', moveError);

        // 5. Delete Assets
        console.log(`Deleting assets...`);
        const { error: deleteError } = await supabase
            .from('inventory_assets')
            .delete()
            .in('id', assetIds);

        if (deleteError) console.error('Error deleting assets:', deleteError);
    } else {
        console.log('No assets found for these items (Inventory is already clean).');
    }

    // 6. Update Items to Non-Serialized
    console.log('Updating items to be NON-serialized...');
    const { error: itemUpdateError } = await supabase
        .from('inventory_items')
        .update({ is_serialized: false })
        .in('id', itemIds);

    if (itemUpdateError) console.error('Error updating items:', itemUpdateError);

    console.log('Cleanup complete.');
}

cleanup();
