const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Corrected path for project root

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function mergeDuplicateAssets() {
    console.log('Starting asset merge process...');

    // 1. Get all non-serialized items
    const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id, name')
        .eq('is_serialized', false);

    if (itemsError) {
        console.error('Error fetching items:', itemsError);
        return;
    }

    console.log(`Found ${items.length} non-serialized items.`);

    for (const item of items) {
        // --- SCENARIO A: WAREHOUSE STOCK ---
        const { data: warehouseAssets, error: whError } = await supabase
            .from('inventory_assets')
            .select('*')
            .eq('item_id', item.id)
            .eq('status', 'warehouse')
            .order('created_at', { ascending: true });

        if (!whError && warehouseAssets.length > 1) {
            await doMerge(item, warehouseAssets, 'Warehouse');
        }

        // --- SCENARIO B: TECHNICIAN STOCK ---
        // Group by technician
        const { data: techAssets, error: techError } = await supabase
            .from('inventory_assets')
            .select('*')
            .eq('item_id', item.id)
            .eq('status', 'assigned')
            .not('current_holder_id', 'is', null);

        if (techError) continue;

        const assetsByTech = techAssets.reduce((acc, a) => {
            acc[a.current_holder_id] = acc[a.current_holder_id] || [];
            acc[a.current_holder_id].push(a);
            return acc;
        }, {});

        for (const [techId, assets] of Object.entries(assetsByTech)) {
            if (assets.length > 1) {
                await doMerge(item, assets, `Technician ${techId}`);
            }
        }
    }

    console.log('Merge process completed.');
}

async function doMerge(item, assets, context) {
    console.log(`Merging ${assets.length} assets for ${item.name} (${context})...`);

    const primaryAsset = assets[0];
    const assetsToMerge = assets.slice(1);

    let totalQuantity = 0;
    const idsToDelete = [];

    for (const asset of assets) {
        totalQuantity += (asset.quantity || 0);
    }

    // We already have the primary asset, so we delete the others
    for (const asset of assetsToMerge) {
        idsToDelete.push(asset.id);
    }

    console.log(`- New Total Quantity: ${totalQuantity}`);
    console.log(`- IDs to delete: ${idsToDelete.join(', ')}`);

    // 3. Update primary asset
    const { error: updateError } = await supabase
        .from('inventory_assets')
        .update({ quantity: totalQuantity })
        .eq('id', primaryAsset.id);

    if (updateError) {
        console.error(`  Error updating primary asset ${primaryAsset.id}:`, updateError);
        return;
    }

    // 4. Update movements to point to primary asset
    const { error: moveUpdateError } = await supabase
        .from('inventory_movements')
        .update({ asset_id: primaryAsset.id })
        .in('asset_id', idsToDelete);

    if (moveUpdateError) {
        console.error(`  Error re-linking movements:`, moveUpdateError);
    }

    // 5. Delete merged assets
    const { error: deleteError } = await supabase
        .from('inventory_assets')
        .delete()
        .in('id', idsToDelete);

    if (deleteError) {
        console.error('  Error deleting merged assets:', deleteError);
    } else {
        console.log(`  Successfully merged ${item.name} in ${context}.`);
    }
}

mergeDuplicateAssets();
