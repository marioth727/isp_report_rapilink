import React, { useMemo, useState } from 'react';
import {
    CheckCircle2,
    AlertTriangle,
    Pause,
    Activity,
    User,
    ChevronDown,
    ChevronRight,
    TrendingUp,
    Timer
} from 'lucide-react';
import clsx from 'clsx';

interface TimelineTicket {
    id: string;
    nombre_cliente: string;
    barrio: string;
    prioridad: string;
    tecnico_actual: string;
    asunto: string;

    // Timestamps
    fecha_creacion: string;
    fecha_despacho?: string;
    fecha_inicio?: string;
    fecha_fin?: string;

    // Métricas calculadas
    latencia?: number;
    duracion?: number;
    estado: 'pendiente' | 'en_proceso' | 'completado' | 'rezagado';
}

interface TechnicianStats {
    techName: string;
    tickets: TimelineTicket[];
    total: number;
    completados: number;
    enProceso: number;
    pendientes: number;
    rezagados: number;
    latenciaPromedio: number;
    duracionPromedio: number;
    eficiencia: number;
}

interface OperationalTimelineProps {
    tickets: any[];
    fieldTechnicians?: any[];
}

export function OperationalTimeline({ tickets: rawTickets, fieldTechnicians }: OperationalTimelineProps) {
    const [expandedTechs, setExpandedTechs] = useState<Record<string, boolean>>({});

    // Cargar timestamps de despacho del localStorage
    const dispatchTimes = useMemo(() => {
        try {
            const saved = localStorage.getItem('dispatch_timestamps');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    }, []);

    // Lógica de cálculo de estado
    const calculateTicketState = (t: any): 'pendiente' | 'en_proceso' | 'completado' | 'rezagado' => {
        const now = new Date();

        if (t.id_estado === '3' || t.status === 'completado' || t.fecha_fin) return 'completado';
        if (t.fecha_inicio && !t.fecha_fin) return 'en_proceso';

        const despacho = dispatchTimes[t.id];
        if (despacho && !t.fecha_inicio) {
            const despachoDate = new Date(despacho);
            const diffMins = Math.floor((now.getTime() - despachoDate.getTime()) / 60000);
            if (diffMins > 60) return 'rezagado';
        }

        return 'pendiente';
    };

    // Procesamiento y agrupación de datos
    const processedTechs = useMemo(() => {
        const techGroups: Record<string, TimelineTicket[]> = {};

        // Normalizador de nombres para comparaciones seguras
        const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

        rawTickets.forEach(t => {
            const techName = t.nombre_tecnico || t.tecnico_actual || 'Sin Asignar';

            // FILTRADO ESTRICTO: Si tenemos lista de técnicos de campo, solo permitimos los que coincidan
            if (fieldTechnicians && techName !== 'Sin Asignar') {
                const isFieldTech = fieldTechnicians.some(ft =>
                    ft.full_name && normalize(ft.full_name).includes(normalize(techName))
                );
                if (!isFieldTech) return; // Omitir personal no autorizado (administrativos, etc.)
            }

            if (!techGroups[techName]) techGroups[techName] = [];

            const despacho = dispatchTimes[t.id];

            let latencia: number | undefined;
            if (despacho && t.fecha_inicio) {
                latencia = Math.floor((new Date(t.fecha_inicio).getTime() - new Date(despacho).getTime()) / 60000);
            }

            let duracion: number | undefined;
            if (t.fecha_inicio && t.fecha_fin) {
                duracion = Math.floor((new Date(t.fecha_fin).getTime() - new Date(t.fecha_inicio).getTime()) / 60000);
            }

            techGroups[techName].push({
                ...t,
                fecha_despacho: despacho,
                latencia,
                duracion,
                estado: calculateTicketState(t)
            });
        });

        return Object.entries(techGroups).map(([name, tickets]): TechnicianStats => {
            const completed = tickets.filter(t => t.estado === 'completado');
            const lats = completed.filter(t => t.latencia !== undefined).map(t => t.latencia!);
            const durs = completed.filter(t => t.duracion !== undefined).map(t => t.duracion!);

            return {
                techName: name,
                tickets,
                total: tickets.length,
                completados: completed.length,
                enProceso: tickets.filter(t => t.estado === 'en_proceso').length,
                pendientes: tickets.filter(t => t.estado === 'pendiente').length,
                rezagados: tickets.filter(t => t.estado === 'rezagado').length,
                latenciaPromedio: lats.length > 0 ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0,
                duracionPromedio: durs.length > 0 ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0,
                eficiencia: tickets.length > 0 ? Math.round((completed.length / tickets.length) * 100) : 0
            };
        }).sort((a, b) => b.eficiencia - a.eficiencia);
    }, [rawTickets, dispatchTimes, fieldTechnicians]);

    const toggleTech = (name: string) => {
        setExpandedTechs(prev => ({ ...prev, [name]: !prev[name] }));
    };


    if (processedTechs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center animate-in fade-in duration-700">
                <div className="w-20 h-20 bg-slate-100 rounded-[2.5rem] flex items-center justify-center mb-6">
                    <Timer className="text-slate-300" size={40} />
                </div>
                <h3 className="text-2xl font-[1000] text-slate-900 uppercase tracking-tight">Sin Jornada Activa</h3>
                <p className="text-slate-400 font-medium max-w-xs mt-2">No hay tickets despachados para mostrar métricas en este momento.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-6 pb-20 max-w-[1400px] mx-auto animate-in fade-in duration-700">
            {/* Resumen Global */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlobalStatCard
                    icon={<Activity className="text-primary" />}
                    label="Despachos Hoy"
                    value={rawTickets.length}
                />
                <GlobalStatCard
                    icon={<CheckCircle2 className="text-emerald-500" />}
                    label="Completados"
                    value={processedTechs.reduce((acc, curr) => acc + curr.completados, 0)}
                />
                <GlobalStatCard
                    icon={<Timer className="text-blue-500" />}
                    label="En Sitio"
                    value={processedTechs.reduce((acc, curr) => acc + curr.enProceso, 0)}
                />
                <GlobalStatCard
                    icon={<AlertTriangle className="text-red-500" />}
                    label="Rezagados"
                    value={processedTechs.reduce((acc, curr) => acc + curr.rezagados, 0)}
                />
            </div>

            {/* Lista de Técnicos */}
            <div className="grid gap-4">
                {processedTechs.map((tech) => (
                    <div
                        key={tech.techName}
                        className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-3xl overflow-hidden shadow-sm transition-all"
                    >
                        <button
                            onClick={() => toggleTech(tech.techName)}
                            className="w-full p-6 flex items-center justify-between hover:bg-white/50 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                                    <User className="text-slate-400" size={24} />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{tech.techName}</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[10px] font-black uppercase text-slate-400">Eficiencia</span>
                                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={clsx(
                                                    "h-full rounded-full transition-all duration-1000",
                                                    tech.eficiencia > 70 ? "bg-emerald-500" : tech.eficiencia > 40 ? "bg-blue-500" : "bg-red-500"
                                                )}
                                                style={{ width: `${tech.eficiencia}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-600">{tech.eficiencia}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                <div className="hidden md:flex gap-6">
                                    <div className="text-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Latencia</p>
                                        <p className="text-sm font-black text-slate-800">{tech.latenciaPromedio}m</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Atención</p>
                                        <p className="text-sm font-black text-slate-800">{tech.duracionPromedio}m</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Estado</p>
                                        <p className="text-sm font-black text-slate-800">{tech.completados}/{tech.total}</p>
                                    </div>
                                </div>
                                {expandedTechs[tech.techName] ? <ChevronDown className="text-slate-400" /> : <ChevronRight className="text-slate-400" />}
                            </div>
                        </button>

                        {expandedTechs[tech.techName] && (
                            <div className="p-6 pt-0 border-t border-slate-100 bg-slate-50/30">
                                <div className="grid gap-3 mt-6">
                                    {tech.tickets.map((ticket) => (
                                        <TicketRow key={ticket.id} ticket={ticket} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function TicketRow({ ticket }: { ticket: TimelineTicket }) {
    const config = {
        pendiente: { icon: <Pause size={14} />, color: "bg-slate-100 text-slate-500", label: "Despachado" },
        en_proceso: { icon: <Activity size={14} />, color: "bg-blue-100 text-blue-600", label: "En Sitio" },
        completado: { icon: <CheckCircle2 size={14} />, color: "bg-emerald-100 text-emerald-600", label: "Listo" },
        rezagado: { icon: <AlertTriangle size={14} />, color: "bg-red-100 text-red-600", label: "Rezagado" }
    }[ticket.estado];

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm group hover:border-primary/30 transition-all">
            <div className="flex items-center gap-4">
                <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", config.color)}>
                    {config.icon}
                </div>
                <div>
                    <h4 className="text-[11px] font-black text-slate-900 group-hover:text-primary transition-colors">#{ticket.id} - {ticket.nombre_cliente}</h4>
                    <p className="text-[10px] text-slate-500 font-medium">{ticket.barrio} | {ticket.asunto}</p>
                </div>
            </div>

            <div className="flex items-center gap-6 mt-4 md:mt-0">
                <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estado</span>
                    <span className={clsx("text-[10px] font-black uppercase", config.color.split(' ')[1])}>{config.label}</span>
                </div>
                {ticket.latencia !== undefined && (
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Latencia</span>
                        <span className="text-[10px] font-black text-slate-700">{ticket.latencia}m</span>
                    </div>
                )}
                {ticket.duracion !== undefined && (
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Duración</span>
                        <span className="text-[10px] font-black text-slate-700">{ticket.duracion}m</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function GlobalStatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: number | string }) {
    return (
        <div className="bg-white/80 backdrop-blur-xl p-5 rounded-[2rem] border border-white/50 shadow-sm flex flex-col gap-1">
            <div className="flex items-center justify-between mb-1">
                <div className="p-2 bg-slate-50 rounded-xl">{icon}</div>
                <TrendingUp size={14} className="text-slate-300" />
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="text-2xl font-black text-slate-900 tracking-tighter">{value}</p>
        </div>
    );
}

export default OperationalTimeline;
