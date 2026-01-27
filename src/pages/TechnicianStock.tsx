import { useState, useEffect } from 'react';
import {
    User,
    Search,
    Truck,
    Package,
    ChevronRight,
    ArrowRightLeft,
    AlertCircle,
    History as HistoryIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AssetHistoryModal } from '../components/operations/AssetHistoryModal';
import clsx from 'clsx';

export default function TechnicianStock() {
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [selectedTech, setSelectedTech] = useState<any>(null);
    const [techAssets, setTechAssets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAssetForHistory, setSelectedAssetForHistory] = useState<any>(null);

    useEffect(() => {
        loadTechnicians();
    }, []);

    const loadTechnicians = async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('is_field_tech', true)
                .order('full_name');

            if (data) {
                // Fetch counts separately to avoid complex joins issues in some Supabase versions
                const techWithCounts = await Promise.all(data.map(async (t) => {
                    const { count } = await supabase
                        .from('inventory_assets')
                        .select('*', { count: 'exact', head: true })
                        .eq('current_holder_id', t.id);
                    return { ...t, assets_count: count || 0 };
                }));
                setTechnicians(techWithCounts);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadTechAssets = async (tech: any) => {
        setSelectedTech(tech);
        const { data } = await supabase
            .from('inventory_assets')
            .select('*, inventory_items(*)')
            .eq('current_holder_id', tech.id);

        if (data) setTechAssets(data);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Stock por Técnico</h1>
                <p className="text-muted-foreground font-medium">Supervisión y auditoría de materiales en vehículos.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            placeholder="Buscar técnico..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-card border-2 border-border rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-primary/50 transition-all font-medium"
                        />
                    </div>

                    <div className="bg-card border-2 border-border rounded-[2rem] overflow-hidden shadow-sm">
                        <div className="divide-y divide-border">
                            {technicians
                                .filter(t => t.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map((tech) => (
                                    <button
                                        key={tech.id}
                                        onClick={() => loadTechAssets(tech)}
                                        className={clsx(
                                            "w-full p-6 flex items-center justify-between hover:bg-muted/30 transition-all text-left group",
                                            selectedTech?.id === tech.id ? "bg-primary/[0.03] border-l-4 border-primary" : ""
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center border border-border group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                <User className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black uppercase tracking-tight">{tech.full_name}</p>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">
                                                    {tech.assets_count || 0} Activos asignados
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className={clsx(
                                            "w-5 h-5 text-muted-foreground transition-all",
                                            selectedTech?.id === tech.id ? "text-primary translate-x-1" : ""
                                        )} />
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                    {selectedTech ? (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-3">
                                    <Truck className="text-primary" />
                                    Equipos de {selectedTech.full_name}
                                </h2>
                                <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-[10px] font-black uppercase hover:bg-muted transition-all">
                                    <ArrowRightLeft className="w-4 h-4" /> Auditar Carga
                                </button>
                            </div>

                            {techAssets.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {techAssets.map((asset) => (
                                        <div
                                            key={asset.id}
                                            onClick={() => setSelectedAssetForHistory(asset)}
                                            className="bg-card border-2 border-border p-5 rounded-3xl hover:border-primary/50 hover:bg-primary/[0.02] transition-all group shadow-sm cursor-pointer relative overflow-hidden"
                                        >
                                            <div className="flex justify-between items-start mb-4 relative z-10">
                                                <div className="p-3 bg-primary/5 rounded-2xl text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                                    <Package className="w-5 h-5" />
                                                </div>
                                                <span className="text-[10px] font-black uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                                    {asset.status}
                                                </span>
                                            </div>
                                            <div className="space-y-1 relative z-10">
                                                <p className="text-[10px] font-black text-muted-foreground uppercase">{asset.inventory_items?.name}</p>
                                                <p className="text-lg font-black uppercase leading-tight group-hover:text-primary transition-colors">{asset.serial_number}</p>
                                                <p className="text-xs font-bold text-muted-foreground tracking-widest leading-none">SKU: {asset.inventory_items?.sku}</p>
                                            </div>
                                            <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                                <HistoryIcon className="w-24 h-24" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-64 flex flex-col justify-center items-center text-center space-y-2 bg-muted/20 border-2 border-dashed border-border rounded-[2rem] opacity-50">
                                    <AlertCircle className="w-12 h-12" />
                                    <p className="text-xs font-black uppercase tracking-widest">El técnico no posee materiales asignados</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col justify-center items-center text-center space-y-4 p-20 bg-muted/10 border-2 border-dashed border-border rounded-[3rem] opacity-30">
                            <User className="w-20 h-20" />
                            <p className="text-sm font-black uppercase tracking-[0.2em]">Selecciona un técnico para auditar su stock</p>
                        </div>
                    )}
                </div>
            </div>

            <AssetHistoryModal
                isOpen={!!selectedAssetForHistory}
                onClose={() => setSelectedAssetForHistory(null)}
                assetId={selectedAssetForHistory?.id}
                serialNumber={selectedAssetForHistory?.serial_number}
            />
        </div>
    );
}
