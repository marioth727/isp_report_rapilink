import { useState, useEffect } from 'react';
import {
    Truck,
    Search,
    User,
    Package,
    CheckCircle,
    ArrowRight,
    Loader2,
    Box,
    Hash,
    PackagePlus,
    ChevronRight,
    X,
    Check,
    LayoutGrid
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { supabase } from '../lib/supabase';
import clsx from 'clsx';

export default function InventoryAssignment() {
    const [assets, setAssets] = useState<any[]>([]);
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [serialSearchQuery, setSerialSearchQuery] = useState('');
    const [kits, setKits] = useState<any[]>([]);
    const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
    const [selectedTech, setSelectedTech] = useState<string>('');
    const [showSerialPicker, setShowSerialPicker] = useState<string | null>(null);
    const [showKitPicker, setShowKitPicker] = useState(false);
    const [activeKit, setActiveKit] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: assetData } = await supabase
                .from('inventory_assets')
                .select('*, inventory_items(name, model_name, brand, image_url)')
                .eq('status', 'warehouse');
            if (assetData) setAssets(assetData);

            const { data: techData } = await supabase
                .from('profiles')
                .select('id, full_name, role')
                .eq('is_field_tech', true);
            if (techData) setTechnicians(techData);

            const { data: kitsData } = await supabase
                .from('inventory_kits')
                .select('*, inventory_kit_items(*, inventory_items(*))')
                .order('name');
            if (kitsData) setKits(kitsData);
        } catch (error) {
            console.error('Error loading assignment data:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleAsset = (assetId: string) => {
        setSelectedAssets(prev =>
            prev.includes(assetId)
                ? prev.filter(id => id !== assetId)
                : [...prev, assetId]
        );
    };

    const handleAssign = async () => {
        if (!selectedTech || selectedAssets.length === 0) return;
        setIsSaving(true);
        const toastEvent = (msg: string, type: any) => window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: msg, type } }));

        try {
            // Register movement for EACH asset to ensure individual trackability
            const movementsToInsert = selectedAssets.map(assetId => ({
                asset_id: assetId,
                movement_type: 'transfer',
                destination_holder_id: selectedTech,
                notes: `Asignación masiva (parte de un lote de ${selectedAssets.length})`
            }));

            const { data: moveData, error: moveError } = await supabase
                .from('inventory_movements')
                .insert(movementsToInsert)
                .select();

            if (moveError) throw moveError;

            // Update each asset with its corresponding movement_id
            // Since movements were inserted together, we map them back
            const updatePromises = selectedAssets.map(assetId => {
                const move = (moveData as any[]).find(m => m.asset_id === assetId);
                return supabase
                    .from('inventory_assets')
                    .update({
                        status: 'assigned',
                        current_holder_id: selectedTech,
                        last_movement_id: move?.id
                    })
                    .eq('id', assetId);
            });

            await Promise.all(updatePromises);

            toastEvent(`${selectedAssets.length} equipos asignados correctamente`, 'success');
            setSelectedAssets([]);
            setSelectedTech('');
            loadData();
        } catch (error: any) {
            console.error(error);
            toastEvent('Error en la asignación: ' + error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const applyKit = (kit: any) => {
        setActiveKit(kit);
        setShowKitPicker(false);
        // We don't auto-select serials because we don't know WHICH ones.
        // But we could filter the view to show only what the kit needs.
    };

    const groupedAssets = assets.reduce((acc: any, asset: any) => {
        const itemId = asset.item_id;
        if (!acc[itemId]) {
            acc[itemId] = {
                item: asset.inventory_items,
                assets: [],
                itemId
            };
        }
        acc[itemId].assets.push(asset);
        return acc;
    }, {});

    const filteredGroups = Object.values(groupedAssets).filter((group: any) => {
        // Si hay un kit activo, filtrar también por los modelos del kit
        if (activeKit) {
            const kitItems = activeKit.inventory_kit_items.map((ki: any) => ki.item_id);
            if (!kitItems.includes(group.itemId)) return false;
        }

        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;

        const itemName = group.item?.name?.toLowerCase() || '';
        const itemBrand = group.item?.brand?.toLowerCase() || '';
        const itemModel = group.item?.model_name?.toLowerCase() || '';

        // Buscar por nombre de modelo
        if (itemName.includes(query) || itemBrand.includes(query) || itemModel.includes(query)) return true;

        // O buscar si algún serial dentro del grupo coincide
        return group.assets.some((a: any) => a.serial_number.toLowerCase().includes(query));
    });

    if (loading) {
        return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header section with refined aesthetics */}
            <div className="relative overflow-hidden bg-card border-2 border-border p-8 rounded-[2.5rem] shadow-sm">
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-primary/10 rounded-lg"><Truck size={20} className="text-primary" /></div>
                                <span className="text-[10px] font-black uppercase text-primary tracking-widest">Operaciones / Almacén Central</span>
                            </div>
                            <h1 className="text-4xl font-black tracking-tight text-foreground uppercase leading-none">Entrega a Técnicos</h1>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowKitPicker(true)}
                                className={clsx(
                                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border-2",
                                    activeKit
                                        ? "bg-primary/10 border-primary text-primary"
                                        : "bg-card border-border text-muted-foreground hover:border-primary/50"
                                )}
                            >
                                <LayoutGrid size={14} />
                                {activeKit ? `Modo Kit: ${activeKit.name}` : 'Cargar desde Kit'}
                            </button>
                            {activeKit && (
                                <button
                                    onClick={() => setActiveKit(null)}
                                    className="p-2 hover:bg-muted rounded-xl text-muted-foreground"
                                    title="Quitar filtro de Kit"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch gap-4 shrink-0">
                        <div className="relative min-w-[280px]">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                            <select
                                value={selectedTech}
                                onChange={(e) => setSelectedTech(e.target.value)}
                                className="w-full bg-muted/50 border-2 border-border rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all font-black uppercase text-xs appearance-none cursor-pointer"
                            >
                                <option value="">Elegir Técnico Receptor...</option>
                                {technicians.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                            </select>
                        </div>
                        <button
                            onClick={handleAssign}
                            disabled={!selectedTech || selectedAssets.length === 0 || isSaving}
                            className="px-8 py-4 bg-primary text-white text-xs font-black uppercase rounded-2xl shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:scale-100 flex items-center justify-center gap-3 transition-all min-w-[200px]"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            Transferir {selectedAssets.length > 0 && `(${selectedAssets.length})`}
                        </button>
                    </div>
                </div>
                {/* Decorative background circle */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
            </div>

            {/* Powerful Search Bar */}
            <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder="Escribe el NOMBRE del producto o el SERIAL (SN) exacto para buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-card border-2 border-border rounded-3xl py-6 pl-16 pr-6 text-lg font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all shadow-xl shadow-muted/20"
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <kbd className="hidden sm:inline-flex px-2 py-1 bg-muted border border-border rounded text-[10px] font-black text-muted-foreground uppercase">Filtro Activo</kbd>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {assets.length === 0 ? (
                    <div className="col-span-full py-32 text-center space-y-8 bg-muted/5 border-4 border-dashed border-border rounded-[3rem] animate-pulse">
                        <div className="p-8 bg-card rounded-full w-32 h-32 mx-auto flex items-center justify-center border-2 border-primary/20 shadow-2xl">
                            <Box className="w-16 h-16 text-primary/20" />
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black uppercase text-foreground tracking-tighter">Inventario en Cero</h2>
                            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest max-w-md mx-auto leading-relaxed">
                                No puedes entregar equipos porque todavía no has registrado ninguna unidad física (Seriales/MACs) en tu bodega central.
                            </p>
                            <div className="pt-6">
                                <button
                                    onClick={() => window.location.href = '/operaciones/inventario/stock'}
                                    className="px-10 py-5 bg-primary text-white text-xs font-black uppercase rounded-2xl shadow-2xl shadow-primary/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 mx-auto"
                                >
                                    <PackagePlus className="w-5 h-5" />
                                    Registrar Primeros Equipos Ahora
                                </button>
                            </div>
                        </div>
                    </div>
                ) : filteredGroups.length > 0 ? (
                    filteredGroups.map((group: any) => {
                        const selectedInGroup = group.assets.filter((a: any) => selectedAssets.includes(a.id)).length;

                        return (
                            <div
                                key={group.itemId}
                                onClick={() => {
                                    setShowSerialPicker(group.itemId);
                                    setSerialSearchQuery('');
                                }}
                                className={clsx(
                                    "relative overflow-hidden bg-card border-2 p-6 rounded-[2.5rem] cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] group",
                                    selectedInGroup > 0
                                        ? "border-primary bg-primary/[0.02] shadow-2xl shadow-primary/10"
                                        : "border-border hover:border-primary/20 hover:shadow-xl hover:shadow-muted/30"
                                )}
                            >
                                {selectedInGroup > 0 && (
                                    <div className="absolute top-6 right-6 z-10">
                                        <div className="bg-primary px-3 py-1 rounded-full shadow-lg shadow-primary/30 flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-white" />
                                            <span className="text-[10px] font-black text-white">{selectedInGroup} Seleccionados</span>
                                        </div>
                                    </div>
                                )}

                                <div className="aspect-square bg-muted/30 rounded-3xl mb-6 flex items-center justify-center border border-border group-hover:bg-primary/5 transition-colors overflow-hidden">
                                    {group.item?.image_url ? (
                                        <img src={group.item.image_url} alt="" className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500" />
                                    ) : (
                                        <Package className="w-16 h-16 text-muted-foreground/30 group-hover:text-primary/30 transition-colors" />
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-black text-primary uppercase border border-primary/20 px-2 py-0.5 rounded-full bg-primary/5">
                                            {group.item?.brand || 'Sin Marca'}
                                        </span>
                                        <h3 className="text-lg font-black text-foreground uppercase leading-tight group-hover:text-primary transition-colors truncate">
                                            {group.item?.name}
                                        </h3>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{group.item?.model_name || 'Generic'}</p>
                                    </div>

                                    <div className="pt-4 border-t border-border flex justify-between items-center">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">En Bodega</p>
                                            <p className="text-xl font-black text-foreground">{group.assets.length} <span className="text-[10px] text-muted-foreground font-bold">UNIDADES</span></p>
                                        </div>
                                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                            <ChevronRight size={20} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-32 text-center space-y-6 bg-muted/5 border-2 border-dashed border-border rounded-[3rem]">
                        <div className="p-6 bg-card rounded-full w-24 h-24 mx-auto flex items-center justify-center border border-border">
                            <Search className="w-10 h-10 text-muted-foreground/20" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-xl font-black uppercase text-foreground">Sin registros para "{searchQuery}"</p>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest max-w-xs mx-auto">
                                No hay resultados con ese nombre o serial.
                            </p>
                        </div>
                        <button onClick={() => setSearchQuery('')} className="px-6 py-2 text-[10px] font-black uppercase text-primary border border-primary/30 rounded-xl hover:bg-primary/5">
                            Ver Todo el Stock
                        </button>
                    </div>
                )}
            </div>

            {/* Serial Picker Modal */}
            {showSerialPicker && (() => {
                const group = Object.values(groupedAssets).find((g: any) => g.itemId === showSerialPicker) as any;
                if (!group) return null;

                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                        <div className="absolute inset-0 bg-background/80 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowSerialPicker(null)} />

                        <div className="relative w-full max-w-2xl bg-card border-2 border-border rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 flex flex-col max-h-[90vh]">
                            {/* Modal Header */}
                            <div className="p-8 border-b border-border bg-muted/10 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                        <Hash size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{group.item?.name}</h3>
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Seleccionar Seriales Disponibles ({group.assets.length})</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowSerialPicker(null)}
                                    className="p-3 hover:bg-muted rounded-2xl transition-colors text-muted-foreground hover:text-foreground"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Search Filter for Serials */}
                            <div className="px-8 pb-4">
                                <div className="relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Buscar serial específico..."
                                        value={serialSearchQuery}
                                        onChange={(e) => setSerialSearchQuery(e.target.value)}
                                        className="w-full bg-muted/50 border-2 border-border rounded-2xl py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-primary transition-all"
                                    />
                                    {serialSearchQuery && (
                                        <button
                                            onClick={() => setSerialSearchQuery('')}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-lg transition-colors"
                                        >
                                            <X size={14} className="text-muted-foreground" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Serial List */}
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {group.assets
                                        .filter((a: any) => a.serial_number.toLowerCase().includes(serialSearchQuery.toLowerCase()))
                                        .map((asset: any) => {
                                            const isSelected = selectedAssets.includes(asset.id);
                                            return (
                                                <div
                                                    key={asset.id}
                                                    onClick={() => toggleAsset(asset.id)}
                                                    className={clsx(
                                                        "p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all",
                                                        isSelected
                                                            ? "border-primary bg-primary/5"
                                                            : "border-border hover:border-primary/30 bg-muted/10"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Hash size={14} className={isSelected ? "text-primary" : "text-muted-foreground"} />
                                                        <span className={clsx(
                                                            "text-xs font-black uppercase tracking-wider",
                                                            isSelected ? "text-primary" : "text-foreground"
                                                        )}>
                                                            {asset.serial_number}
                                                        </span>
                                                    </div>
                                                    <div className={clsx(
                                                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                                        isSelected ? "bg-primary border-primary" : "bg-card border-border"
                                                    )}>
                                                        {isSelected && <Check size={14} className="text-white" />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 bg-muted/10 border-t border-border flex justify-between items-center">
                                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    {group.assets.filter((a: any) => selectedAssets.includes(a.id)).length} de {group.assets.length} seleccionados
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            const allIds = group.assets.map((a: any) => a.id);
                                            setSelectedAssets(prev => {
                                                const otherSelected = prev.filter(id => !allIds.includes(id));
                                                return [...otherSelected, ...allIds];
                                            });
                                        }}
                                        className="px-4 py-2 text-[10px] font-black uppercase text-primary hover:bg-primary/5 rounded-xl transition-colors"
                                    >
                                        Marcar Todos
                                    </button>
                                    <button
                                        onClick={() => setShowSerialPicker(null)}
                                        className="px-8 py-3 bg-primary text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                                    >
                                        Listo
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Kit Picker Modal */}
            <Modal
                isOpen={showKitPicker}
                onClose={() => setShowKitPicker(false)}
                title="Seleccionar Plantilla de Kit"
            >
                <div className="space-y-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
                        Elige una plantilla para filtrar automáticamente los equipos necesarios.
                    </p>
                    <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
                        {kits.length === 0 ? (
                            <div className="py-12 border-2 border-dashed border-border rounded-3xl text-center">
                                <p className="text-[10px] font-black text-muted-foreground uppercase italic">No has creado kits todavía</p>
                                <button
                                    onClick={() => window.location.href = '/operaciones/inventario/kits'}
                                    className="mt-4 text-xs font-black text-primary hover:underline uppercase"
                                >
                                    Configurar Kits Ahora
                                </button>
                            </div>
                        ) : kits.map(kit => (
                            <button
                                key={kit.id}
                                onClick={() => applyKit(kit)}
                                className="flex flex-col text-left p-4 bg-muted/20 border-2 border-border rounded-2xl hover:border-primary/50 hover:bg-primary/[0.02] transition-all group"
                            >
                                <div className="flex items-center justify-between w-full mb-1">
                                    <span className="font-black text-sm uppercase group-hover:text-primary transition-colors">{kit.name}</span>
                                    <ChevronRight size={14} className="text-muted-foreground" />
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {kit.inventory_kit_items.map((ki: any) => (
                                        <span key={ki.id} className="text-[8px] font-black text-muted-foreground uppercase bg-card px-1.5 py-0.5 rounded border border-border">
                                            {ki.quantity}x {ki.inventory_items?.name?.split(' ')[0]}
                                        </span>
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="pt-4 border-t border-border flex justify-end">
                        <button
                            onClick={() => setShowKitPicker(false)}
                            className="px-6 py-3 bg-muted rounded-xl text-[10px] font-black uppercase"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Selection Toolbar (Floating) */}
            {selectedAssets.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-6 px-8 py-4 bg-foreground text-background rounded-full shadow-2xl animate-in slide-in-from-bottom-10 border border-white/10">
                    <div className="flex items-center gap-3 pr-6 border-r border-white/20">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-black text-white text-xs">
                            {selectedAssets.length}
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Equipos para entrega</span>
                    </div>
                    <button
                        onClick={handleAssign}
                        disabled={!selectedTech || isSaving}
                        className="flex items-center gap-3 text-xs font-black uppercase hover:text-primary transition-colors disabled:opacity-30"
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                        {selectedTech ? `Entregar a ${technicians.find(t => t.id === selectedTech)?.full_name.split(' ')[0]}` : 'Seleccione técnico arriba'}
                    </button>
                </div>
            )}
        </div>
    );
}
