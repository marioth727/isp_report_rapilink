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
    Timer,
    Rocket,
    Wrench,
    Clock
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
    fecha_llegada?: string;
    fecha_fin?: string;

    // Métricas calculadas
    latencia?: number; // Despacho -> Inicio
    latencia_trayecto?: number; // Inicio -> Llegada
    duracion?: number; // Inicio -> Fin (Total)
    duracion_trabajo?: number; // Llegada -> Fin (Efectivo)
    runningTime?: number; // Tiempo actual en ejecución
    isStuck?: boolean; // Si lleva > 3h en ejecución
    estado: 'pendiente' | 'en_proceso' | 'resuelto' | 'terminado' | 'rezagado';
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
    trayectoPromedio: number;
    duracionPromedio: number;
    eficiencia: number;
}

interface OperationalTimelineProps {
    tickets: any[]; // Tickets planificados (Mapa de Despacho)
    fieldTechnicians?: any[];
    inProgressTickets?: any[]; // Tickets en proceso (Estado 2)
    completedTickets?: any[]; // Tickets completados hoy (Estado 3 y 4)
}

export function OperationalTimeline({
    tickets: plannedTickets,
    fieldTechnicians,
    inProgressTickets = [],
    completedTickets = []
}: OperationalTimelineProps) {
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
    const calculateTicketState = (t: any): 'pendiente' | 'en_proceso' | 'resuelto' | 'terminado' | 'rezagado' => {
        const now = new Date();

        // ESTADOS WISPUB (CONFIRMADOS POR USUARIO):
        // 1: Nuevo (Despachado) -> pendiente
        // 2: En Progreso (En Ejecución) -> en_proceso
        // 3: Resuelto (Resuelto) -> resuelto
        // 4: Cerrado (Terminado) -> terminado

        if (t.id_estado === 4 || t.estado === 'cerrado' || t.nombre_estado === 'Cerrado') return 'terminado';
        if (t.id_estado === 3 || t.estado === 'resuelto' || t.nombre_estado === 'Resuelto') return 'resuelto';

        // Fallback para completados sin estado específico
        if (t.estado === 'completado' || t.fecha_final || t.fecha_fin) return 'resuelto';

        if (t.id_estado === 2 || (t.fecha_inicio && !t.fecha_fin)) return 'en_proceso';

        const despacho = dispatchTimes[String(t.id)];
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
        const processedTicketIds = new Set<string>();

        // Normalizador de nombres para comparaciones seguras
        const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

        // Inicializar técnicos
        const techMap = new Map();
        if (fieldTechnicians) {
            fieldTechnicians.forEach(t => {
                techMap.set(normalize(t.full_name), t.full_name);
                techGroups[t.full_name] = [];
            });
        }

        // Función auxiliar para parsear fechas y normalizar desfases
        const parseWH = (str: string | null | undefined, isEndDate: boolean = false) => {
            if (!str) return null;
            let date: Date;

            if (str.includes('/')) {
                const parts = str.split(/[\/\s-:]/);
                if (parts.length >= 3) {
                    const p0 = parseInt(parts[0]);
                    const p1 = parseInt(parts[1]);
                    const p2 = parseInt(parts[2]);
                    const h = parts[3] ? parseInt(parts[3]) : 0;
                    const m = parts[4] ? parseInt(parts[4]) : 0;
                    const s = parts[5] ? parseInt(parts[5]) : 0;

                    // Heurística de formato (MM/DD vs DD/MM)
                    if (p0 > 12) {
                        // Es DD/MM/YYYY
                        date = new Date(p2, p1 - 1, p0, h, m, s);
                    } else if (p1 > 12) {
                        // Es MM/DD/YYYY
                        date = new Date(p2, p0 - 1, p1, h, m, s);
                    } else {
                        // Por defecto tratar como MM/DD (Formato API WispHub US)
                        date = new Date(p2, p0 - 1, p1, h, m, s);
                    }
                } else {
                    date = new Date(str);
                }
            } else {
                date = new Date(str);
            }

            if (isNaN(date.getTime())) return null;

            // NORMALIZACIÓN DE 5 HORAS (BUG WISPHUB API):
            // La API de WispHub a menudo entrega el cierre en UTC (+5h desfase)
            // Si es una fecha de finalización y el año es coherente, aplicamos el ajuste.
            if (isEndDate && date.getFullYear() >= 2024) {
                const now = new Date();
                const offsetMs = 5 * 60 * 60 * 1000;
                // Si la fecha parece ser del futuro (por el desfase UTC), restamos 5h
                if (date.getTime() > now.getTime() + (offsetMs / 2)) {
                    return new Date(date.getTime() - offsetMs);
                }
            }

            return date;
        };

        // Función para agregar un ticket a su grupo correspondiente
        const addTicketToGroup = (t: any) => {
            if (processedTicketIds.has(String(t.id))) return;

            // PRIORIDAD 1: Asignación manual de la App (inyectada por el padre como _assignedTechId)
            let realName = 'Sin Asignar';

            if (t._assignedTechId && fieldTechnicians) {
                const tech = fieldTechnicians.find(ft => ft.id === t._assignedTechId);
                if (tech) realName = tech.full_name;
            }

            // Si no hay asignación manual válida, ignoramos el ticket para el timeline 
            // Esto mata la "auto-asignación" visual de tickets que ya estaban en WispHub
            if (realName === 'Sin Asignar' && !t._forceTimeline) return;

            if (!techGroups[realName]) {
                techGroups[realName] = [];
            }

            const despacho = dispatchTimes[String(t.id)];
            let latencia_trayecto: number | undefined;
            let duracion: number | undefined;
            let duracion_trabajo: number | undefined;

            let latencia: number | undefined;
            if (despacho && t.fecha_inicio) {
                latencia = Math.floor((new Date(t.fecha_inicio).getTime() - new Date(despacho).getTime()) / 60000);
            }

            // NORMALIZACIÓN POR COMENTARIOS (Fuente de Verdad de WispHub)
            // Buscamos en el historial de respuestas la hora real de los hitos
            let fechaFinReal = t.fecha_final || t.fecha_fin;
            let fechaLlegadaReal = t.fecha_llegada;

            if (t.respuestas && Array.isArray(t.respuestas)) {
                // Buscamos "Llegada" para mayor precisión
                const llegadaMarker = t.respuestas.find((r: any) =>
                    r.respuesta?.toLowerCase().includes('llegada') ||
                    r.respuesta?.toLowerCase().includes('llego')
                );
                if (llegadaMarker) fechaLlegadaReal = llegadaMarker.created;

                // Buscamos el último comentario de cierre/instalación para la hora de fin
                const cierreMarker = t.respuestas.find((r: any) =>
                    r.respuesta?.toLowerCase().includes('instalacion') ||
                    r.respuesta?.toLowerCase().includes('realizada') ||
                    r.respuesta?.toLowerCase().includes('cerrado')
                );
                if (cierreMarker) fechaFinReal = cierreMarker.created;
            }

            const startDate = parseWH(t.fecha_inicio);
            const arrivalDate = parseWH(fechaLlegadaReal);
            const endDate = parseWH(fechaFinReal, true); // Aplicar ajuste de 5h si es necesario

            if (startDate && arrivalDate) {
                latencia_trayecto = Math.floor((arrivalDate.getTime() - startDate.getTime()) / 60000);
            }

            if (startDate && endDate) {
                duracion = Math.floor((endDate.getTime() - startDate.getTime()) / 60000);
            }

            if (arrivalDate && endDate) {
                duracion_trabajo = Math.floor((endDate.getTime() - arrivalDate.getTime()) / 60000);
            }

            // LÓGICA DE SUPERVISIÓN: Detectar tickets estancados (> 3 horas)
            let isStuck = false;
            let runningTime: number | undefined;
            const state = calculateTicketState(t);

            if (state === 'en_proceso' && startDate) {
                const now = new Date();
                runningTime = Math.floor((now.getTime() - startDate.getTime()) / 60000);
                if (runningTime > 180) { // 3 Horas
                    isStuck = true;
                }
            }

            // Asegurar que no tengamos tiempos negativos por errores de registro
            if (latencia_trayecto !== undefined && latencia_trayecto < 0) latencia_trayecto = 0;
            if (duracion !== undefined && duracion < 0) duracion = 0;
            if (duracion_trabajo !== undefined && duracion_trabajo < 0) duracion_trabajo = 0;

            techGroups[realName].push({
                id: String(t.id),
                nombre_cliente: t.nombre_cliente,
                barrio: t.barrio,
                prioridad: t.prioridad,
                tecnico_actual: realName,
                asunto: t.asunto,
                fecha_creacion: t.fecha_creacion,
                fecha_despacho: dispatchTimes[String(t.id)],
                fecha_inicio: t.fecha_inicio,
                fecha_llegada: fechaLlegadaReal,
                fecha_fin: fechaFinReal,
                latencia,
                latencia_trayecto,
                duracion,
                duracion_trabajo,
                runningTime,
                isStuck,
                estado: calculateTicketState(t)
            });
            processedTicketIds.add(String(t.id));
        };

        // Procesar listas
        if (plannedTickets) plannedTickets.forEach(addTicketToGroup);
        if (inProgressTickets) inProgressTickets.forEach(addTicketToGroup);
        if (completedTickets) completedTickets.forEach(addTicketToGroup);

        return Object.entries(techGroups).map(([name, tickets]): TechnicianStats => {
            const completed = tickets.filter(t => t.estado === 'resuelto' || t.estado === 'terminado');
            const lats = completed.filter(t => t.latencia !== undefined).map(t => t.latencia!);
            const trays = completed.filter(t => t.latencia_trayecto !== undefined).map(t => t.latencia_trayecto!);
            const durs = completed.filter(t => t.duracion !== undefined).map(t => t.duracion!);

            return {
                techName: name,
                tickets,
                total: tickets.length,
                completados: completed.length,
                enProceso: tickets.filter(t => t.estado === 'en_proceso').length,
                pendientes: tickets.filter(t => t.estado === 'pendiente' || t.estado === 'rezagado').length,
                rezagados: tickets.filter(t => t.estado === 'rezagado').length,
                latenciaPromedio: lats.length > 0 ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0,
                trayectoPromedio: trays.length > 0 ? Math.round(trays.reduce((a, b) => a + b, 0) / trays.length) : 0,
                duracionPromedio: durs.length > 0 ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0,
                eficiencia: tickets.length > 0 ? Math.round((completed.length / tickets.length) * 100) : 0
            };
        }).sort((a, b) => b.completados - a.completados); // Ordenar por productividad
    }, [plannedTickets, inProgressTickets, completedTickets, dispatchTimes, fieldTechnicians]);

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
                    icon={<Activity className="text-blue-500" />}
                    label="Despachos Hoy"
                    value={processedTechs.reduce((acc, t) => acc + t.total, 0)}
                />
                <GlobalStatCard
                    icon={<CheckCircle2 className="text-emerald-500" />}
                    label="Completados"
                    value={processedTechs.reduce((acc, t) => acc + t.completados, 0)}
                />
                <GlobalStatCard
                    icon={<Timer className="text-orange-500" />}
                    label="En Ejecución"
                    value={processedTechs.reduce((acc, t) => acc + t.enProceso, 0)}
                />
                <GlobalStatCard
                    icon={<AlertTriangle className="text-red-500" />}
                    label="Rezagados"
                    value={processedTechs.reduce((acc, t) => acc + t.rezagados, 0)}
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
                                        <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Trayecto</p>
                                        <p className="text-sm font-black text-blue-600">{tech.trayectoPromedio}m</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">Atención</p>
                                        <p className="text-sm font-black text-emerald-600">{tech.duracionPromedio}m</p>
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
        en_proceso: { icon: <Activity size={14} />, color: "bg-blue-100 text-blue-600", label: "En Ejecución" },
        resuelto: { icon: <CheckCircle2 size={14} />, color: "bg-emerald-100 text-emerald-600", label: "Resuelto" },
        terminado: { icon: <CheckCircle2 size={14} />, color: "bg-emerald-500 text-white", label: "Terminado", textColor: "text-emerald-700" },
        rezagado: { icon: <AlertTriangle size={14} />, color: "bg-red-100 text-red-600", label: "Rezagado" }
    }[ticket.estado] || { icon: <Pause size={14} />, color: "bg-slate-100 text-slate-500", label: "Desconocido" };

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm group hover:border-primary/30 transition-all">
            <div className="flex items-center gap-4">
                <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", config.color)}>
                    {config.icon}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="text-[11px] font-[1000] text-slate-900 group-hover:text-primary transition-colors uppercase tracking-tight">#{ticket.id} - {ticket.nombre_cliente}</h4>
                        {ticket.isStuck && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 border border-red-100 rounded-full animate-pulse">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                <span className="text-[8px] font-black text-red-600 uppercase tracking-widest">Cuello de Botella</span>
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">{ticket.barrio} | {ticket.asunto}</p>
                    {ticket.isStuck && (
                        <p className="text-[9px] font-bold text-red-500 mt-1 italic">⚠️ El técnico lleva {Math.floor(ticket.runningTime! / 60)}h {(ticket.runningTime! % 60)}m en este ticket. Verificar inconvenientes.</p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-6 mt-4 md:mt-0">
                <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estado</span>
                    <span className={clsx("text-[10px] font-black uppercase", (config as any).textColor || config.color.split(' ')[1])}>{config.label}</span>
                </div>
                {ticket.latencia_trayecto !== undefined && (
                    <div className="flex flex-col items-end border-l border-slate-100 pl-4">
                        <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1">
                            <Rocket size={8} /> Trayecto
                        </span>
                        <span className="text-[10px] font-black text-blue-700">{ticket.latencia_trayecto}m</span>
                    </div>
                )}
                {ticket.duracion_trabajo !== undefined ? (
                    <div className="flex flex-col items-end border-l border-slate-100 pl-4">
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                            <Wrench size={8} /> Trabajo
                        </span>
                        <span className="text-[10px] font-black text-emerald-600">{ticket.duracion_trabajo}m</span>
                    </div>
                ) : (
                    ticket.duracion !== undefined && (
                        <div className="flex flex-col items-end border-l border-slate-100 pl-4">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Clock size={8} /> Total
                            </span>
                            <span className="text-[10px] font-black text-slate-700">{ticket.duracion}m</span>
                        </div>
                    )
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
