
import { useEffect, useState } from 'react';
import { WisphubService } from '../lib/wisphub';
import {
    Users,
    Clock,
    Trophy,
    Briefcase,
    BarChart3
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

export function TechnicianAnalytics() {
    const [loading, setLoading] = useState(true);
    const [techStats, setTechStats] = useState<any[]>([]);
    const [globalStats, setGlobalStats] = useState({
        total: 0,
        avgSla: 0,
        mostEfficient: 'N/A',
        unassigned: 0
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const tickets = await WisphubService.getAllTickets();
            const grouped = tickets.reduce((acc: any, t: any) => {
                const tech = t.nombre_tecnico || 'Sin Asignar';
                if (!acc[tech]) {
                    acc[tech] = {
                        name: tech,
                        total: 0,
                        critico: 0,
                        amarillo: 0,
                        verde: 0,
                        totalHours: 0
                    };
                }
                acc[tech].total++;
                acc[tech].totalHours += t.horas_abierto;
                if (t.sla_status === 'critico') acc[tech].critico++;
                else if (t.sla_status === 'amarillo') acc[tech].amarillo++;
                else acc[tech].verde++;
                return acc;
            }, {});

            // Separamos tickets con técnico vs sin técnico
            const statsArray = Object.values(grouped).map((s: any) => {
                const efficiency = Math.round((s.verde / s.total) * 100);
                const avgHours = Math.round(s.totalHours / s.total) || 0;
                const volumeMultiplier = Math.log10(s.total + 1);
                const speedBonus = 1000 / (avgHours + 24);
                const weightedScore = (efficiency + speedBonus) * volumeMultiplier;

                return { ...s, avgHours, efficiency, weightedScore };
            });

            // FILTRO CRÍTICO: El Ranking y Mejor Eficiencia solo deben mostrar técnicos humanos
            const competitiveStats = statsArray.filter(s => s.name !== 'Sin Asignar' && s.name !== 'Sin asignar')
                .sort((a: any, b: any) => b.weightedScore - a.weightedScore);

            setTechStats(competitiveStats);

            const totalT = tickets.length;
            const avgH = Math.round(tickets.reduce((sum: number, t: any) => sum + t.horas_abierto, 0) / totalT);

            // Buscar ganador solo entre los competitivos
            const winner = competitiveStats.length > 0
                ? competitiveStats.reduce((prev, current) => (prev.efficiency > current.efficiency) ? prev : current)
                : { name: 'N/A', efficiency: 0 };

            // Calcular cuántos están sin asignar realmente
            const unassignedCount = grouped['Sin Asignar']?.total || grouped['Sin asignar']?.total || 0;

            setGlobalStats({
                total: totalT,
                avgSla: avgH,
                mostEfficient: competitiveStats.length > 0 ? winner.name : 'N/A',
                unassigned: unassignedCount
            });

        } catch (error) {
            console.error("Error loading tech analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground animate-pulse font-black text-lg uppercase tracking-widest">
                Analizando productividad del equipo...
            </p>
        </div>
    );

    return (
        <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
                        <Users className="text-primary" size={36} />
                        Métricas de Técnicos
                    </h1>
                    <p className="text-muted-foreground text-lg font-medium">Análisis de rendimiento y eficiencia operativa</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                            <Briefcase size={24} />
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Carga de Trabajo Global</p>
                    </div>
                    <p className="text-4xl font-black">{globalStats.total}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Tickets activos</span>
                        {globalStats.unassigned > 0 && (
                            <span className="text-[10px] font-black text-orange-500 uppercase bg-orange-500/10 px-2 py-0.5 rounded-full">
                                {globalStats.unassigned} Sin Asignar
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500">
                            <Clock size={24} />
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">SLA Promedio General</p>
                    </div>
                    <p className="text-4xl font-black text-orange-500">{globalStats.avgSla}h</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Tiempo de respuesta medio</p>
                </div>

                <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-green-500/10 rounded-2xl text-green-500">
                            <Trophy size={24} />
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Mejor Eficiencia SLA</p>
                    </div>
                    <p className="text-4xl font-black text-green-500 truncate">{globalStats.mostEfficient}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Líder en cumplimiento de tiempos</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-card p-8 rounded-3xl border border-border shadow-sm">
                    <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-8 flex items-center gap-2">
                        <BarChart3 size={18} /> Carga por Técnico
                    </h3>
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={techStats} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} />
                                <XAxis type="number" axisLine={false} tickLine={false} fontSize={10} />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={10} width={120} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="total" fill="#3b82f6" radius={[0, 10, 10, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-border bg-muted/20">
                        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Ranking de Eficiencia</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-muted/50 text-[10px] uppercase text-muted-foreground font-black tracking-widest border-b border-border">
                                <tr>
                                    <th className="p-4 text-center w-16">#</th>
                                    <th className="p-4">Técnico</th>
                                    <th className="p-4 text-center">Eficiencia</th>
                                    <th className="p-4 text-center">Score</th>
                                    <th className="p-4 text-center">Avg. Horas</th>
                                    <th className="p-4 text-center">Tickets</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {techStats.map((tech, idx) => (
                                    <tr key={idx} className="hover:bg-primary/[0.02] transition-colors">
                                        <td className="p-4 text-center">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-yellow-500/20 text-yellow-600' : idx === 1 ? 'bg-slate-300/20 text-slate-600' : idx === 2 ? 'bg-orange-700/10 text-orange-800' : 'text-muted-foreground'}`}>
                                                {idx + 1}
                                            </div>
                                        </td>
                                        <td className="p-4 font-black text-xs uppercase">{tech.name}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-xs font-black ${tech.efficiency > 80 ? 'text-green-500' : tech.efficiency > 50 ? 'text-orange-500' : 'text-red-500'}`}>
                                                    {tech.efficiency}%
                                                </span>
                                                <div className="w-16 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                                                    <div className={`h-full ${tech.efficiency > 80 ? 'bg-green-500' : tech.efficiency > 50 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${tech.efficiency}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="text-xs font-black text-primary" title="(Eficiencia + Velocidad) x Log(Volumen)">{Math.round(tech.weightedScore)}</span>
                                        </td>
                                        <td className="p-4 text-center font-mono font-bold text-xs">{tech.avgHours}h</td>
                                        <td className="p-4 text-center">
                                            <span className="px-2 py-1 bg-secondary rounded-lg text-[10px] font-black">{tech.total}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
