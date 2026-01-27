import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    Plus,
    Trash2,
    GripVertical,
    AlertCircle,
    RefreshCw
} from 'lucide-react';
import clsx from 'clsx';

interface ChecklistItem {
    id: string;
    title: string;
    is_required: boolean;
    order_index: number;
}

export function InstallationChecklistManager() {
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newItemTitle, setNewItemTitle] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchChecklist();
    }, []);

    async function fetchChecklist() {
        setLoading(true);
        const { data, error } = await supabase
            .from('installation_checklists')
            .select('*')
            .order('order_index', { ascending: true });

        if (!error && data) setItems(data);
        setLoading(false);
    }

    async function addItem() {
        if (!newItemTitle.trim()) return;
        setSaving(true);

        const newItem = {
            title: newItemTitle,
            is_required: true,
            order_index: items.length + 1
        };

        const { error } = await supabase
            .from('installation_checklists')
            .insert([newItem]);

        if (!error) {
            setNewItemTitle('');
            await fetchChecklist();
        }
        setSaving(false);
    }

    async function toggleRequired(id: string, currentStatus: boolean) {
        const { error } = await supabase
            .from('installation_checklists')
            .update({ is_required: !currentStatus })
            .eq('id', id);

        if (!error) {
            setItems(items.map(item =>
                item.id === id ? { ...item, is_required: !currentStatus } : item
            ));
        }
    }

    async function removeItem(id: string) {
        const { error } = await supabase
            .from('installation_checklists')
            .delete()
            .eq('id', id);

        if (!error) {
            setItems(items.filter(item => item.id !== id));
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-black uppercase tracking-tight">Checklist de Fotos</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Configura las fotos obligatorias para el técnico</p>
                </div>
                <button
                    onClick={fetchChecklist}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                    <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
                </button>
            </div>

            {/* Formulario Agregar */}
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="Ej: Foto del Router..."
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    className="flex-1 bg-muted/50 border-2 border-border p-4 rounded-xl text-xs font-bold uppercase outline-none focus:border-primary transition-all"
                />
                <button
                    onClick={addItem}
                    disabled={saving || !newItemTitle.trim()}
                    className="px-6 bg-primary text-white rounded-xl font-black uppercase text-[10px] flex items-center gap-2 hover:scale-105 transition-all disabled:opacity-50"
                >
                    <Plus size={16} /> Agregar
                </button>
            </div>

            {/* Lista de Items */}
            <div className="space-y-3">
                {loading && items.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                        <RefreshCw size={32} className="animate-spin opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Cargando requisitos...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="py-12 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <AlertCircle size={32} className="opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No hay fotos configuradas</p>
                    </div>
                ) : (
                    items.map((item) => (
                        <div
                            key={item.id}
                            className="p-4 bg-card border border-border rounded-xl flex items-center justify-between group hover:border-primary/50 transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="text-muted-foreground opacity-30 cursor-grab">
                                    <GripVertical size={16} />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-tight">{item.title}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <button
                                            onClick={() => toggleRequired(item.id, item.is_required)}
                                            className={clsx(
                                                "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border transition-all",
                                                item.is_required
                                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                    : "bg-muted text-muted-foreground border-transparent"
                                            )}
                                        >
                                            {item.is_required ? 'Obligatorio' : 'Opcional'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => removeItem(item.id)}
                                className="p-2 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex gap-4">
                <AlertCircle className="text-amber-500 shrink-0" size={20} />
                <p className="text-[10px] font-bold text-amber-500/80 uppercase leading-relaxed">
                    Los cambios realizados aquí se verán reflejados inmediatamente en la aplicación de todos los técnicos durante el paso de "Registro Fotográfico".
                </p>
            </div>
        </div>
    );
}
