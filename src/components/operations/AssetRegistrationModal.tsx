import { useState, useEffect } from 'react';
import {
    Plus,
    Trash2,
    Save,
    Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';

interface AssetRegistrationProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function AssetRegistrationModal({ isOpen, onClose, onSuccess }: AssetRegistrationProps) {
    const [items, setItems] = useState<any[]>([]);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [serials, setSerials] = useState<string[]>(['']);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadItems();
        }
    }, [isOpen]);

    const loadItems = async () => {
        const { data } = await supabase.from('inventory_items').select('*').order('name');
        if (data) setItems(data);
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const event = new CustomEvent('app:toast', {
            detail: { message, type, duration: 4000 }
        });
        window.dispatchEvent(event);
    };

    const handleAddSerial = () => setSerials([...serials, '']);
    const handleRemoveSerial = (index: number) => setSerials(serials.filter((_, i) => i !== index));
    const handleSerialChange = (index: number, val: string) => {
        const newSerials = [...serials];
        newSerials[index] = val.toUpperCase();
        setSerials(newSerials);
    };

    const handleSave = async () => {
        if (!selectedItemId) return showToast('Selecciona un producto', 'error');
        if (serials.some(s => !s)) return showToast('Completa todos los seriales', 'error');

        setIsSaving(true);
        try {
            const payload = serials.map(sn => ({
                item_id: selectedItemId,
                serial_number: sn,
                status: 'warehouse',
                current_location: 'OFICINA CENTRAL'
            }));

            const { error } = await supabase.from('inventory_assets').insert(payload);
            if (error) {
                if (error.code === '23505') throw new Error('Uno o más seriales ya están registrados');
                throw error;
            }

            showToast(`${serials.length} activos registrados correctamente`, 'success');
            onSuccess();
            onClose();
            setSerials(['']);
        } catch (err: any) {
            showToast(err.message || 'Error al registrar activos', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Entrada de Stock (Seriales)">
            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Seleccionar Producto Maestro</label>
                    <select
                        value={selectedItemId}
                        onChange={(e) => setSelectedItemId(e.target.value)}
                        className="w-full bg-muted/30 border border-border rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                    >
                        <option value="">Seleccionar...</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                    </select>
                </div>

                <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 flex justify-between">
                        Números de Serie (SN)
                        <span>{serials.length} unidades</span>
                    </label>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {serials.map((sn, idx) => (
                            <div key={idx} className="flex gap-2 animate-in slide-in-from-right-2 duration-200">
                                <input
                                    value={sn}
                                    onChange={(e) => handleSerialChange(idx, e.target.value)}
                                    placeholder={`Serial #${idx + 1}`}
                                    className="flex-1 bg-muted/20 border border-border rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary outline-none font-mono"
                                />
                                {serials.length > 1 && (
                                    <button
                                        onClick={() => handleRemoveSerial(idx)}
                                        className="p-3 text-muted-foreground hover:text-red-500 hover:bg-red-500/5 rounded-xl transition-all"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleAddSerial}
                        className="w-full py-3 bg-muted/50 border-2 border-dashed border-border rounded-xl text-xs font-black uppercase text-muted-foreground hover:border-primary/50 hover:text-primary transition-all flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Añadir otro serial
                    </button>
                </div>

                <div className="flex gap-3 pt-4">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-muted rounded-xl text-xs font-black uppercase border border-border"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !selectedItemId}
                        className="flex-1 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Confirmar Entrada
                    </button>
                </div>
            </div>
        </Modal>
    );
}
