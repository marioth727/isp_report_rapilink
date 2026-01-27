import { useState, useEffect } from 'react';
import {
    Truck,
    History,
    Search,
    Package,
    CheckCircle2,
    Loader2,
    ShieldAlert,
    ExternalLink,
    Camera
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AssetHistoryModal } from '../components/operations/AssetHistoryModal';
import { Modal } from '../components/ui/Modal';
import clsx from 'clsx';

export default function InventoryRMA() {
    const [assets, setAssets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // History Modal
    const [selectedAssetForHistory, setSelectedAssetForHistory] = useState<any>(null);

    // Warranty Modal
    const [isWarrantyModalOpen, setIsWarrantyModalOpen] = useState(false);

    useEffect(() => {
        loadDefectiveAssets();
    }, []);

    const loadDefectiveAssets = async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('inventory_assets')
                .select('*, inventory_items(*), inventory_movements!last_movement_id(defect_details, evidence_url)')
                .in('status', ['defective', 'on_warranty'])
                .order('created_at', { ascending: false });

            if (data) setAssets(data);
        } catch (error) {
            console.error('Error loading RMA data:', error);
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        window.dispatchEvent(new CustomEvent('app:toast', {
            detail: { message, type }
        }));
    };

    const handleSendToWarranty = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (selectedAssets.length === 0) return;

        setIsSaving(true);
        const formData = new FormData(e.currentTarget);
        const ticketNumber = formData.get('ticket_number') as string;
        const providerNotes = formData.get('provider_notes') as string;

        try {
            const updatePromises = selectedAssets.map(async (id) => {
                // 1. Create movement
                const { data: moveData, error: moveError } = await supabase
                    .from('inventory_movements')
                    .insert({
                        asset_id: id,
                        movement_type: 'rma_return',
                        notes: `Enviado a garantía. Ticket: ${ticketNumber}. Notas: ${providerNotes}`,
                    })
                    .select()
                    .single();

                if (moveError) throw moveError;

                // 2. Update asset status
                const { error: assetError } = await supabase
                    .from('inventory_assets')
                    .update({
                        status: 'on_warranty',
                        last_movement_id: moveData.id
                    })
                    .eq('id', id);

                if (assetError) throw assetError;
            });

            await Promise.all(updatePromises);

            showToast(`${selectedAssets.length} equipos marcados como en garantía`, 'success');
            setIsWarrantyModalOpen(false);
            setSelectedAssets([]);
            loadDefectiveAssets();
        } catch (error: any) {
            console.error(error);
            showToast('Error al procesar: ' + error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredAssets = assets.filter(a =>
        a.serial_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.inventory_items?.name.toLowerCase().includes(searchQuery.toLowerCase())
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
                        <div className="p-2 bg-red-500/10 rounded-lg"><ShieldAlert size={20} className="text-red-500" /></div>
                        <span className="text-[10px] font-black uppercase text-red-500 tracking-widest">Almacén de Fallas / RMA</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-foreground uppercase leading-none">Gestión de Garantías</h1>
                    <p className="text-muted-foreground font-medium max-w-md">Control de equipos dañados y seguimiento de retornos a fábrica.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group min-w-[300px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por S/N o Modelo..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-card border-2 border-border rounded-2xl py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-primary transition-all shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Selection Toolbar */}
            {selectedAssets.length > 0 && (
                <div className="bg-foreground text-background p-4 rounded-3xl flex items-center justify-between shadow-2xl animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-4 ml-4">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center font-black text-xs text-white">
                            {selectedAssets.length}
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest">Equipos seleccionados para garantía</p>
                    </div>
                    <button
                        onClick={() => setIsWarrantyModalOpen(true)}
                        className="px-6 py-3 bg-primary text-white text-[10px] font-black uppercase rounded-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
                    >
                        <Truck size={14} /> Despachar a Garantía
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6">
                {filteredAssets.length === 0 ? (
                    <div className="py-24 text-center space-y-4 bg-muted/5 border-2 border-dashed border-border rounded-[3rem]">
                        <Package className="w-16 h-16 text-muted-foreground/20 mx-auto" />
                        <p className="text-lg font-black uppercase text-muted-foreground">No hay equipos reportados en falla</p>
                    </div>
                ) : (
                    <div className="bg-card border-2 border-border rounded-[2.5rem] overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/30 border-b border-border">
                                    <th className="px-8 py-5 text-[10px] font-black uppercase text-muted-foreground tracking-widest w-12 text-center">
                                        <input
                                            type="checkbox"
                                            className="rounded border-border text-primary cursor-pointer"
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedAssets(filteredAssets.map(a => a.id));
                                                else setSelectedAssets([]);
                                            }}
                                            checked={selectedAssets.length === filteredAssets.length && filteredAssets.length > 0}
                                        />
                                    </th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Equipo / Serial</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Estado de RMA</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Detalle del Fallo</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase text-muted-foreground tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredAssets.map(asset => (
                                    <tr key={asset.id} className={clsx(
                                        "hover:bg-muted/20 transition-colors group",
                                        selectedAssets.includes(asset.id) && "bg-primary/[0.03]"
                                    )}>
                                        <td className="px-8 py-5 text-center">
                                            <input
                                                type="checkbox"
                                                className="rounded border-border text-primary cursor-pointer"
                                                checked={selectedAssets.includes(asset.id)}
                                                onChange={() => {
                                                    setSelectedAssets(prev =>
                                                        prev.includes(asset.id) ? prev.filter(id => id !== asset.id) : [...prev, asset.id]
                                                    );
                                                }}
                                            />
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center relative">
                                                    <Package className="w-5 h-5 text-muted-foreground" />
                                                    {asset.inventory_movements?.[0]?.evidence_url && (
                                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center border-2 border-card">
                                                            <Camera size={8} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-black uppercase text-sm tracking-tight">{asset.serial_number}</p>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{asset.inventory_items?.name}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={clsx(
                                                "px-3 py-1 text-[10px] font-black uppercase rounded-full border",
                                                asset.status === 'defective' ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                            )}>
                                                {asset.status === 'defective' ? 'Reportado en Falla' : 'En Garantía'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-xs font-medium text-muted-foreground line-clamp-2 max-w-xs uppercase italic">
                                                {asset.inventory_movements?.[0]?.defect_details || 'Sin detalles registrados'}
                                            </p>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {asset.inventory_movements?.[0]?.evidence_url && (
                                                    <a
                                                        href={asset.inventory_movements[0].evidence_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-muted-foreground hover:text-primary transition-colors"
                                                        title="Ver Foto de Evidencia"
                                                    >
                                                        <ExternalLink size={18} />
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => setSelectedAssetForHistory(asset)}
                                                    className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                                                    title="Ver Timeline"
                                                >
                                                    <History size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Warranty Dispatch Modal */}
            <Modal
                isOpen={isWarrantyModalOpen}
                onClose={() => setIsWarrantyModalOpen(false)}
                title="Despachar a Garantía"
            >
                <form onSubmit={handleSendToWarranty} className="space-y-6">
                    <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-2">
                        <p className="text-[10px] font-black text-primary uppercase">Carga de Lote</p>
                        <p className="text-sm font-bold text-foreground">Estás procesando {selectedAssets.length} equipos para envío a proveedor.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Número de Ticket / Caso Provider</label>
                        <input
                            name="ticket_number"
                            required
                            placeholder="EJ: RMA-2024-001"
                            className="w-full bg-muted/30 border-2 border-border rounded-xl p-3 text-sm font-black focus:border-primary outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Notas Adicionales (Proveedor)</label>
                        <textarea
                            name="provider_notes"
                            placeholder="Instrucciones del proveedor, fecha de guía, etc..."
                            className="w-full bg-muted/30 border-2 border-border rounded-xl p-3 text-sm focus:border-primary outline-none transition-all h-32"
                        />
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsWarrantyModalOpen(false)}
                            className="flex-1 py-4 bg-muted text-muted-foreground text-xs font-black uppercase rounded-2xl hover:bg-muted/80 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 py-4 bg-primary text-white text-xs font-black uppercase rounded-2xl shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Confirmar Envío
                        </button>
                    </div>
                </form>
            </Modal>

            <AssetHistoryModal
                isOpen={!!selectedAssetForHistory}
                onClose={() => setSelectedAssetForHistory(null)}
                assetId={selectedAssetForHistory?.id}
                serialNumber={selectedAssetForHistory?.serial_number}
            />
        </div>
    );
}
