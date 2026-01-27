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
                    .select('item_id, status');

                const stocks: Record<string, { total: number, serialized: number }> = {};
                itemData.forEach(item => {
                    const itemAssets = assetData?.filter(a => a.item_id === item.id) || [];
                    stocks[item.id] = {
                        total: itemAssets.length,
                        serialized: itemAssets.length
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
        const serialsRaw = formData.get('serials') as string;
        const notes = formData.get('notes') as string;

        const assetEntries = serialsRaw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

        try {
            // First, insert assets
            const assetsToInsert = assetEntries.map(serial => ({
                item_id: selectedItemForStock.id,
                serial_number: serial,
                status: 'warehouse'
            }));

            const { data: insertedAssets, error: assetError } = await supabase
                .from('inventory_assets')
                .insert(assetsToInsert)
                .select();

            if (assetError) throw assetError;

            // Now insert movements for each inserted asset
            const movementsToInsert = (insertedAssets as any[]).map(asset => ({
                asset_id: asset.id,
                movement_type: 'entry',
                notes: `Entrada inicial: ${notes}`
            }));

            const { data: moveData, error: moveError } = await supabase
                .from('inventory_movements')
                .insert(movementsToInsert)
                .select();

            if (moveError) throw moveError;

            // Update assets with their last_movement_id
            const updatePromises = (moveData as any[]).map(move => {
                return supabase
                    .from('inventory_assets')
                    .update({ last_movement_id: move.id })
                    .eq('id', move.asset_id);
            });
            await Promise.all(updatePromises);

            showToast(`${assetEntries.length} equipos registrados correctamente`, 'success');
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
                                Pega los Seriales o MACs uno por línea. Cada uno se registrará como un equipo único en bodega disponible para asignación.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Lista de Seriales / MACs</label>
                        <textarea
                            name="serials"
                            required
                            placeholder="SN123456...&#10;SN789012..."
                            className="w-full bg-muted/30 border border-border rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none h-48 resize-none"
                        />
                    </div>

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
