import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyImport() {
    console.log('🔍 Verificando importación...');

    const { data: items, count: itemCount } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact' });

    const { data: categories, count: catCount } = await supabase
        .from('inventory_categories')
        .select('*', { count: 'exact' });

    const { data: assets, count: assetCount } = await supabase
        .from('inventory_assets')
        .select('*', { count: 'exact' });

    console.log(`\n📊 Estado del Inventario:`);
    console.log(`- Total Items: ${itemCount}`);
    console.log(`- Total Categorías: ${catCount}`);
    console.log(`- Total Activos (S/N + Lotes): ${assetCount}`);

    console.log('\n📁 Categorías actuales:');
    console.table(categories.map(c => ({ ID: c.id, Nombre: c.name })));
}

verifyImport().catch(console.error);
