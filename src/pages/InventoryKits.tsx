import { useState, useEffect } from 'react';
import {
    Package,
    Plus,
    Loader2,
    Trash2,
    Edit,
    Search,
    Box,
    CheckCircle2,
    LayoutGrid,
    PlusCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Modal } from '../components/ui/Modal';
import clsx from 'clsx';

export default function InventoryKits() {
    const [kits, setKits] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingKit, setEditingKit] = useState<any>(null);
    const [kitFormData, setKitFormData] = useState({
        name: '',
        description: '',
        items: [] as any[] // { item_id, quantity, is_optional }
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data: kitsData } = await supabase
                .from('inventory_kits')
                .select('*, inventory_kit_items(*, inventory_items(*))')
                .order('name');

            const { data: itemsData } = await supabase
                .from('inventory_items')
                .select('*')
                .order('name');

            if (kitsData) setKits(kitsData);
            if (itemsData) setItems(itemsData);
        } catch (error) {
            console.error('Error loading kits:', error);
            showToast('Error al cargar datos', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        window.dispatchEvent(new CustomEvent('app:toast', {
            detail: { message, type }
        }));
    };

    const openModal = (kit: any = null) => {
        if (kit) {
            setEditingKit(kit);
            setKitFormData({
                name: kit.name,
                description: kit.description || '',
                items: kit.inventory_kit_items.map((ki: any) => ({
                    item_id: ki.item_id,
                    quantity: ki.quantity,
                    is_optional: ki.is_optional,
                    item: ki.inventory_items
                }))
            });
        } else {
            setEditingKit(null);
            setKitFormData({
                name: '',
                description: '',
                items: []
            });
        }
        setIsModalOpen(true);
    };

    const addItemToKit = (item: any) => {
        if (kitFormData.items.find(ki => ki.item_id === item.id)) return;
        setKitFormData(prev => ({
            ...prev,
            items: [...prev.items, { item_id: item.id, quantity: 1, is_optional: false, item }]
        }));
    };

    const removeItemFromKit = (itemId: string) => {
        setKitFormData(prev => ({
            ...prev,
            items: prev.items.filter(ki => ki.item_id !== itemId)
        }));
    };

    const updateKitItem = (itemId: string, field: string, value: any) => {
        setKitFormData(prev => ({
            ...prev,
            items: prev.items.map(ki =>
                ki.item_id === itemId ? { ...ki, [field]: value } : ki
            )
        }));
    };

    const handleSaveKit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!kitFormData.name.trim()) return;

        setIsSaving(true);
        try {
            let kitId = editingKit?.id;

            if (editingKit) {
                const { error: updateError } = await supabase
                    .from('inventory_kits')
                    .update({
                        name: kitFormData.name,
                        description: kitFormData.description
                    })
                    .eq('id', kitId);
                if (updateError) throw updateError;

                await supabase.from('inventory_kit_items').delete().eq('kit_id', kitId);
            } else {
                const { data: newKit, error: insertError } = await supabase
                    .from('inventory_kits')
                    .insert({
                        name: kitFormData.name,
                        description: kitFormData.description
                    })
                    .select()
                    .single();
                if (insertError) throw insertError;
                kitId = newKit.id;
            }

            if (kitFormData.items.length > 0) {
                const kitItemsToInsert = kitFormData.items.map(ki => ({
                    kit_id: kitId,
                    item_id: ki.item_id,
                    quantity: ki.quantity,
                    is_optional: ki.is_optional
                }));

                const { error: itemsError } = await supabase
                    .from('inventory_kit_items')
                    .insert(kitItemsToInsert);
                if (itemsError) throw itemsError;
            }

            showToast(editingKit ? 'Kit actualizado' : 'Kit creado correctamente');
            setIsModalOpen(false);
            loadData();
        } catch (error: any) {
            console.error(error);
            showToast('Error al guardar: ' + error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteKit = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta plantilla de kit?')) return;
        try {
            const { error } = await supabase.from('inventory_kits').delete().eq('id', id);
            if (error) throw error;
            showToast('Kit eliminado');
            loadData();
        } catch (error: any) {
            showToast('Error al eliminar kit', 'error');
        }
    };

    const filteredKits = kits.filter(k =>
        k.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg"><LayoutGrid size={20} className="text-primary" /></div>
                        <span className="text-[10px] font-black uppercase text-primary tracking-widest">Configuración / Inventario</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-foreground uppercase leading-none">Plantillas de Kits</h1>
                    <p className="text-muted-foreground font-medium max-w-md">Define conjuntos de equipos y materiales para entregas rápidas a técnicos.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group min-w-[300px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar plantillas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-card border-2 border-border rounded-2xl py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-primary transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="px-6 py-3 bg-primary text-white text-xs font-black uppercase rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Plus size={18} /> Nuevo Kit
                    </button>
                </div>
            </div>

            {/* Kits Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredKits.length === 0 ? (
                    <div className="col-span-full py-24 text-center space-y-4 bg-muted/5 border-2 border-dashed border-border rounded-[3rem]">
                        <Package className="w-16 h-16 text-muted-foreground/20 mx-auto" />
                        <p className="text-lg font-black uppercase text-muted-foreground">No hay plantillas creadas</p>
                        <button onClick={() => openModal()} className="text-primary font-black uppercase text-xs hover:underline">Crear la primera ahora</button>
                    </div>
                ) : (
                    filteredKits.map(kit => (
                        <div key={kit.id} className="relative group overflow-hidden bg-card border-2 border-border p-8 rounded-[2.5rem] hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 transition-all">
                            <div className="flex justify-between items-start mb-6">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors">{kit.name}</h3>
                                    <p className="text-xs font-bold text-muted-foreground line-clamp-1 uppercase tracking-wider">{kit.description || 'Sin descripción'}</p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openModal(kit)} className="p-2 text-muted-foreground hover:text-primary transition-colors"><Edit size={18} /></button>
                                    <button onClick={() => handleDeleteKit(kit.id)} className="p-2 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {kit.inventory_kit_items.slice(0, 3).map((ki: any) => (
                                    <div key={ki.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground">
                                                {ki.quantity}x
                                            </div>
                                            <span className="text-[11px] font-black uppercase text-foreground truncate max-w-[150px]">
                                                {ki.inventory_items?.name}
                                            </span>
                                        </div>
                                        {ki.is_optional && <span className="text-[8px] font-black bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">Opcional</span>}
                                    </div>
                                ))}
                                {kit.inventory_kit_items.length > 3 && (
                                    <p className="text-[10px] font-bold text-primary uppercase text-center pt-2">+{kit.inventory_kit_items.length - 3} ítems más</p>
                                )}
                            </div>

                            <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/10 transition-colors"></div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal de Kit */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingKit ? "Editar Plantilla" : "Nueva Plantilla de Kit"}
            >
                <form onSubmit={handleSaveKit} className="space-y-8 max-h-[80vh] overflow-y-auto px-4 py-2 custom-scrollbar">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nombre del Kit</label>
                            <input
                                required
                                value={kitFormData.name}
                                onChange={e => setKitFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="EJ: KIT INSTALACIÓN FTTH ESTÁNDAR"
                                className="w-full bg-muted/30 border-2 border-border rounded-2xl p-4 text-sm font-bold outline-none focus:border-primary transition-all uppercase"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Descripción</label>
                            <textarea
                                value={kitFormData.description}
                                onChange={e => setKitFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Descripción opcional del uso de este kit..."
                                className="w-full bg-muted/30 border-2 border-border rounded-2xl p-4 text-sm font-medium outline-none focus:border-primary transition-all min-h-[100px]"
                            />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <Box size={16} /> Ítems Incluidos
                            </h3>
                            <div className="relative">
                                <select
                                    onChange={(e) => {
                                        const item = items.find(i => i.id === e.target.value);
                                        if (item) addItemToKit(item);
                                        e.target.value = "";
                                    }}
                                    className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-primary outline-none appearance-none cursor-pointer pr-8 hover:bg-primary/10"
                                >
                                    <option value="">Añadir Ítem...</option>
                                    {items.filter(i => !kitFormData.items.find(ki => ki.item_id === i.id)).map(i => (
                                        <option key={i.id} value={i.id}>{i.name} ({i.model_name})</option>
                                    ))}
                                </select>
                                <PlusCircle size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-primary pointer-events-none" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            {kitFormData.items.length === 0 ? (
                                <div className="py-12 border-2 border-dashed border-border rounded-[2rem] text-center">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">No has añadido productos a este kit</p>
                                </div>
                            ) : (
                                kitFormData.items.map((ki) => (
                                    <div key={ki.item_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/20 border-2 border-border rounded-2xl gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-card border border-border rounded-xl">
                                                <Package size={20} className="text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black uppercase text-foreground">{ki.item?.name}</p>
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase">{ki.item?.model_name}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <label className="text-[8px] font-black uppercase text-muted-foreground">Cant:</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={ki.quantity}
                                                    onChange={e => updateKitItem(ki.item_id, 'quantity', parseInt(e.target.value) || 1)}
                                                    className="w-16 bg-card border border-border rounded-lg p-2 text-xs font-black text-center outline-none"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => updateKitItem(ki.item_id, 'is_optional', !ki.is_optional)}
                                                className={clsx(
                                                    "px-3 py-1.5 rounded-lg text-[8px] font-black uppercase border transition-all",
                                                    ki.is_optional ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-muted-foreground hover:border-primary/40"
                                                )}
                                            >
                                                {ki.is_optional ? 'Opcional' : 'Requerido'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeItemFromKit(ki.item_id)}
                                                className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex gap-4 pt-8 border-t border-border">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-8 py-4 bg-muted text-muted-foreground text-xs font-black uppercase rounded-2xl hover:bg-muted/80 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || kitFormData.items.length === 0}
                            className="flex-1 py-4 bg-primary text-white text-xs font-black uppercase rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            {editingKit ? 'Actualizar Plantilla' : 'Guardar Nueva Plantilla'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
