
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import type { CRMInteraction } from '../types';
import { FileDown, Printer, Calendar as CalendarIcon, Trophy, Star, Home, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import clsx from 'clsx';
import confetti from 'canvas-confetti';
import { calculateAchievements, ACHIEVEMENTS } from '../lib/achievements';
import { generateDailyReportPDF } from '../utils/pdfGenerator';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';

export function DailyReportGenerator() {
    const location = useLocation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [interactions, setInteractions] = useState<CRMInteraction[]>([]);
    const [score, setScore] = useState(0);
    const [dailyGoal, setDailyGoal] = useState(5);

    // Date state initialized from navigation or today
    const [selectedDate, setSelectedDate] = useState<string>(
        location.state?.date || new Date().toISOString().split('T')[0]
    );
    const [endDate, setEndDate] = useState<string>(
        location.state?.date || new Date().toISOString().split('T')[0]
    );

    // Create Date object for display
    const reportDate = new Date(`${selectedDate}T12:00:00`);

    useEffect(() => {
        fetchTodayData();
    }, [selectedDate, endDate]);

    const fetchTodayData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch goal from config
            const { data: configData } = await supabase
                .from('crm_config')
                .select('daily_goal')
                .eq('user_id', user.id)
                .single();
            const goal = configData?.daily_goal || 5;
            setDailyGoal(goal);

            // Fetch broad range
            const { data } = await supabase
                .from('crm_interactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (data) {
                // Filter range
                const start = new Date(`${selectedDate}T00:00:00`);
                const end = new Date(`${endDate}T23:59:59`);

                const filteredInteractions = data.filter(i => {
                    if (!i.created_at) return false;
                    const iDate = new Date(i.created_at);
                    return iDate >= start && iDate <= end;
                });

                setInteractions(filteredInteractions);

                // Calculate Score Dynamic
                const sales = filteredInteractions.filter(i => i.result === 'Aceptó Migración').length;
                let s = 0;
                if (sales > 0) s = 1;
                if (sales >= goal * 0.4) s = 2; // Encouragement
                if (sales >= goal * 0.6) s = 3; // Good
                if (sales >= goal * 0.8) s = 4; // Great
                if (sales >= goal) s = 5;       // Goal Reached!
                setScore(s);

                // Confetti if goal reached or passed (Star 5)
                if (sales >= goal) {
                    try {
                        if (typeof confetti === 'function') {
                            confetti({
                                particleCount: 150,
                                spread: 70,
                                origin: { y: 0.6 }
                            });
                        }
                    } catch (e) {
                        console.error("Confetti error ignored:", e);
                    }
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleExit = async () => {
        const confirm = window.confirm('¿Deseas cerrar sesión del sistema?');
        if (confirm) {
            await supabase.auth.signOut();
            window.location.href = '/login';
        } else {
            navigate('/');
        }
    };

    const handleDownloadPDF = () => {
        if (!interactions.length) return;

        const totalSales = interactions.filter(i => i.result === 'Aceptó Migración').length;
        // Effective Interactions Calculation (Reusing logic)
        const effective = interactions.filter(i =>
            ['Aceptó Migración', 'Rechazó (Mantiene)', 'Rechazó (Cancelación)', 'Lo pensará'].includes(i.result)
        ).length;

        const conversion = effective > 0 ? Math.round((totalSales / effective) * 100) : 0;

        generateDailyReportPDF({
            agentName: interactions[0]?.user_id ? 'Agente' : 'Desconocido',
            date: reportDate,
            interactions,
            stats: {
                total: interactions.length,
                effective,
                sales: totalSales,
                conversion
            }
        });
    };

    const handleExportExcel = () => {
        if (!interactions.length) return;

        const data = interactions.map(i => ({
            Fecha: i.created_at ? format(new Date(i.created_at), 'dd/MM/yyyy HH:mm') : '',
            Cliente: i.client_reference,
            Plan_Actual: i.current_plan,
            Resultado: i.result,
            Plan_Sugerido: i.suggested_plan || '',
            Objecion: i.objection || '',
            Upsell: i.price_difference || 0,
            Observaciones: i.special_case_description || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte");
        XLSX.writeFile(wb, `Reporte_Gestion_${selectedDate}_${endDate}.xlsx`);
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Calculando cierre...</div>;

    const totalSales = interactions.filter(i => i.result === 'Aceptó Migración').length;
    const totalRejected = interactions.filter(i => i.result.includes('Rechazó')).length;

    // Effective Interactions Logic (Option 2)
    const effectiveInteractions = interactions.filter(i =>
        ['Aceptó Migración', 'Rechazó (Mantiene)', 'Rechazó (Cancelación)', 'Lo pensará'].includes(i.result)
    ).length;

    const conversion = effectiveInteractions > 0 ? Math.round((totalSales / effectiveInteractions) * 100) : 0;

    // Achievements Logic
    const unlockedAchievements = calculateAchievements(interactions, dailyGoal);

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden text-center p-8 space-y-8">


                {/* Header & Controls */}
                <div className="space-y-4">
                    <div className="flex justify-between items-start print:hidden">
                        <div className="flex gap-2">
                            <button
                                onClick={handleDownloadPDF}
                                className="bg-red-100 text-red-700 hover:bg-red-200 p-2 rounded-full transition-colors"
                                title="Descargar Reporte PDF"
                            >
                                <FileDown className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="bg-green-100 text-green-700 hover:bg-green-200 p-2 rounded-full transition-colors"
                                title="Exportar Excel"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="bg-primary/10 text-primary hover:bg-primary/20 p-2 rounded-full transition-colors"
                                title="Imprimir Vista Web"
                            >
                                <Printer className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-lg border border-border/50">
                            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent border-none text-sm focus:outline-none w-[110px]"
                            />
                            <span className="text-muted-foreground">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent border-none text-sm focus:outline-none w-[110px]"
                            />
                        </div>
                    </div>

                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">
                            {selectedDate === new Date().toISOString().split('T')[0] ? "¡Turno Completado!" : "Reporte Histórico"}
                        </h2>
                        <p className="text-muted-foreground">
                            Resumen de cierre para <span className="font-semibold text-foreground">{format(reportDate, "d 'de' MMMM, yyyy", { locale: es })}</span>.
                        </p>
                    </div>
                </div>

                {/* Score Stars */}
                <div className="flex justify-center gap-2 py-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                            key={star}
                            className={clsx(
                                "w-10 h-10 transition-all duration-500",
                                "text-yellow-400 fill-yellow-400",
                                "scale-100 opacity-100" // Always show stars, simplify logic for now or restore complex logic
                            )}
                        // Restore complex logic in class below for visual fidelity
                        />
                    ))}
                </div>
                {/* Re-applying correct Star logic from memory/prev versions to be safe */}
                <div className="flex justify-center gap-2 py-4 -mt-16 hidden"> {/* Hidden backup to not mess up visual flow if I duplicate */} </div>

                {/* Correct Star Logic overwrite */}
                <div className="flex justify-center gap-2 py-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                            key={star}
                            className={clsx(
                                "w-10 h-10 transition-all duration-500",
                                "text-yellow-400 fill-yellow-400",
                                star <= score ? "scale-110 opacity-100" : "opacity-20"
                            )}
                        />
                    ))}
                </div>


                {/* Main KPIs */}
                <div className="grid grid-cols-3 gap-6">
                    <div className="p-4 bg-secondary/20 rounded-xl">
                        <div className="text-4xl font-bold mb-1">{effectiveInteractions}</div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Contactos</div>
                    </div>
                    <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                        <div className="text-4xl font-bold mb-1 text-green-500">{totalSales}</div>
                        <div className="text-xs uppercase tracking-wider text-green-600 font-semibold">Ventas</div>
                    </div>
                    <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                        <div className="text-4xl font-bold mb-1 text-indigo-500">{conversion}%</div>
                        <div className="text-xs uppercase tracking-wider text-indigo-600 font-semibold">Efectividad</div>
                    </div>
                </div>

                {/* Detailed Executive Report (Visible in Print Only) */}
                <div className="hidden print:block print:bg-white print:text-black text-left mt-0 p-8 fixed inset-0 z-50 overflow-y-auto bg-white">
                    <div className="flex justify-between items-end mb-8 border-b-4 border-slate-800 pb-4">
                        <div>
                            <h1 className="text-3xl font-bold uppercase tracking-wider text-slate-900">Reporte de Gestión Diario</h1>
                            <p className="text-sm font-medium text-slate-500 mt-1">Agente: {interactions[0]?.user_id || 'Usuario'}</p>
                            <p className="text-sm font-medium text-slate-500">Fecha: {format(reportDate, 'dd/MM/yyyy')}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-5xl font-black text-slate-900">{effectiveInteractions}</div>
                            <div className="text-xs uppercase font-bold text-slate-500 tracking-widest">Contactos Efectivos</div>
                        </div>
                    </div>

                    {/* Achievements Section */}
                    {unlockedAchievements.length > 0 && (
                        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded p-4">
                            <h3 className="flex items-center gap-2 font-bold uppercase text-xs tracking-wider text-yellow-800 mb-2">
                                <Trophy className="w-4 h-4" /> Logros Desbloqueados
                            </h3>
                            <div className="flex flex-wrap gap-4">
                                {unlockedAchievements.map(id => {
                                    const ach = ACHIEVEMENTS[id];
                                    if (!ach) return null;
                                    return (
                                        <div key={id} className="flex items-center gap-2 bg-white px-3 py-2 rounded shadow-sm border border-yellow-100">
                                            <span className="text-2xl">{ach.icon}</span>
                                            <div>
                                                <div className="font-bold text-xs text-slate-900">{ach.title}</div>
                                                <div className="text-[10px] text-slate-500">{ach.description}</div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* 1. General Interaction Summary */}
                    <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <h3 className="font-bold border-b border-slate-300 mb-3 pb-1 uppercase text-xs tracking-wider text-slate-700">Resumen de Actividad</h3>
                        <div className="grid grid-cols-4 gap-8 text-sm">
                            <div>
                                <div className="text-slate-500 text-xs uppercase mb-1">Intentos Totales</div>
                                <div className="font-black text-xl">{interactions.length}</div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-xs uppercase mb-1">Contactados</div>
                                <div className="font-bold text-lg text-blue-700">{effectiveInteractions}</div>
                                <div className="text-[10px] text-slate-400">({Math.round(interactions.length > 0 ? (effectiveInteractions / interactions.length) * 100 : 0)}% del total)</div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-xs uppercase mb-1">No Contactados</div>
                                <div className="font-bold text-lg text-slate-700">
                                    {interactions.filter(i => ['No contesta', 'Cuelgan', 'Numero Equivocado', 'Buzón'].includes(i.result)).length}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-xs uppercase mb-1">Efectividad Venta</div>
                                <div className="font-bold text-lg text-green-700">{conversion}%</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-8">
                        {/* 2. Breakdown by Result */}
                        <div>
                            <h3 className="font-bold border-b border-slate-300 mb-3 pb-1 uppercase text-xs tracking-wider text-slate-700">Desglose por Resultado</h3>
                            <table className="w-full text-xs">
                                <thead className="bg-slate-100 text-slate-600 font-semibold">
                                    <tr>
                                        <th className="py-1 px-2 text-left">Resultado</th>
                                        <th className="py-1 px-2 text-right">Cant.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {[
                                        { label: 'Ventas (Aceptó)', count: totalSales, color: 'text-green-700 font-bold' },
                                        { label: 'Rechazos', count: totalRejected, color: 'text-red-700' },
                                        { label: 'Lo Pensará', count: interactions.filter(i => i.result === 'Lo pensará').length, color: 'text-amber-700' },
                                        { label: 'No Contesta / Buzón', count: interactions.filter(i => ['No contesta', 'Cuelgan', 'Buzón'].includes(i.result)).length, color: 'text-slate-500' },
                                        { label: 'Otros', count: interactions.filter(i => !['Aceptó Migración', 'Lo pensará', 'No contesta', 'Cuelgan', 'Buzón'].includes(i.result) && !i.result.includes('Rechazó')).length, color: 'text-slate-500' }
                                    ].filter(r => r.count > 0).map(r => (
                                        <tr key={r.label}>
                                            <td className={`py-1 px-2 ${r.color}`}>{r.label}</td>
                                            <td className="py-1 px-2 text-right font-mono">{r.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 3. Objections Analysis */}
                        <div>
                            <h3 className="font-bold border-b border-slate-300 mb-3 pb-1 uppercase text-xs tracking-wider text-slate-700">Top Objeciones</h3>
                            <div className="space-y-2 text-xs">
                                {Object.entries(
                                    interactions
                                        .filter(i => i.result === 'Rechazó (Mantiene)' || i.result === 'Rechazó (Cancelación)' || i.result === 'Lo pensará')
                                        .reduce((acc, curr) => {
                                            const key = curr.objection || 'Sin motivo';
                                            acc[key] = (acc[key] || 0) + 1;
                                            return acc;
                                        }, {} as Record<string, number>)
                                ).sort(([, a], [, b]) => b - a).slice(0, 5).map(([obj, count], idx) => (
                                    <div key={obj} className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[9px] font-bold">{idx + 1}</span>
                                            <span className="capitalize text-slate-700">{obj}</span>
                                        </div>
                                        <span className="font-bold text-slate-900">{count}</span>
                                    </div>
                                ))}
                                {totalRejected === 0 && <p className="text-slate-400 italic">Sin objeciones registradas.</p>}
                            </div>
                        </div>
                    </div>

                    {/* 4. Full Table */}
                    <div>
                        <h3 className="font-bold border-b border-slate-300 mb-2 pb-1 uppercase text-xs tracking-wider text-slate-700">Detalle de Interacciones (Cronológico)</h3>
                        <table className="w-full text-[9px] text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 text-slate-900">
                                    <th className="py-1">Hora</th>
                                    <th className="py-1">Cliente</th>
                                    <th className="py-1">Plan</th>
                                    <th className="py-1">Resultado</th>
                                    <th className="py-1">Observación</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {interactions.map(i => (
                                    <tr key={i.id} className={i.result === 'Aceptó Migración' ? 'bg-green-50' : ''}>
                                        <td className="py-1 font-mono text-slate-500">{i.created_at ? format(new Date(i.created_at), 'HH:mm') : '-'}</td>
                                        <td className="py-1 font-bold text-slate-800">{i.client_reference}</td>
                                        <td className="py-1 text-slate-500">{i.current_plan}</td>
                                        <td className="py-1">
                                            <span className={clsx(
                                                "font-bold",
                                                i.result === 'Aceptó Migración' ? "text-green-800" :
                                                    i.result.includes('Rechazó') ? "text-red-700" : "text-slate-600"
                                            )}>{i.result}</span>
                                        </td>
                                        <td className="py-1 text-slate-500 truncate max-w-[200px] italic">{i.objection || i.suggested_plan || ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="fixed bottom-8 left-8 right-8 text-[10px] text-slate-400 border-t border-slate-200 pt-2 flex justify-between print:flex hidden">
                        <span>Generado por ISP Reportes v1.0</span>
                        <span>{format(new Date(), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                </div>

                {/* Summary Text (Screen Only) */}
                <div className="p-4 bg-muted/30 rounded-lg text-sm text-left space-y-2 font-mono text-muted-foreground print:hidden">
                    <div className="flex justify-between">
                        <span>Rechazos:</span>
                        <span className="font-bold text-foreground">{totalRejected}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Sin Contacto / Cuelgan:</span>
                        <span className="font-bold text-foreground">{interactions.filter(i => ['No contesta', 'Cuelgan'].includes(i.result)).length}</span>
                    </div>
                    <div className="border-t border-dashed border-border my-2 pt-2 flex justify-between">
                        <span>Hora Cierre:</span>
                        <span>{format(new Date(), 'HH:mm:ss')}</span>
                    </div>
                </div>

                <div className="pt-6 flex flex-col sm:flex-row gap-4 justify-center print:hidden">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold bg-secondary hover:bg-secondary/80 transition-colors w-full sm:w-auto"
                    >
                        <Home className="w-5 h-5" /> Ir al Dashboard
                    </button>
                    {/* Only show Logout if it's today's close, otherwise unnecessary clutter for history view */}
                    {selectedDate === new Date().toISOString().split('T')[0] && (
                        <button
                            onClick={handleExit}
                            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all w-full sm:w-auto"
                        >
                            <LogOut className="w-5 h-5" /> Cerrar Sesión
                        </button>
                    )}
                </div>

                <p className="text-xs text-muted-foreground mt-8 print:hidden">
                    * Todos tus datos han sido guardados automáticamente.
                </p>
            </div>
        </div>
    );
}
