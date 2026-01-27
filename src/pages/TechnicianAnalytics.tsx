import { useEffect, useState } from 'react';
import {
    Users,
    Clock,
    Trophy,
    Briefcase,
    BarChart3,
    FileDown,
    RefreshCcw
} from 'lucide-react';
import { WorkflowService } from '../lib/workflowService';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis
} from 'recharts';

export function TechnicianAnalytics() {
    const [loading, setLoading] = useState(true);
    const [loadProgress, setLoadProgress] = useState({ current: 0, total: 0 });
    const [techStats, setTechStats] = useState<any[]>([]);
    const [globalStats, setGlobalStats] = useState<any>({
        total: 0,
        avgSla: 0,
        mostEfficient: 'N/A',
        unassigned: 0,
        trends: { total: 0, avgSla: 0 }
    });
    const [selectedTech, setSelectedTech] = useState<any>(null);
    const [typeFilter, setTypeFilter] = useState<'all' | 'field' | 'office'>('all');
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const init = async () => {
            await loadData(); // Carga inicial desde Supabase
            handleBackgroundSync(); // Sincronización en segundo plano
        };
        init();
    }, []);

    const handleBackgroundSync = async () => {
        setIsSyncing(true);
        try {
            await WorkflowService.syncGlobalTickets(30, (current, total) => {
                setLoadProgress({ current, total });
            });
            await loadData(); // Recargar después de sync
        } finally {
            setIsSyncing(false);
        }
    };

    const loadData = async () => {
        // No bloqueamos la UI con setLoading(true) si ya tenemos datos (SWR)
        if (techStats.length === 0) setLoading(true);

        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

            // 1. Obtener datos de los últimos 60 días
            const { data: processes, error } = await supabase
                .from('workflow_processes')
                .select('metadata, created_at')
                .gte('created_at', startOfPrevMonth);

            if (error) throw error;

            const tickets = (processes || []).map(p => p.metadata).filter(Boolean);

            if (tickets.length === 0 && !isSyncing) {
                // Si no hay nada, pero no estamos sincronizando, quizá es la primera vez
                return;
            }

            // 2. Obtener perfiles para mapear técnicos reales e is_field_tech
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, wisphub_id, is_field_tech');

            const techProfileMap = (profiles || []).reduce((acc: any, p: any) => {
                const key = (p.full_name || '').toLowerCase().trim();
                acc[key] = p;
                return acc;
            }, {});

            const grouped = tickets.reduce((acc: any, t: any) => {
                const tech = t.tecnico || t.nombre_tecnico || 'Sin Asignar';
                if (!acc[tech]) {
                    acc[tech] = {
                        name: tech,
                        total: 0,
                        resolved: 0,
                        open: 0,
                        verde: 0,
                        amarillo: 0,
                        critico: 0,
                        totalHours: 0
                    };
                }

                acc[tech].total++;
                acc[tech].totalHours += Number(t.horas_abierto || 0);

                // Track subjects for specialty detection
                const subject = t.asunto || 'Otros';
                if (!acc[tech].subjects) acc[tech].subjects = {};
                acc[tech].subjects[subject] = (acc[tech].subjects[subject] || 0) + 1;

                const statusId = Number(t.id_estado);
                if (statusId === 3 || statusId === 4) { // 3 = Resuelto, 4 = Cerrado
                    acc[tech].resolved++;

                    // First Contact Resolution (Simulated: if horas_abierto < 4)
                    if (Number(t.horas_abierto) < 4) {
                        acc[tech].fcrCount = (acc[tech].fcrCount || 0) + 1;
                    }
                } else {
                    acc[tech].open++;
                }

                if (t.sla_status === 'critico') acc[tech].critico++;
                else if (t.sla_status === 'amarillo') acc[tech].amarillo++;
                else acc[tech].verde++;

                return acc;
            }, {});

            // Separamos tickets con técnico vs sin técnico
            const statsArray = Object.values(grouped).map((s: any) => {
                const resolutionRate = s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0;
                const efficiency = Math.round((s.verde / s.total * 100)) || 0;
                const avgHours = Math.round(s.totalHours / s.total) || 0;
                const fcrRate = s.total > 0 ? Math.round(((s.fcrCount || 0) / s.total) * 100) : 0;

                // Specialty detection & Profile Mapping
                const profile = techProfileMap[s.name.toLowerCase().trim()];
                const isField = profile?.is_field_tech || false;

                let topSubject = 'Generalista';
                let maxCount = 0;
                if (s.subjects) {
                    Object.entries(s.subjects).forEach(([subj, count]: [string, any]) => {
                        if (count > maxCount) {
                            maxCount = count;
                            topSubject = subj;
                        }
                    });
                }

                // Weighted Score (Complex)
                const resScore = resolutionRate * 0.4;
                const slaScore = efficiency * 0.3;
                const fcrScore = fcrRate * 0.2;

                // Bonus for volume & Field Effort
                const volumeFactor = Math.min(1.2, s.total / 20);
                const effortMultiplier = isField ? 1.5 : 1.0;

                const weightedScore = Math.round((resScore + slaScore + fcrScore) * volumeFactor * effortMultiplier);

                // Radar Data
                const radarData = [
                    { subject: 'Velocidad', A: Math.min(100, Math.max(0, 100 - (avgHours * 2))), fullMark: 100 },
                    { subject: 'Calidad (SLA)', A: efficiency, fullMark: 100 },
                    { subject: 'Volumen', A: Math.min(100, (s.total / 30) * 100), fullMark: 100 },
                    { subject: 'Resolución', A: resolutionRate, fullMark: 100 },
                    { subject: 'Respuesta 1h', A: fcrRate, fullMark: 100 }
                ];

                return {
                    ...s,
                    resolutionRate,
                    efficiency,
                    weightedScore,
                    avgHours,
                    fcrRate,
                    specialty: topSubject,
                    isField,
                    radarData
                };
            });

            // FILTRO CRÍTICO
            const competitiveStats = statsArray.filter(s =>
                s.name !== 'Sin Asignar' &&
                s.name !== 'Sin asignar' &&
                s.name !== ''
            ).sort((a: any, b: any) => b.weightedScore - a.weightedScore);

            setTechStats(competitiveStats);

            if (!selectedTech && competitiveStats.length > 0) {
                setSelectedTech(competitiveStats[0]);
            }

            if (tickets.length > 0) {
                const totalT = tickets.length;
                const avgH = Math.round(tickets.reduce((sum: number, t: any) => sum + (t.horas_abierto || 0), 0) / totalT);
                const winner = competitiveStats.length > 0 ? competitiveStats[0] : { name: 'N/A' };
                const unassignedCount = grouped['Sin Asignar']?.total || grouped['Sin asignar']?.total || 0;

                // Trend calculation
                const prevMonthTickets = (processes || []).filter(p => p.created_at < startOfMonth).map(p => p.metadata).filter(Boolean);
                const prevTotal = prevMonthTickets.length;
                const prevAvgH = prevTotal > 0 ? Math.round(prevMonthTickets.reduce((sum: number, t: any) => sum + (t.horas_abierto || 0), 0) / prevTotal) : avgH;

                const trendTotal = prevTotal > 0 ? Math.round(((totalT - prevTotal) / prevTotal) * 100) : 0;
                const trendSla = prevAvgH > 0 ? Math.round(((avgH - prevAvgH) / prevAvgH) * 100) : 0;

                setGlobalStats({
                    total: totalT,
                    avgSla: avgH,
                    mostEfficient: winner.name,
                    unassigned: unassignedCount,
                    trends: { total: trendTotal, avgSla: trendSla }
                });
            }

        } catch (error) {
            console.error("Error loading tech analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        if (!techStats.length) return;

        const data = techStats.map((s, idx) => ({
            Ranking: idx + 1,
            Nombre: s.name,
            Tickets_Mes: s.total,
            Resueltos: s.resolved,
            Abiertos: s.open,
            Eficiencia_SLA: `${s.efficiency}%`,
            Promedio_Horas: s.avgHours,
            Score_Integral: s.weightedScore,
            Verde: s.verde,
            Amarillo: s.amarillo,
            Critico: s.critico
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Productividad Técnicos");
        XLSX.writeFile(wb, `Ranking_Productividad_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
            <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-center space-y-2">
                <p className="text-muted-foreground animate-pulse font-black text-lg uppercase tracking-widest">
                    {loadProgress.total > 0 ? `Cargando ${loadProgress.current} de ${loadProgress.total} tickets...` : 'Iniciando análisis...'}
                </p>
                {loadProgress.total > 0 && (
                    <div className="w-64 h-2 bg-muted rounded-full mx-auto overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-300 ease-out"
                            style={{ width: `${(loadProgress.current / loadProgress.total) * 100}%` }}
                        ></div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <Users className="text-blue-900" size={24} />
                        Métricas de Técnicos (Mes Actual)
                    </h1>
                    <div className="flex items-center gap-3 mt-1">
                        <p className="text-slate-500 text-sm font-medium">Análisis de productividad mensual ({new Date().toLocaleString('es-ES', { month: 'long' })})</p>
                        {isSyncing && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full animate-pulse">
                                <RefreshCcw size={10} className="animate-spin text-blue-700" />
                                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">
                                    {loadProgress.total > 0 ? `Sincronizando ${loadProgress.current}/${loadProgress.total}` : 'Sincronizando...'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mr-2">
                        <button
                            onClick={() => setTypeFilter('all')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${typeFilter === 'all' ? 'bg-white text-blue-900 shadow-sm border border-blue-100' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setTypeFilter('field')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${typeFilter === 'field' ? 'bg-white text-blue-900 shadow-sm border border-blue-100' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            🚜 Campo
                        </button>
                        <button
                            onClick={() => setTypeFilter('office')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${typeFilter === 'office' ? 'bg-white text-blue-900 shadow-sm border border-blue-100' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            🏢 Oficina
                        </button>
                    </div>
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-bold text-xs shadow-sm hover:shadow"
                    >
                        <FileDown size={14} />
                        Excel
                    </button>
                    <button
                        onClick={handleBackgroundSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-xl hover:bg-blue-950 transition-all font-bold text-xs shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-blue-900/20"
                    >
                        <BarChart3 size={14} />
                        {isSyncing ? 'Sinc' : 'Sync'}
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-slate-50 rounded-2xl text-blue-900 border border-slate-100">
                            <Briefcase size={20} />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Carga de Trabajo Global</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <p className="text-3xl font-bold text-slate-900">{globalStats.total}</p>
                        {globalStats.trends.total !== 0 && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${globalStats.trends.total > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                {globalStats.trends.total > 0 ? '↑' : '↓'} {Math.abs(globalStats.trends.total)}%
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Tickets activos</span>
                        {globalStats.unassigned > 0 && (
                            <span className="text-[10px] font-bold text-orange-600 uppercase bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                                {globalStats.unassigned} Sin Asignar
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-slate-50 rounded-2xl text-blue-900 border border-slate-100">
                            <Clock size={20} />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">SLA Promedio General</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <p className="text-3xl font-bold text-slate-900">{globalStats.avgSla}h</p>
                        {globalStats.trends.avgSla !== 0 && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${globalStats.trends.avgSla < 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                {globalStats.trends.avgSla < 0 ? '↓' : '↑'} {Math.abs(globalStats.trends.avgSla)}%
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Tiempo de respuesta medio</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-slate-50 rounded-2xl text-blue-900 border border-slate-100">
                            <Trophy size={20} />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Mejor Eficiencia SLA</p>
                    </div>
                    <p className="text-3xl font-bold text-slate-900 truncate">{globalStats.mostEfficient}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Líder Integral (Calidad + Volumen)</p>
                </div>
            </div>

            {selectedTech && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom duration-500">
                    <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-md flex flex-col md:flex-row gap-8 items-center">
                        <div className="flex-1 w-full h-[350px]">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Competencias de {selectedTech.name}</h3>
                                {selectedTech.isField && (
                                    <span className="text-[9px] font-bold bg-blue-900 text-white px-2 py-0.5 rounded-md uppercase tracking-tighter shadow-sm shadow-blue-900/20">🚜 Campo (Multip. x1.5)</span>
                                )}
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={selectedTech.radarData}>
                                    <PolarGrid stroke="#e2e8f0" strokeOpacity={0.8} />
                                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    <Radar
                                        name={selectedTech.name}
                                        dataKey="A"
                                        stroke="#1e3a8a"
                                        strokeWidth={2}
                                        fill="#1e40af"
                                        fillOpacity={0.2}
                                        animationBegin={200}
                                        animationDuration={1500}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            fontSize: '10px',
                                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                        }}
                                        itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-6 w-full">
                            <div>
                                <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-2">Especialidad Detectada</h4>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-900 border border-blue-100 rounded-xl">
                                    <Trophy size={16} />
                                    <span className="text-sm font-bold uppercase">{selectedTech.specialty}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">FCR Rate</p>
                                    <p className="text-xl font-bold text-slate-900">{selectedTech.fcrRate}%</p>
                                    <p className="text-[8px] font-medium text-slate-400">Resolución &lt; 4h</p>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Prom. Respuesta</p>
                                    <p className="text-xl font-bold text-slate-900">{selectedTech.avgHours}h</p>
                                    <p className="text-[8px] font-medium text-slate-400">Tiempo de cierre</p>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Análisis de Desempeño</p>
                                <p className="text-xs font-medium text-slate-700 leading-relaxed">
                                    {selectedTech.name} demuestra un desempeño <span className="font-bold text-blue-900">{selectedTech.weightedScore > 80 ? 'EXCEPCIONAL' : selectedTech.weightedScore > 60 ? 'SÓLIDO' : 'ESTÁNDAR'}</span>.
                                    Su enfoque principal es <span className="text-blue-900 font-bold uppercase">{selectedTech.specialty}</span> con una tasa de resolución del {selectedTech.resolutionRate}%.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-md">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Badges de Logro</h3>
                        <div className="space-y-4">
                            {selectedTech.weightedScore > 75 && (
                                <div className="flex items-center gap-4 p-4 bg-white border border-yellow-200 rounded-2xl shadow-sm">
                                    <div className="p-2 bg-yellow-100 text-yellow-600 rounded-xl"><Trophy size={18} /></div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-yellow-700">SLA Master</p>
                                        <p className="text-xs font-medium text-slate-600">Líder en calidad de servicio</p>
                                    </div>
                                </div>
                            )}
                            {selectedTech.total > 15 && (
                                <div className="flex items-center gap-4 p-4 bg-white border border-blue-200 rounded-2xl shadow-sm">
                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><Briefcase size={18} /></div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-blue-700">Máxima Carga</p>
                                        <p className="text-xs font-medium text-slate-600">Mayor volumen de tickets atendidos</p>
                                    </div>
                                </div>
                            )}
                            {selectedTech.fcrRate > 40 && (
                                <div className="flex items-center gap-4 p-4 bg-white border border-orange-200 rounded-2xl shadow-sm">
                                    <div className="p-2 bg-orange-100 text-orange-600 rounded-xl"><Clock size={18} /></div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-orange-700">Resolutor Veloz</p>
                                        <p className="text-xs font-medium text-slate-600">Alta tasa de solución inmediata</p>
                                    </div>
                                </div>
                            )}
                            {selectedTech.fcrRate <= 40 && selectedTech.weightedScore <= 75 && selectedTech.total <= 15 && (
                                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Sin insignias este periodo</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-8 flex items-center gap-2">
                        <BarChart3 size={16} /> Carga por Técnico ({typeFilter === 'all' ? 'Todos' : typeFilter === 'field' ? 'Campo' : 'Oficina'})
                    </h3>
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={techStats.filter(t =>
                                    typeFilter === 'all' ? true :
                                        typeFilter === 'field' ? t.isField : !t.isField
                                )}
                                layout="vertical"
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} stroke="#000" />
                                <XAxis type="number" axisLine={false} tickLine={false} fontSize={10} tick={{ fill: '#64748b' }} />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={10} width={120} tick={{ fill: '#0f172a', fontWeight: 'bold' }} />
                                <Tooltip
                                    cursor={{ fill: 'currentColor', opacity: 0.05 }}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                />
                                <Bar
                                    dataKey="total"
                                    fill="#1e3a8a"
                                    radius={[0, 4, 4, 0]}
                                    animationBegin={300}
                                    animationDuration={2000}
                                    barSize={20}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Ranking de Eficiencia</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white text-[10px] uppercase text-slate-400 font-bold tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="p-4 text-center w-16">#</th>
                                    <th className="p-4">Técnico</th>
                                    <th className="p-4 text-center">Resolución</th>
                                    <th className="p-4 text-center">Score</th>
                                    <th className="p-4 text-center">FCR</th>
                                    <th className="p-4 text-center">SLA</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {techStats
                                    .filter(t =>
                                        typeFilter === 'all' ? true :
                                            typeFilter === 'field' ? t.isField : !t.isField
                                    )
                                    .map((tech, idx) => (
                                        <tr
                                            key={idx}
                                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedTech?.name === tech.name ? 'bg-slate-50' : ''}`}
                                            onClick={() => setSelectedTech(tech)}
                                        >
                                            <td className="p-4 text-center">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-slate-200 text-slate-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'text-slate-400'}`}>
                                                    {idx + 1}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-xs uppercase text-slate-900">{tech.name}</span>
                                                        {tech.isField && (
                                                            <span title="Técnico de Campo" className="text-[10px] grayscale opacity-50">🚜</span>
                                                        )}
                                                    </div>
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase bg-slate-100 px-1.5 py-0.5 rounded w-fit mt-1 border border-slate-200">{tech.specialty}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className={`text-xs font-bold ${tech.resolutionRate > 80 ? 'text-emerald-600' : tech.resolutionRate > 50 ? 'text-orange-600' : 'text-red-600'}`}>
                                                        {tech.resolved}/{tech.total}
                                                    </span>
                                                    <span className="text-[8px] font-medium text-slate-400 uppercase">{tech.resolutionRate}%</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="text-xs font-black text-slate-900">{Math.round(tech.weightedScore)}</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="text-xs font-bold text-blue-600">{tech.fcrRate}%</span>
                                            </td>
                                            <td className="p-4 text-center font-mono font-bold text-xs text-emerald-600">{tech.verde}</td>
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
