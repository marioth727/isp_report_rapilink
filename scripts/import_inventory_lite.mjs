import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * MODO LITE: Importa Nombre y Cantidad
 * Estructura JSON esperada:
 * [
 *   { "Nombre": "Conector RJ45", "Cantidad": 500 },
 *   { "Nombre": "Cable UTP Cat6", "Cantidad": 305 }
 * ]
 */

const DATA_FILE = './scripts/inventory_data.json';

async function importInventoryLite() {
    console.log('📦 Iniciando Importación de Inventario (Modo Lite con Categorías)...');

    if (!fs.existsSync(DATA_FILE)) {
        console.error(`❌ Error: No se encuentra el archivo ${DATA_FILE}`);
        return;
    }

    const rawData = fs.readFileSync(DATA_FILE, 'utf8');
    const items = JSON.parse(rawData);

    // Cache de categorías para evitar hits repetidos a la DB
    const categoryCache = {};

    for (const item of items) {
        const nombre = item.Nombre || item.nombre;
        const cantidad = parseInt(item.Cantidad || item.cantidad || 0);
        const categoriaNombre = item.Categoria || 'OTROS / VARIOS';

        if (!nombre) continue;

        // 1. Obtener o crear categoría
        let categoryId = categoryCache[categoriaNombre];
        
        if (!categoryId) {
            const { data: existingCat } = await supabase
                .from('inventory_categories')
                .select('id')
                .eq('name', categoriaNombre)
                .single();
            
            if (existingCat) {
                categoryId = existingCat.id;
            } else {
                console.log(`📁 Creando categoría "${categoriaNombre}"...`);
                const { data: newCat, error: insCatError } = await supabase
                    .from('inventory_categories')
                    .insert([{ name: categoriaNombre }])
                    .select()
                    .single();
                
                if (insCatError) {
                    console.error(`   ❌ Error al crear categoría: ${insCatError.message}`);
                    continue;
                }
                categoryId = newCat.id;
            }
            categoryCache[categoriaNombre] = categoryId;
        }

        console.log(`\n🔹 Procesando: ${nombre} (${cantidad} unidades) -> [${categoriaNombre}]`);

        // 2. Crear Item en el catálogo (No serializado)
        // Verificamos si ya existe por nombre
        const { data: existingItem } = await supabase
            .from('inventory_items')
            .select('id')
            .eq('name', nombre)
            .single();

        let itemId;
        if (existingItem) {
            console.log(`   🔸 Item ya existe (ID: ${existingItem.id}). Saltando creación.`);
            itemId = existingItem.id;
        } else {
            const { data: dbItem, error: itemError } = await supabase
                .from('inventory_items')
                .insert([{
                    name: nombre,
                    category_id: categoryId,
                    is_serialized: false,
                    min_stock_level: 5
                }])
                .select()
                .single();

            if (itemError) {
                console.error(`   ❌ Error al crear item: ${itemError.message}`);
                continue;
            }
            itemId = dbItem.id;
        }

        // 3. Crear Activo (Lote de stock)
        const lotSerial = `LOTE-IMPORT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const { error: assetError } = await supabase
            .from('inventory_assets')
            .insert([{
                item_id: itemId,
                serial_number: lotSerial,
                status: 'warehouse',
                quantity: cantidad
            }]);

        if (assetError) {
            console.error(`   ❌ Error al crear stock: ${assetError.message}`);
        } else {
            console.log(`   ✅ Cargado correctamente.`);
        }
    }

    console.log('\n✨ Importación finalizada.');
}

importInventoryLite().catch(console.error);
