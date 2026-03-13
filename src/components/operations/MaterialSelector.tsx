import { useMemo, useState } from 'react';
import { Package, Hash, Minus, Plus, Search, Cable, Box } from 'lucide-react';
import clsx from 'clsx';

interface MaterialSelectorProps {
    stock: any[];
    selectedMaterials: Record<string, number>;
    onChange: (newSelection: Record<string, number>) => void;
}

export function MaterialSelector({ stock, selectedMaterials, onChange }: MaterialSelectorProps) {
    const [filter, setFilter] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'equipment' | 'cables' | 'consumables'>('all');

    // Agrupación de Inventario
    const { equipment, cables, consumables } = useMemo(() => {
        const groups = {
            equipment: [] as any[],
            cables: [] as any[],
            consumables: [] as any[]
        };

        stock.forEach(item => {
            const name = item.inventory_items?.name?.toLowerCase() || '';
            const isSerialized = item.inventory_items?.is_serialized;
            const unitType = item.inventory_items?.inventory_categories?.unit_type?.toLowerCase();

            if (filter && !name.includes(filter.toLowerCase())) return;

            if (isSerialized) {
                groups.equipment.push(item);
            } else if (name.includes('cable') || name.includes('drop') || unitType === 'mts' || unitType === 'metros') {
                groups.cables.push(item);
            } else {
                groups.consumables.push(item);
            }
        });

        return groups;
    }, [stock, filter]);

    const handleQuantityChange = (id: string, delta: number, isSerialized: boolean) => {
        const item = stock.find(s => s.id === id);
        const maxAvailable = item?.quantity || (isSerialized ? 1 : 0);

        const current = selectedMaterials[id] || 0;
        const newQty = Math.max(0, current + delta);

        if (isSerialized && newQty > 1) return; // Serializados max 1
        if (newQty > maxAvailable) return; // Validación de Stock Real

        const next = { ...selectedMaterials };
        if (newQty === 0) {
            delete next[id];
        } else {
            next[id] = newQty;
        }
        onChange(next);
    };

    const handleSetQuantity = (id: string, qty: number) => {
        const item = stock.find(s => s.id === id);
        const maxAvailable = item?.quantity || 0;

        const next = { ...selectedMaterials };
        const safeQty = Math.min(qty, maxAvailable);

        if (safeQty <= 0) delete next[id];
        else next[id] = safeQty;
        onChange(next);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header & Filtros */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-xl w-fit">
                    {(['all', 'equipment', 'cables', 'consumables'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={clsx(
                                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                                activeTab === tab ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                            )}
                        >
                            {tab === 'all' ? 'Todo' : tab === 'equipment' ? 'Equipos' : tab === 'cables' ? 'Cables' : 'Insumos'}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar material..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900/10 transition-all uppercase placeholder:normal-case"
                    />
                </div>
            </div>

            {/* SECCIÓN 1: EQUIPOS (Tarjetas Grandes) */}
            {(activeTab === 'all' || activeTab === 'equipment') && equipment.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <Box size={12} /> Equipos Serializados
                    </h4>
                    <div className="grid grid-cols-1 gap-3">
                        {equipment.map(item => {
                            const isSelected = !!selectedMaterials[item.id];
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => handleQuantityChange(item.id, isSelected ? -1 : 1, true)}
                                    className={clsx(
                                        "relative p-4 rounded-2xl border-2 transition-all cursor-pointer group hover:shadow-lg",
                                        isSelected
                                            ? "bg-zinc-900 border-zinc-900 shadow-xl shadow-zinc-900/20"
                                            : "bg-white border-zinc-100 hover:border-zinc-300"
                                    )}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx(
                                                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                                isSelected ? "bg-white/10 text-white" : "bg-zinc-100 text-zinc-400"
                                            )}>
                                                <Package size={20} />
                                            </div>
                                            <div>
                                                <h5 className={clsx(
                                                    "text-sm font-black uppercase leading-none",
                                                    isSelected ? "text-white" : "text-zinc-900"
                                                )}>
                                                    {item.inventory_items?.name}
                                                </h5>
                                                <p className={clsx(
                                                    "text-[10px] font-bold uppercase mt-1 flex items-center gap-1.5",
                                                    isSelected ? "text-zinc-400" : "text-zinc-400"
                                                )}>
                                                    <Hash size={10} />
                                                    {item.serial_number}
                                                </p>
                                            </div>
                                        </div>

                                        <div className={clsx(
                                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                            isSelected ? "bg-emerald-500 border-emerald-500" : "border-zinc-200 group-hover:border-zinc-300"
                                        )}>
                                            {isSelected && <Plus size={14} className="text-white rotate-45" />}
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <div className="absolute inset-0 rounded-2xl ring-2 ring-emerald-500/50 animate-pulse pointer-events-none" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* SECCIÓN 2: CABLES (Sliders Intuitivos) */}
            {(activeTab === 'all' || activeTab === 'cables') && cables.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <Cable size={12} /> Cableado
                    </h4>
                    <div className="space-y-4 bg-zinc-50/50 p-4 rounded-3xl border border-zinc-100">
                        {cables.map(item => {
                            const value = selectedMaterials[item.id] || 0;
                            return (
                                <div key={item.id} className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <h5 className="text-xs font-black uppercase text-zinc-900">{item.inventory_items?.name}</h5>
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase">Stock: {item.quantity}m</p>
                                        </div>
                                        <div className="flex items-end gap-1">
                                            <span className="text-2xl font-black text-zinc-900 tracking-tighter">{value}</span>
                                            <span className="text-[10px] font-bold text-zinc-400 mb-1">mts</span>
                                        </div>
                                    </div>

                                    <input
                                        type="range"
                                        min="0"
                                        max={item.quantity || 0}
                                        step="5"
                                        value={value}
                                        onChange={(e) => handleSetQuantity(item.id, parseInt(e.target.value))}
                                        className={clsx(
                                            "w-full h-2 rounded-lg appearance-none cursor-pointer transition-all",
                                            value >= item.quantity ? "bg-orange-100 accent-orange-500" : "bg-zinc-100 accent-zinc-900 hover:accent-zinc-700"
                                        )}
                                    />
                                    <div className="flex justify-between mt-2 px-1">
                                        <button onClick={() => handleSetQuantity(item.id, 0)} className="text-[9px] font-bold text-zinc-400 hover:text-zinc-600 uppercase">0m</button>
                                        <button onClick={() => handleSetQuantity(item.id, Math.min(50, item.quantity))} className="text-[9px] font-bold text-zinc-400 hover:text-zinc-600 uppercase">50m</button>
                                        <button onClick={() => handleSetQuantity(item.id, Math.min(100, item.quantity))} className="text-[9px] font-bold text-zinc-400 hover:text-zinc-600 uppercase">100m</button>
                                        <button onClick={() => handleSetQuantity(item.id, item.quantity)} className="text-[9px] font-black text-blue-600 hover:text-blue-700 uppercase">Todo ({item.quantity}m)</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* SECCIÓN 3: CONSUMIBLES (Grid de Contadores) */}
            {(activeTab === 'all' || activeTab === 'consumables') && consumables.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <Box size={12} /> Consumibles & Accesorios
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {consumables.map(item => {
                            const value = selectedMaterials[item.id] || 0;
                            return (
                                <div
                                    key={item.id}
                                    className={clsx(
                                        "flex flex-col justify-between p-3 rounded-2xl border transition-all h-28 relative overflow-hidden",
                                        value > 0 ? "bg-blue-50 border-blue-200" : "bg-white border-zinc-200"
                                    )}
                                >
                                    <div className="z-10">
                                        <h5 className={clsx(
                                            "text-[10px] font-black uppercase line-clamp-2 leading-tight",
                                            value > 0 ? "text-blue-800" : "text-zinc-700"
                                        )}>
                                            {item.inventory_items?.name}
                                        </h5>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 z-10 mt-auto">
                                        {value > 0 ? (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleQuantityChange(item.id, -1, false); }}
                                                    className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm border border-blue-100 text-blue-600 hover:bg-blue-100 transition-colors"
                                                >
                                                    <Minus size={14} strokeWidth={3} />
                                                </button>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xl font-black text-blue-700 leading-none">{value}</span>
                                                    {value >= item.quantity && (
                                                        <span className="text-[7px] font-black text-orange-500 uppercase tracking-tighter mt-0.5">Límite</span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleQuantityChange(item.id, 1, false); }}
                                                    disabled={value >= item.quantity}
                                                    className={clsx(
                                                        "w-8 h-8 flex items-center justify-center rounded-xl shadow-sm transition-colors",
                                                        value >= item.quantity
                                                            ? "bg-zinc-100 text-zinc-300 cursor-not-allowed"
                                                            : "bg-blue-600 text-white hover:bg-blue-700"
                                                    )}
                                                >
                                                    <Plus size={14} strokeWidth={3} />
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleQuantityChange(item.id, 1, false)}
                                                className="w-full py-2 flex items-center justify-center gap-2 bg-zinc-50 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-600 transition-all font-black text-[10px] uppercase border border-zinc-100"
                                            >
                                                <Plus size={12} /> Agregar
                                            </button>
                                        )}
                                    </div>

                                    {/* Fondo decorativo */}
                                    {value > 0 && (
                                        <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {stock.length === 0 && (
                <div className="p-8 text-center border-2 border-dashed border-zinc-200 rounded-3xl">
                    <Package className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-zinc-400 uppercase">Sin stock asignado</p>
                </div>
            )}
        </div>
    );
}
