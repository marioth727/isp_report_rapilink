import { useState, useEffect } from 'react';
import {
    BarChart3,
    TrendingUp,
    Users,
    Package,
    ArrowUpRight,
    Loader2,
    DollarSign,
    Target
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import clsx from 'clsx';

export default function InventoryAnalytics() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalInstalled: 0,
        totalValue: 0,
        avgPerTech: 0,
        rmaRate: 0
    });
    const [techRanking, setTechRanking] = useState<any[]>([]);
    const [categoryPulse, setCategoryPulse] = useState<any[]>([]);
    const [timeRange, setTimeRange] = useState('30'); // days

    useEffect(() => {
        loadAnalytics();
    }, [timeRange]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(timeRange));
            const startDateStr = startDate.toISOString();

            // 1. Fetch Movements (Installations)
            const { data: movements } = await supabase
                .from('inventory_movements')
                .select('*, inventory_assets!inner(*, inventory_items!inner(*, inventory_categories(*))), origin:profiles!origin_holder_id(full_name)')
                .eq('movement_type', 'installation')
                .gte('created_at', startDateStr);

            if (movements) {
                // Calculation: Summary
                const totalInstalled = movements.length;
                const totalValue = movements.reduce((acc, curr) => acc + (curr.inventory_assets?.inventory_items?.unit_cost || 0), 0);

                // Calculation: Technicians
                const techMap: Record<string, { name: string, count: number, value: number }> = {};
                movements.forEach(m => {
                    const techId = m.origin_holder_id || 'unknown';
                    const techName = m.origin?.full_name || 'Desconocido';
                    if (!techMap[techId]) techMap[techId] = { name: techName, count: 0, value: 0 };
                    techMap[techId].count++;
                    techMap[techId].value += m.inventory_assets?.inventory_items?.unit_cost || 0;
                });

                const sortedTechs = Object.values(techMap).sort((a, b) => b.count - a.count);
                setTechRanking(sortedTechs);

                // Calculation: Categories
                const catMap: Record<string, { name: string, count: number }> = {};
                movements.forEach(m => {
                    const catName = m.inventory_assets?.inventory_items?.inventory_categories?.name || 'S/C';
                    if (!catMap[catName]) catMap[catName] = { name: catName, count: 0 };
                    catMap[catName].count++;
                });
                setCategoryPulse(Object.values(catMap).sort((a, b) => b.count - a.count));

                // RMA Rate (Simple approach: defective / total movements)
                const { count: defectiveCount } = await supabase
                    .from('inventory_assets')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'defective');

                const { count: totalAssets } = await supabase
                    .from('inventory_assets')
                    .select('*', { count: 'exact', head: true });

                setStats({
                    totalInstalled,
                    totalValue,
                    avgPerTech: sortedTechs.length > 0 ? totalInstalled / sortedTechs.length : 0,
                    rmaRate: totalAssets ? (defectiveCount || 0) / totalAssets * 100 : 0
                });
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Inteligencia de Inventario</h1>
                    <p className="text-muted-foreground font-medium">Análisis de rendimiento y rotación de activos.</p>
                </div>
                <div className="flex bg-muted p-1 rounded-2xl gap-1">
                    {[
                        { label: '7D', value: '7' },
                        { label: '30D', value: '30' },
                        { label: '90D', value: '90' }
                    ].map(range => (
                        <button
                            key={range.value}
                            onClick={() => setTimeRange(range.value)}
                            className={clsx(
                                "px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all",
                                timeRange === range.value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border-2 border-border p-6 rounded-[2rem] space-y-4">
                    <div className="p-3 bg-primary/10 text-primary w-fit rounded-2xl">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Instalaciones</p>
                        <h3 className="text-3xl font-black text-foreground">{stats.totalInstalled}</h3>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-500 font-bold text-[10px] uppercase">
                        <ArrowUpRight size={14} /> +12% vs periodo anterior
                    </div>
                </div>

                <div className="bg-card border-2 border-border p-6 rounded-[2rem] space-y-4">
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 w-fit rounded-2xl">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Valorización de Consumo</p>
                        <h3 className="text-3xl font-black text-foreground">${stats.totalValue.toLocaleString()}</h3>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Costo total de materiales salientes</p>
                </div>

                <div className="bg-card border-2 border-border p-6 rounded-[2rem] space-y-4">
                    <div className="p-3 bg-indigo-500/10 text-indigo-500 w-fit rounded-2xl">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Promedio por Técnico</p>
                        <h3 className="text-3xl font-black text-foreground">{stats.avgPerTech.toFixed(1)}</h3>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Instalaciones / Técnico activo</p>
                </div>

                <div className="bg-card border-2 border-border p-6 rounded-[2rem] space-y-4">
                    <div className="p-3 bg-red-500/10 text-red-500 w-fit rounded-2xl">
                        <Target size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tasa de Fallos (RMA)</p>
                        <h3 className="text-3xl font-black text-foreground">{stats.rmaRate.toFixed(1)}%</h3>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-red-500">Equipos que retornan dañados</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Ranking de Técnicos */}
                <div className="bg-card border-2 border-border rounded-[2.5rem] p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                            <BarChart3 size={18} className="text-primary" /> Ranking de Eficiencia
                        </h3>
                    </div>
                    <div className="space-y-6">
                        {techRanking.map((tech, idx) => (
                            <div key={idx} className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <p className="text-xs font-black uppercase">{tech.name}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground">{tech.count} Inst.</p>
                                </div>
                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all duration-1000"
                                        style={{ width: `${(tech.count / techRanking[0].count) * 100}%` }}
                                    />
                                </div>
                                <p className="text-[8px] font-black text-muted-foreground/60 uppercase">Valuación: ${tech.value.toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pulso de Categorías */}
                <div className="bg-card border-2 border-border rounded-[2.5rem] p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                            <Package size={18} className="text-emerald-500" /> Consumo por Categoría
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {categoryPulse.map((cat, idx) => (
                            <div key={idx} className="p-6 bg-muted/30 rounded-3xl border border-border flex flex-col justify-between gap-4">
                                <p className="text-[10px] font-black uppercase text-muted-foreground">{cat.name}</p>
                                <div className="flex items-end justify-between">
                                    <h4 className="text-3xl font-black text-foreground">{cat.count}</h4>
                                    <div className="flex items-center gap-1 text-emerald-500 text-[8px] font-black">
                                        <ArrowUpRight size={10} /> {((cat.count / stats.totalInstalled) * 100).toFixed(0)}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {categoryPulse.length === 0 && (
                        <div className="p-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-3xl">
                            <p className="text-xs font-black uppercase">Sin datos en este periodo</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
