import { useState, useEffect } from 'react';
import {
    TrendingUp,
    Users,
    Package,
    Loader2,
    DollarSign,
    Zap,
    AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getConsumptionAdvancedStats, type ConsumptionStat } from '../lib/inventoryAnalytics';
import clsx from 'clsx';

interface InternalStats {
    totalInstalled: number;
    totalValue: number;
    avgPerTech: number;
    rmaRate: number;
}

interface TechRank {
    name: string;
    count: number;
    qty: number;
}

interface CategoryRank {
    name: string;
    count: number;
}

export default function InventoryAnalytics() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<InternalStats>({
        totalInstalled: 0,
        totalValue: 0,
        avgPerTech: 0,
        rmaRate: 0
    });
    const [advancedStats, setAdvancedStats] = useState<ConsumptionStat[]>([]);
    const [totalUniqueTickets, setTotalUniqueTickets] = useState(0);
    const [materialRanking, setMaterialRanking] = useState<{ name: string, qty: number }[]>([]);
    const [categorySummary, setCategorySummary] = useState<Record<string, { units: number, tickets: number }>>({});
    const [technicianTicketCount, setTechnicianTicketCount] = useState<Record<string, number>>({});
    const [ticketConsumption, setTicketConsumption] = useState<Record<string, {
        ticketId: string;
        technicianName: string;
        date: string;
        category: string;
        materials: { name: string; qty: number }[];
    }>>({});
    const [timeRange, setTimeRange] = useState('30'); // days
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

    // Pagination and Modal State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;
    const [selectedTicket, setSelectedTicket] = useState<{
        ticketId: string;
        technicianName: string;
        date: string;
        category: string;
        materials: { name: string; qty: number }[];
    } | null>(null);

    useEffect(() => {
        loadAnalytics();
    }, [timeRange, selectedCategory]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            // 1. Load Advanced Stats from the new service
            const response = await getConsumptionAdvancedStats(parseInt(timeRange));
            setAdvancedStats(response.stats);
            setTotalUniqueTickets(response.totalUniqueTickets);
            setMaterialRanking(response.materialRanking);
            setCategorySummary(response.categorySummary);
            setTechnicianTicketCount(response.technicianTicketCount);
            setTicketConsumption(response.ticketConsumption);

            // 2. Load basic legacy stats for KPIs
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(timeRange));
            const startDateStr = startDate.toISOString();

            const { data: movements } = await supabase
                .from('inventory_movements')
                .select('*, inventory_assets!asset_id!inner(inventory_items(unit_cost))')
                .in('movement_type', ['installation', 'CONSUMO'])
                .gte('created_at', startDateStr);

            if (movements) {
                const totalInstalled = movements.length;
                const movementsList = (movements as any[]);
                const totalValue = movementsList.reduce((acc, curr) => acc + (curr.inventory_assets?.inventory_items?.unit_cost || 0), 0);

                const techSet = new Set(movementsList.map(m => m.origin_holder_id));
                const uniqueTechs = techSet.size;

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
                    avgPerTech: uniqueTechs > 0 ? totalInstalled / uniqueTechs : 0,
                    rmaRate: totalAssets ? (defectiveCount || 0) / totalAssets * 100 : 0
                });
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter advanced stats by selected category
    const filteredStats = selectedCategory === 'ALL'
        ? advancedStats
        : advancedStats.filter(s => s.category === selectedCategory);

    // Group by technician for ranking
    const techRankingRaw = filteredStats.reduce((acc: any, curr: ConsumptionStat) => {
        if (!acc[curr.technicianId]) acc[curr.technicianId] = {
            name: curr.technicianName,
            count: technicianTicketCount[curr.technicianId] || 0, // REAL count from service mapping
            qty: 0
        };
        acc[curr.technicianId].qty += curr.totalQuantity;
        return acc;
    }, {});

    const techRanking: TechRank[] = (Object.values(techRankingRaw) as TechRank[]).sort((a, b) => b.qty - a.qty);

    // Group by Category Pulse (Units)
    const categoryPulseRaw = advancedStats.reduce((acc: any, curr: ConsumptionStat) => {
        if (!acc[curr.category]) acc[curr.category] = { name: curr.category, count: 0 };
        acc[curr.category].count += curr.totalQuantity;
        return acc;
    }, {});

    const categoryPulse: CategoryRank[] = (Object.values(categoryPulseRaw) as CategoryRank[]).sort((a, b) => b.count - a.count);

    // Efficiency Alerts (Consumption > Average per item in that category)
    const itemAverages: any = advancedStats.reduce((acc: any, curr: ConsumptionStat) => {
        const key = `${curr.category}-${curr.itemName}`;
        if (!acc[key]) acc[key] = { total: 0, count: 0 };
        acc[key].total += curr.totalQuantity;
        acc[key].count += curr.ticketCount;
        return acc;
    }, {});

    const alerts = filteredStats.filter(s => {
        const avgData = itemAverages[`${s.category}-${s.itemName}`];
        if (!avgData || avgData.count === 0) return false;
        const avg = avgData.total / avgData.count;
        return s.avgPerTicket > avg * 1.25; // 25% deviation
    }).sort((a, b) => b.avgPerTicket - a.avgPerTicket);

    // Sort all ticket consumption by date descending
    const allRecentTickets = Object.values(ticketConsumption)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Pagination slicing
    const totalPages = Math.ceil(allRecentTickets.length / ITEMS_PER_PAGE);
    const paginatedTickets = allRecentTickets.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    if (loading && advancedStats.length === 0) {
        return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    const firstTechQty = techRanking.length > 0 ? techRanking[0].qty : 1;
    const totalConsumptionQty = advancedStats.reduce((a, c) => a + c.totalQuantity, 0);

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-20">
            {/* Header */}
            <div className="bg-card border-2 border-border p-8 rounded-[3rem] shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-xl"><TrendingUp size={20} className="text-primary" /></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Intelligence Hub</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-foreground uppercase leading-none">Análisis de Consumo</h1>
                    <p className="text-muted-foreground font-medium mt-2">Monitoreo de eficiencia de materiales por técnico y ticket.</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 relative z-10">
                    <div className="flex bg-muted p-1.5 rounded-2xl border-2 border-border">
                        {[
                            { label: 'Todas', value: 'ALL' },
                            { label: 'Mantenimiento', value: 'CORRECTIVO' },
                            { label: 'Instalaciones', value: 'INSTALACION' }
                        ].map(cat => (
                            <button
                                key={cat.value}
                                onClick={() => setSelectedCategory(cat.value)}
                                className={clsx(
                                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all",
                                    selectedCategory === cat.value ? "bg-card text-primary shadow-lg ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex bg-primary/5 p-1.5 rounded-2xl border-2 border-primary/20">
                        {[
                            { label: '7D', value: '7' },
                            { label: '30D', value: '30' },
                            { label: '90D', value: '90' }
                        ].map(range => (
                            <button
                                key={range.value}
                                onClick={() => setTimeRange(range.value)}
                                className={clsx(
                                    "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all",
                                    timeRange === range.value ? "bg-primary text-white shadow-lg" : "text-primary hover:bg-primary/10"
                                )}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-[80px]"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/5 rounded-full -ml-24 -mb-24 blur-[60px]"></div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border-2 border-border p-6 rounded-[2.5rem] space-y-4 hover:border-primary/50 transition-colors group shadow-sm">
                    <div className="p-3 bg-primary/10 text-primary w-fit rounded-2xl group-hover:bg-primary group-hover:text-white transition-all">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Movimientos</p>
                        <h3 className="text-3xl font-black text-foreground">{stats.totalInstalled} <span className="text-xs text-muted-foreground font-bold italic ml-2">en {totalUniqueTickets} tickets</span></h3>
                    </div>
                </div>

                <div className="bg-card border-2 border-border p-6 rounded-[2.5rem] space-y-4 hover:border-emerald-500/50 transition-colors group shadow-sm">
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 w-fit rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-all">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Valorización</p>
                        <h3 className="text-3xl font-black text-foreground">${stats.totalValue.toLocaleString()}</h3>
                    </div>
                </div>

                <div className="bg-card border-2 border-border p-6 rounded-[2.5rem] space-y-4 hover:border-indigo-500/50 transition-colors group shadow-sm">
                    <div className="p-3 bg-indigo-500/10 text-indigo-500 w-fit rounded-2xl group-hover:bg-indigo-500 group-hover:text-white transition-all">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Promedio / Técnico</p>
                        <h3 className="text-3xl font-black text-foreground">{stats.avgPerTech.toFixed(1)}</h3>
                    </div>
                </div>

                <div className="bg-card border-2 border-border p-6 rounded-[2.5rem] space-y-4 hover:border-red-500/50 transition-colors group shadow-sm">
                    <div className="p-3 bg-red-500/10 text-red-500 w-fit rounded-2xl group-hover:bg-red-500 group-hover:text-white transition-all">
                        <Zap size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Alertas de Eficiencia</p>
                        <h3 className="text-3xl font-black text-foreground">{alerts.length}</h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Ranking de Técnicos */}
                <div className="bg-card border-2 border-border rounded-[2.5rem] p-8 space-y-8 flex flex-col shadow-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-3">
                            <Users size={18} className="text-primary" /> Ranking Técnicos (Units)
                        </h3>
                    </div>
                    <div className="space-y-6 flex-1">
                        {techRanking.length > 0 ? techRanking.slice(0, 5).map((tech, idx) => (
                            <div key={idx} className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <p className="text-[11px] font-black uppercase tracking-tight">{tech.name}</p>
                                    <p className="text-[10px] font-black text-primary">{tech.qty} Unidades</p>
                                </div>
                                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden border border-border/50">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${(tech.qty / firstTechQty) * 100}%` }}
                                    />
                                </div>
                                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{tech.count} Tickets</p>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground/30">
                                <Package size={40} className="mb-4" />
                                <p className="text-xs font-black uppercase">Sin datos</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Ranking de Materiales (NEW) */}
                <div className="bg-card border-2 border-border rounded-[2.5rem] p-8 space-y-8 flex flex-col shadow-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-3">
                            <Package size={18} className="text-indigo-500" /> Top Materiales Consumidos
                        </h3>
                    </div>
                    <div className="space-y-5 flex-1">
                        {materialRanking.length > 0 ? materialRanking.slice(0, 5).map((mat, idx) => (
                            <div key={idx} className="p-4 bg-muted/20 border-2 border-border/50 rounded-2xl flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-card border border-border rounded-xl flex items-center justify-center text-indigo-500">
                                        <span className="text-[10px] font-black">{idx + 1}</span>
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-tight truncate max-w-[150px]">{mat.name}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-black text-foreground">{mat.qty}</p>
                                    <p className="text-[8px] font-black text-muted-foreground uppercase">Unidades</p>
                                </div>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground/30">
                                <Package size={40} className="mb-4" />
                                <p className="text-xs font-black uppercase">Sin datos</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Efficiency Table / High Deviations */}
                <div className="bg-card border-2 border-border rounded-[2.5rem] p-8 space-y-8 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-3">
                            <AlertCircle size={18} className="text-red-500" /> Desviaciones Críticas
                        </h3>
                        <span className="px-2 py-1 bg-red-500/10 text-red-500 text-[8px] font-black uppercase rounded-lg">Filtro Activo</span>
                    </div>

                    <div className="space-y-4">
                        {alerts.length > 0 ? alerts.slice(0, 6).map((item, idx) => {
                            const avgData = itemAverages[`${item.category}-${item.itemName}`];
                            const avgValue = avgData.total / avgData.count;
                            const diff = ((item.avgPerTicket - avgValue) / avgValue) * 100;

                            return (
                                <div key={idx} className="p-5 bg-muted/20 border-2 border-border/50 rounded-3xl flex items-center justify-between group hover:border-red-500/30 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-card border border-border rounded-2xl flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                                            <AlertCircle size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-[11px] font-black uppercase tracking-tight">{item.itemName}</h4>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase">{item.technicianName}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-red-500">+{diff.toFixed(0)}%</p>
                                        <p className="text-[8px] font-black text-muted-foreground uppercase italic">{item.avgPerTicket.toFixed(1)} vs {avgValue.toFixed(1)} prom.</p>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="flex flex-col items-center justify-center py-20 text-emerald-500/30">
                                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                                    <Zap size={32} />
                                </div>
                                <p className="text-xs font-black uppercase tracking-widest">Consumo Optimizizado</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Detailed Categories Breakdown */}
            <div className="bg-card border-2 border-border rounded-[3rem] p-10 space-y-8 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl"><Package size={24} /></div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Distribución por Categoría</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {categoryPulse.map((cat, idx) => {
                        const summary = categorySummary[cat.name] || { units: 0, tickets: 0 };
                        return (
                            <div key={idx} className="p-8 bg-muted/30 border-2 border-border/60 rounded-[2.5rem] flex flex-col justify-between hover:border-primary/40 transition-all">
                                <div>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{cat.name}</p>
                                    <h4 className="text-4xl font-black text-foreground">{cat.count} <span className="text-xs text-muted-foreground font-bold">UNDS</span></h4>
                                </div>
                                <div className="mt-6 pt-6 border-t border-border/50 flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Participación</span>
                                        <span className="text-xs font-black text-indigo-500">
                                            {totalConsumptionQty > 0 ? ((cat.count / totalConsumptionQty) * 100).toFixed(0) : 0}%
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Tickets Relacionados</span>
                                        <span className="text-xs font-black text-primary">
                                            {summary.tickets} tickets
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Consolidado de Materiales por Ticket */}
            <div className="bg-card border-2 border-border rounded-[3rem] p-10 space-y-8 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 text-primary rounded-2xl"><Package size={24} /></div>
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight">Consumo Detallado por Ticket</h3>
                        <p className="text-xs text-muted-foreground font-medium mt-1">Haga clic en 'Ver Detalles' para información exacta de materiales usados.</p>
                    </div>
                </div>

                {paginatedTickets.length > 0 ? (
                    <div className="space-y-6">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-border/50">
                                        <th className="py-4 px-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">ID Ticket</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Técnico</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap md:table-cell hidden">Categoría</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Fecha</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right whitespace-nowrap">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedTickets.map((ticket, idx) => (
                                        <tr key={idx} className="border-b border-border/30 hover:bg-muted/20 transition-colors group">
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                <span className="text-xs font-black px-3 py-1 bg-primary/10 text-primary rounded-lg uppercase tracking-widest">#{ticket.ticketId}</span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="text-sm font-black text-foreground">{ticket.technicianName}</span>
                                            </td>
                                            <td className="py-4 px-4 md:table-cell hidden">
                                                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{ticket.category}</span>
                                            </td>
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                <span className="text-[10px] font-black text-muted-foreground uppercase">{new Date(ticket.date).toLocaleDateString()}</span>
                                            </td>
                                            <td className="py-4 px-4 text-right whitespace-nowrap">
                                                <button
                                                    onClick={() => setSelectedTicket(ticket)}
                                                    className="px-4 py-2 bg-background border-2 border-border rounded-xl text-[10px] font-black uppercase text-primary hover:border-primary/50 hover:bg-primary/5 transition-all w-full md:w-auto"
                                                >
                                                    Ver Detalles
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex flex-col md:flex-row items-center justify-between pt-6 border-t-2 border-border/50 gap-4">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                    Página <span className="text-foreground">{currentPage}</span> de <span className="text-foreground">{totalPages}</span>
                                </span>
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="flex-1 md:flex-none px-4 py-2 bg-muted/50 rounded-xl text-[10px] font-black uppercase disabled:opacity-50 hover:bg-muted transition-colors"
                                    >
                                        Anterior
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="flex-1 md:flex-none px-4 py-2 bg-muted/50 rounded-xl text-[10px] font-black uppercase disabled:opacity-50 hover:bg-muted transition-colors"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/30">
                        <div className="w-16 h-16 bg-muted/10 rounded-full flex items-center justify-center mb-4 border-2 border-border/50">
                            <Package size={32} />
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest">No hay datos de consumo recientes</p>
                    </div>
                )}
            </div>

            {/* Modal de Detalles de Ticket */}
            {selectedTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in transition-all">
                    {/* Background overlay click to close */}
                    <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedTicket(null)}></div>

                    <div className="relative z-10 w-full max-w-sm bg-card border-2 border-border rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <span className="text-sm font-black px-4 py-1.5 bg-primary/10 text-primary rounded-xl uppercase tracking-widest">#{selectedTicket.ticketId}</span>
                                <p className="text-[11px] font-black uppercase text-muted-foreground tracking-widest mt-3">{selectedTicket.category}</p>
                            </div>
                            <span className="text-[11px] font-black text-muted-foreground uppercase">{new Date(selectedTicket.date).toLocaleDateString()}</span>
                        </div>

                        <h4 className="text-lg font-black text-foreground mb-6">{selectedTicket.technicianName}</h4>

                        <div className="space-y-3 mb-8 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {selectedTicket.materials.map((mat, mIdx) => (
                                <div key={mIdx} className="flex justify-between items-center bg-muted/30 p-3 rounded-2xl border border-border/50">
                                    <span className="text-xs font-bold text-foreground line-clamp-2 pr-4">{mat.name}</span>
                                    <span className="text-sm font-black text-primary bg-primary/10 px-3 py-1 rounded-lg shrink-0">x{mat.qty}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setSelectedTicket(null)}
                            className="w-full py-3.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                        >
                            Cerrar Detalles
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
