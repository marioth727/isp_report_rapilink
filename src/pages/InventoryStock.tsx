import { useState, useEffect } from 'react';
import {
    Search,
    Box,
    PackagePlus,
    Info,
    Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import clsx from 'clsx';

export default function InventoryStock() {
    const [items, setItems] = useState<any[]>([]);
    const [itemStocks, setItemStocks] = useState<Record<string, { total: number, serialized: number }>>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Modal state
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
    const [selectedItemForStock, setSelectedItemForStock] = useState<any>(null);

    useEffect(() => {
        loadStockData();
    }, []);

    const loadStockData = async () => {
        setLoading(true);
        try {
            const { data: itemData } = await supabase
                .from('inventory_items')
                .select('*, inventory_categories(name)')
                .order('name');

            if (itemData) {
                setItems(itemData);

                const { data: assetData } = await supabase
                    .from('inventory_assets')
                    .select('item_id, status, quantity');

                const stocks: Record<string, { total: number, serialized: number }> = {};
                itemData.forEach(item => {
                    const itemAssets = assetData?.filter(a => a.item_id === item.id) || [];

                    // [FIX] Calcular stock basado en:
                    // - Si es serializado: Conteo de filas (cada asset es 1 unidad)
                    // - Si NO es serializado: Suma de la columna 'quantity' (cada asset es un lote)
                    // - Fallback: Si quantity es null, asumimos 1.
                    const totalQuantity = itemAssets.reduce((sum, asset) => {
                        return sum + (asset.quantity || 1);
                    }, 0);

                    stocks[item.id] = {
                        total: totalQuantity,
                        serialized: itemAssets.length // Esto mantiene el conteo de "lotes/filas"
                    };
                });
                setItemStocks(stocks);
            }
        } catch (error) {
            console.error('Error loading stock:', error);
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const event = new CustomEvent('app:toast', {
            detail: { message, type, duration: 4000 }
        });
        window.dispatchEvent(event);
    };

    const handleAddAssets = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedItemForStock) return;
        setIsSaving(true);

        const formData = new FormData(e.currentTarget);
        const notes = formData.get('notes') as string;

        try {
            let assetsToTrack: any[] = [];
            let entryCount = 0;

            // 1. Logic Selection
            if (selectedItemForStock.is_serialized) {
                // Lógica Original: Lista de Seriales
                const serialsRaw = formData.get('serials') as string;
                const assetEntries = serialsRaw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

                const assetsToInsert = assetEntries.map(serial => ({
                    item_id: selectedItemForStock.id,
                    serial_number: serial,
                    status: 'warehouse',
                    quantity: 1
                }));
                entryCount = assetsToInsert.length;

                // Insert Assets
                const { data: insertedAssets, error: assetError } = await supabase
                    .from('inventory_assets')
                    .insert(assetsToInsert)
                    .select();

                if (assetError) throw assetError;

                // Track for movement logging
                assetsToTrack = insertedAssets;

            } else {
                // Nueva Lógica: Cantidad Directa (Lotes) -> CONSOLIDACIÓN
                const quantityStr = formData.get('quantity') as string;
                const quantity = parseInt(quantityStr, 10);

                if (isNaN(quantity) || quantity <= 0) {
                    throw new Error("La cantidad debe ser mayor a 0");
                }
                entryCount = quantity;

                // Check for EXISTING warehouse asset for this item
                const { data: existingAssets, error: fetchError } = await supabase
                    .from('inventory_assets')
                    .select('*')
                    .eq('item_id', selectedItemForStock.id)
                    .eq('status', 'warehouse')
                    .limit(1);

                if (fetchError) throw fetchError;

                if (existingAssets && existingAssets.length > 0) {
                    // UPDATE existing asset
                    const existingAsset = existingAssets[0];
                    const newQuantity = (existingAsset.quantity || 0) + quantity;

                    const { data: updatedAsset, error: updateError } = await supabase
                        .from('inventory_assets')
                        .update({ quantity: newQuantity })
                        .eq('id', existingAsset.id)
                        .select()
                        .single();

                    if (updateError) throw updateError;
                    assetsToTrack = [updatedAsset]; // Track for movement
                } else {
                    // INSERT new asset (First time)
                    const lotSerial = `LOTE-${Date.now()}`;
                    const { data: insertedAsset, error: insertError } = await supabase
                        .from('inventory_assets')
                        .insert([{
                            item_id: selectedItemForStock.id,
                            serial_number: lotSerial,
                            status: 'warehouse',
                            quantity: quantity
                        }])
                        .select()
                        .single();

                    if (insertError) throw insertError;
                    assetsToTrack = [insertedAsset];
                }
            }

            // 2. Insert Movements (using assetsToTrack)
            const { data: { user } } = await supabase.auth.getUser();
            const movementsToInsert = assetsToTrack.map(asset => ({
                asset_id: asset.id,
                movement_type: 'entry',
                notes: `Entrada: ${notes}`,
                quantity: selectedItemForStock.is_serialized ? 1 : entryCount, // Log the added amount, not the total
                created_by: user?.id
            }));

            const { data: moveData, error: moveError } = await supabase
                .from('inventory_movements')
                .insert(movementsToInsert)
                .select();

            if (moveError) throw moveError;

            // 3. Update Assets with Movement ID (Only for new inserts or if we want to track last movement)
            // For merged assets, updating last_movement_id is fine/good.
            // But we can't do it in bulk easy if we mixed update/insert.
            // Actually, we just have 'assetsToTrack' which are the ones we touched.
            const updatePromises = moveData.map(move => {
                return supabase
                    .from('inventory_assets')
                    .update({ last_movement_id: move.id })
                    .eq('id', move.asset_id);
            });
            await Promise.all(updatePromises);



            showToast(`${entryCount} unidades registradas correctamente`, 'success');
            setIsMovementModalOpen(false);
            loadStockData();
        } catch (err: any) {
            console.error(err);
            showToast('Error al registrar entrada: ' + err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Existencias y Entradas</h1>
                    <p className="text-slate-500 font-medium">Control de stock real y carga de seriales.</p>
                </div>
                <div className="relative w-full max-w-md group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o SKU..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-500 transition-all placeholder:text-slate-400 text-slate-700"
                    />
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200">
                            <th className="px-8 py-4 text-[10px] font-extrabold uppercase text-slate-500 tracking-widest">Producto</th>
                            <th className="px-8 py-4 text-[10px] font-extrabold uppercase text-slate-500 tracking-widest text-center">En Almacén</th>
                            <th className="px-8 py-4 text-[10px] font-extrabold uppercase text-slate-500 tracking-widest text-center">Estado de Stock</th>
                            <th className="px-8 py-4 text-[10px] font-extrabold uppercase text-slate-500 tracking-widest text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredItems.map((item) => {
                            const stock = itemStocks[item.id] || { total: 0, serialized: 0 };
                            const isLowStock = stock.total <= (item.min_stock_level || 0);

                            return (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-8 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100">
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt="" className="w-full h-full object-contain" />
                                                ) : (
                                                    <Box className="w-5 h-5 text-slate-400" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 uppercase text-sm tracking-tight">{item.name}</p>
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase">{item.inventory_categories?.name || 'S/C'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-center">
                                        <span className={clsx(
                                            "text-xl font-black",
                                            isLowStock ? "text-red-500" : "text-slate-800"
                                        )}>
                                            {stock.total}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4 text-center">
                                        {stock.total === 0 && (item.min_stock_level || 0) > 0 ? (
                                            <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black rounded-lg uppercase border border-red-100 animate-pulse">
                                                Agotado
                                            </span>
                                        ) : isLowStock ? (
                                            <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black rounded-lg uppercase border border-amber-100">
                                                Bajo Stock
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg uppercase border border-emerald-100">
                                                Óptimo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        <button
                                            className="px-4 py-2 bg-blue-900 text-white text-[10px] font-bold uppercase rounded-lg shadow-sm hover:bg-blue-800 hover:shadow-md transition-all active:scale-95"
                                            onClick={() => {
                                                setSelectedItemForStock(item);
                                                setIsMovementModalOpen(true);
                                            }}
                                        >
                                            + Entrada
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isMovementModalOpen}
                onClose={() => setIsMovementModalOpen(false)}
                title={`Entrada Masiva: ${selectedItemForStock?.name}`}
            >
                <form onSubmit={handleAddAssets} className="space-y-6">
                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-3">
                        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-xs font-black text-primary uppercase">Guía de Importación</p>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                {selectedItemForStock?.is_serialized ? (
                                    "Pega los Seriales o MACs uno por línea. Cada uno se registrará como un equipo único en bodega disponible para asignación."
                                ) : (
                                    "Este producto no requiere seriales individuales. Ingresa la cantidad total a agregar al inventario."
                                )}
                            </p>
                        </div>
                    </div>

                    {selectedItemForStock?.is_serialized ? (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Lista de Seriales / MACs</label>
                            <textarea
                                name="serials"
                                required
                                placeholder="SN123456...&#10;SN789012..."
                                className="w-full bg-muted/30 border border-border rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none h-48 resize-none"
                            />
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Cantidad a Ingresar</label>
                            <input
                                type="number"
                                name="quantity"
                                required
                                min="1"
                                placeholder="0"
                                className="w-full bg-muted/30 border border-border rounded-xl p-4 text-2xl font-black text-center focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Observaciones</label>
                        <input
                            name="notes"
                            placeholder="Ej: Factura #1234 - Importación"
                            className="w-full bg-muted/30 border border-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsMovementModalOpen(false)}
                            className="flex-1 py-3 bg-muted hover:bg-muted/80 rounded-xl text-xs font-black uppercase transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
                            Registrar en Almacén
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
