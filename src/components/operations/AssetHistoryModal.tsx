import { useState, useEffect } from 'react';
import {
    Calendar,
    ArrowRight,
    Package,
    Truck,
    UserCheck,
    History,
    Loader2,
    History as HistoryIcon,
    Camera
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import clsx from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AssetHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    assetId: string;
    serialNumber: string;
}

export function AssetHistoryModal({ isOpen, onClose, assetId, serialNumber }: AssetHistoryModalProps) {
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && assetId) {
            loadHistory();
        }
    }, [isOpen, assetId]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('inventory_movements')
                .select(`
                    *,
                    origin:profiles!origin_holder_id(full_name),
                    destination:profiles!destination_holder_id(full_name)
                `)
                .eq('asset_id', assetId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMovements(data || []);
        } catch (error) {
            console.error('Error loading asset history:', error);
        } finally {
            setLoading(false);
        }
    };

    const getMovementIcon = (type: string) => {
        switch (type) {
            case 'entry': return <Package className="w-5 h-5" />;
            case 'transfer': return <Truck className="w-5 h-5" />;
            case 'installation': return <UserCheck className="w-5 h-5" />;
            case 'recovery': return <HistoryIcon className="w-5 h-5" />;
            default: return <ArrowRight className="w-5 h-5" />;
        }
    };

    const getMovementColor = (type: string) => {
        switch (type) {
            case 'entry': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
            case 'transfer': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
            case 'installation': return 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20';
            case 'recovery': return 'text-red-500 bg-red-500/10 border-red-500/20';
            default: return 'text-primary bg-primary/10 border-primary/20';
        }
    };

    const getMovementTitle = (type: string) => {
        switch (type) {
            case 'entry': return 'Ingreso a Almacén';
            case 'transfer': return 'Asignación / Traspaso';
            case 'installation': return 'Instalación en Cliente';
            case 'recovery': return 'Recuperación de Equipo';
            default: return type.toUpperCase();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Historial de Vida: ${serialNumber}`}
        >
            <div className="space-y-8 max-h-[70vh] overflow-y-auto px-2 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        <p className="text-xs font-black uppercase text-muted-foreground tracking-widest">Reconstruyendo línea de tiempo...</p>
                    </div>
                ) : movements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4 opacity-50">
                        <History className="w-16 h-16 text-muted-foreground" />
                        <p className="text-xs font-black uppercase text-muted-foreground tracking-widest">No hay movimientos registrados para este equipo</p>
                    </div>
                ) : (
                    <div className="relative pl-8 space-y-12 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                        {movements.map((move, idx) => (
                            <div key={move.id} className="relative animate-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                                {/* Timeline Dot/Icon */}
                                <div className={clsx(
                                    "absolute -left-[31px] top-0 w-10 h-10 rounded-2xl border-2 flex items-center justify-center z-10 shadow-sm",
                                    getMovementColor(move.movement_type)
                                )}>
                                    {getMovementIcon(move.movement_type)}
                                </div>

                                <div className="space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <h4 className="text-sm font-black uppercase tracking-tight text-foreground">
                                            {getMovementTitle(move.movement_type)}
                                        </h4>
                                        <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase bg-muted/30 px-3 py-1 rounded-full border border-border">
                                            <Calendar className="w-3 h-3" />
                                            {move.created_at && format(new Date(move.created_at), "d 'de' MMMM, yyyy HH:mm", { locale: es })}
                                        </div>
                                    </div>

                                    <div className="bg-card border border-border rounded-2xl p-4 space-y-4 shadow-sm group hover:border-primary/30 transition-all">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {move.origin && (
                                                <div>
                                                    <p className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1">Entregó</p>
                                                    <p className="text-xs font-bold uppercase">{move.origin.full_name}</p>
                                                </div>
                                            )}
                                            {move.destination && (
                                                <div>
                                                    <p className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1">Recibió</p>
                                                    <p className="text-xs font-bold uppercase">{move.destination.full_name}</p>
                                                </div>
                                            )}
                                            {move.client_reference && (
                                                <div className="sm:col-span-2">
                                                    <p className="text-[9px] font-black uppercase text-primary leading-none mb-1">Cliente / Referencia</p>
                                                    <p className="text-xs font-bold uppercase">{move.client_reference}</p>
                                                </div>
                                            )}
                                        </div>

                                        {move.notes && (
                                            <div className="pt-3 border-t border-border/50">
                                                <p className="text-[10px] text-muted-foreground italic font-medium">"{move.notes}"</p>
                                            </div>
                                        )}

                                        {move.evidence_url && (
                                            <div className="pt-3">
                                                <button
                                                    onClick={() => window.open(move.evidence_url, '_blank')}
                                                    className="flex items-center gap-2 text-[10px] font-black uppercase text-primary hover:underline"
                                                >
                                                    <Camera className="w-3 h-3" /> Ver Evidencia Fotográfica
                                                </button>
                                                <div className="mt-2 w-full h-32 rounded-xl border border-border overflow-hidden bg-muted group-hover:border-primary/20 transition-all">
                                                    <img src={move.evidence_url} alt="Evidencia" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-8">
                <button
                    onClick={onClose}
                    className="px-8 py-3 bg-muted rounded-xl text-xs font-black uppercase hover:bg-muted/80 transition-all"
                >
                    Cerrar Historial
                </button>
            </div>
        </Modal>
    );
}
