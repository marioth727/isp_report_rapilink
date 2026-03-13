import { useState, useEffect } from 'react';
import {
    History,
    Search,
    ArrowDownLeft,
    ArrowUpRight,
    RefreshCw,
    User,
    Package,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Loader2,
    FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import clsx from 'clsx';

interface Movement {
    id: string;
    created_at: string;
    movement_type: string;
    quantity: number;
    notes: string | null;
    asset_id: string;
    asset_serial: string | null;
    item_name: string | null;
    origin_name: string | null;
    destination_name: string | null;
    creator_name: string | null;
}

export default function InventoryMovements() {
    const [movements, setMovements] = useState<Movement[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [limit] = useState(50);
    const [offset, setOffset] = useState(0);

    const movementTypes = [
        { id: 'all', label: 'Todos', color: 'bg-muted text-muted-foreground' },
        { id: 'entry', label: 'Entradas', color: 'bg-emerald-100 text-emerald-700', icon: <ArrowDownLeft size={14} /> },
        { id: 'assignment', label: 'Asignaciones', color: 'bg-blue-100 text-blue-700', icon: <ArrowUpRight size={14} /> },
        { id: 'return', label: 'Devoluciones', color: 'bg-amber-100 text-amber-700', icon: <RefreshCw size={14} /> },
        { id: 'installation', label: 'Instalaciones', color: 'bg-indigo-100 text-indigo-700', icon: <FileText size={14} /> },
        { id: 'rma', label: 'RMA / Garantía', color: 'bg-red-100 text-red-700', icon: <RefreshCw size={14} /> }
    ];

    useEffect(() => {
        loadMovements();
    }, [typeFilter, limit, offset, searchTerm]);

    const loadMovements = async () => {
        setLoading(true);
        try {
            // V3: Returns JSON to bypass PostgREST schema cache issues
            const { data, error } = await supabase.rpc('get_kardex_v3', {
                p_limit: limit,
                p_offset: offset,
                p_type: typeFilter,
                p_search: searchTerm
            });

            if (error) throw error;
            // RPC returns JSON, so we cast it directly
            setMovements((data as any) || []);
        } catch (error: any) {
            console.error('Error loading movements:', error.message || error);
        } finally {
            setLoading(false);
        }
    };

    const filteredMovements = movements;

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('es-CO', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTypeConfig = (type: string) => {
        if (type === 'transfer') return movementTypes.find(t => t.id === 'assignment') || movementTypes[0];
        if (type === 'CONSUMO') return movementTypes.find(t => t.id === 'installation') || movementTypes[0];
        return movementTypes.find(t => t.id === type) || movementTypes[0];
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-20 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-primary/10 text-primary rounded-[2rem] shadow-sm">
                        <History size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-foreground uppercase leading-none">Kardex / Registro (v5 JSON)</h1>
                        <p className="text-muted-foreground font-medium mt-1">Historial completo de movimientos de inventario.</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {movementTypes.map(t => (
                        <button
                            key={t.id}
                            onClick={() => { setTypeFilter(t.id); setOffset(0); }}
                            className={clsx(
                                "px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border-2",
                                typeFilter === t.id
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-transparent bg-muted text-muted-foreground hover:bg-muted/80"
                            )}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-card border-2 border-border p-6 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                    <input
                        type="text"
                        placeholder="BUSCAR POR NOMBRE, SERIAL O NOTA..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-muted/30 border-2 border-transparent focus:border-primary/30 rounded-2xl outline-none font-bold placeholder:text-muted-foreground/30 transition-all uppercase text-sm"
                    />
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <button
                        onClick={() => loadMovements()}
                        className="p-4 bg-primary text-white rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                    >
                        <RefreshCw size={20} className={clsx(loading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-card border-2 border-border rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/20 border-b-2 border-border">
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Fecha / Usuario</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Tipo / Acción</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Ítem / Serial</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center">Cant.</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Trazabilidad (Origen → Destino)</th>
                                <th className="px-6 py-5 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Observaciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading && movements.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                                        <p className="text-sm font-black uppercase text-muted-foreground">Cargando movimientos...</p>
                                    </td>
                                </tr>
                            ) : filteredMovements.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <Package className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                                        <p className="text-sm font-black uppercase text-muted-foreground">No se encontraron movimientos.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredMovements.map((m) => {
                                    const config = getTypeConfig(m.movement_type);
                                    return (
                                        <tr key={m.id} className="hover:bg-muted/5 transition-colors group">
                                            <td className="px-6 py-6 border-none whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black uppercase text-foreground flex items-center gap-1.5">
                                                        <Calendar size={12} className="text-muted-foreground" />
                                                        {formatDate(m.created_at)}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5 mt-1">
                                                        <User size={10} />
                                                        {m.creator_name || 'Sistema'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 border-none">
                                                <span className={clsx(
                                                    "px-3 py-1 rounded-lg text-[10px] font-[1000] uppercase inline-flex items-center gap-2",
                                                    config.color
                                                )}>
                                                    {config.icon}
                                                    {config.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-6 border-none">
                                                <div className="flex flex-col max-w-[250px]">
                                                    <span className="text-xs font-[1000] uppercase truncate text-foreground group-hover:text-primary transition-colors">
                                                        {m.item_name}
                                                    </span>
                                                    <span className="text-[10px] font-black text-muted-foreground font-mono mt-0.5">
                                                        {m.asset_serial}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 border-none text-center">
                                                <span className="text-sm font-black text-foreground bg-muted/50 px-2 py-1 rounded-md">
                                                    {m.quantity}
                                                </span>
                                            </td>
                                            <td className="px-6 py-6 border-none">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col text-[10px] font-bold text-muted-foreground uppercase text-right w-24">
                                                        <span>{m.origin_name || 'Bodega'}</span>
                                                    </div>
                                                    <div className="w-8 h-[2px] bg-border relative">
                                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t-2 border-r-2 border-border rotate-45" />
                                                    </div>
                                                    <div className="flex flex-col text-[10px] font-[1000] text-primary uppercase w-24">
                                                        <span>{m.destination_name || 'Bodega'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 border-none">
                                                <p className="text-[10px] font-bold text-muted-foreground leading-relaxed italic max-w-xs">
                                                    {m.notes || '---'}
                                                </p>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-6 bg-muted/10 border-t border-border flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">
                        Mostrando <span className="text-foreground">{movements.length}</span> registros recientes
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={offset === 0}
                            onClick={() => setOffset(Math.max(0, offset - limit))}
                            className="p-3 bg-card border border-border rounded-xl hover:bg-muted transition-all disabled:opacity-30"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            onClick={() => setOffset(offset + limit)}
                            className="p-3 bg-card border border-border rounded-xl hover:bg-muted transition-all"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
