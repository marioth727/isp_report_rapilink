
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WisphubService } from '../lib/wisphub';
import {
    AlertTriangle,
    Clock,
    CheckCircle2,
    TrendingUp,
    X,
    Shield,
    Activity,
    FileDown,
    MessageSquare,
    Send,
    User,
    Calendar,
    Info,
    Wifi,
    FileText,
    Tag,
    UserPlus,
    CalendarDays,
    Link as LinkIcon
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { WorkloadSummary } from '../components/dashboard/WorkloadSummary';

export function OperativeDashboard() {
    const [allTickets, setAllTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
    const [topUrgentTickets, setTopUrgentTickets] = useState<any[]>([]);

    // Ticket Detail State
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const [ticketDetail, setTicketDetail] = useState<any>(null);
    const [comments, setComments] = useState<any[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [newNote, setNewNote] = useState('');
    const [sendingNote, setSendingNote] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const renderSafe = (val: any, fallback: string = 'N/A') => {
        if (val === null || val === undefined) return fallback;
        if (typeof val === 'object') {
            return val.nombre || val.username || val.text || val.asunto || String(val.id || '');
        }
        return String(val);
    };

    const navigate = useNavigate();

    const [stats, setStats] = useState({
        total: 0,
        critico: 0,
        amarillo: 0,
        verde: 0
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setSyncProgress({ current: 0, total: 0 });
        try {
            const data = await WisphubService.getAllTickets((current, total) => {
                setSyncProgress({ current, total });
            });
            // FILTRO ESTRICTO: Ocultar tickets que ya están CERRADOS en WispHub para consistencia con OperationsDashboard
            const activeTickets = data.filter((t: any) => t.nombre_estado !== 'Cerrado' && t.id_estado !== 3);
            setAllTickets(activeTickets);

            // Usar activeTickets para stats no data
            const newStats = activeTickets.reduce((acc: any, ticket: any) => {
                acc.total++;
                if (ticket.sla_status === 'critico') acc.critico++;
                else if (ticket.sla_status === 'amarillo') acc.amarillo++;
                else acc.verde++;
                return acc;
            }, { total: 0, critico: 0, amarillo: 0, verde: 0 });

            setStats(newStats);

            // Set Top 5 Urgent Tickets
            const sorted = [...data].sort((a, b) => b.horas_abierto - a.horas_abierto);
            setTopUrgentTickets(sorted.slice(0, 5));
        } catch (error) {
            console.error("Error loading dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        if (!allTickets.length) return;

        const data = allTickets.map(t => ({
            ID: t.id,
            Fecha_Creado: t.fecha_creacion,
            Cliente: t.nombre_cliente,
            Asunto: t.asunto,
            Estado_SLA: t.sla_status === 'critico' ? 'Vencido' : t.sla_status === 'amarillo' ? 'En Riesgo' : 'Al Día',
            Horas_Transcurridas: t.horas_abierto,
            Tecnico: t.nombre_tecnico || 'Sin Asignar',
            Prioridad: t.prioridad,
            Estado: t.estado
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tickets Operativos");
        XLSX.writeFile(wb, `Reporte_Tickets_Global_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleTicketClick = async (ticket: any) => {
        setSelectedTicket(ticket);
        setLoadingComments(true);
        setLoadingDetail(true);
        setComments([]);
        setTicketDetail(null);
        try {
            const [detail, ticketComments] = await Promise.all([
                WisphubService.getTicketDetail(ticket.id),
                WisphubService.getTicketComments(ticket.id)
            ]);

            // Si el objeto de la lista ya tiene servicio_completo, lo usamos inicialmente
            if (ticket.servicio_completo) {
                detail.servicio_completo = ticket.servicio_completo;
            }

            // Si el ticket no trae el servicio completo, o necesitamos refrescarlo, lo buscamos
            if (detail && (detail.servicio || detail.id_servicio) && (!detail.servicio_completo || !detail.servicio_completo.ip)) {
                const serviceId = detail.servicio || detail.id_servicio;
                const serviceDetail = await WisphubService.getServiceDetail(serviceId);
                if (serviceDetail) {
                    detail.servicio_completo = { ...detail.servicio_completo, ...serviceDetail };
                }
            }

            setTicketDetail(detail);
            setComments(ticketComments);
        } catch (error) {
            console.error("Error loading ticket data:", error);
        } finally {
            setLoadingComments(false);
            setLoadingDetail(false);
        }
    };

    const handleAddNote = async () => {
        if (!newNote.trim() || !selectedTicket) return;
        setSendingNote(true);
        try {
            const success = await WisphubService.addTicketComment(selectedTicket.id, newNote);
            if (success) {
                // Refresh comments
                const ticketComments = await WisphubService.getTicketComments(selectedTicket.id);
                setComments(ticketComments);
                setNewNote('');
            }
        } catch (error) {
            console.error("Error adding note:", error);
        } finally {
            setSendingNote(false);
        }
    };



    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground animate-pulse font-black text-lg uppercase tracking-widest">
                Sincronizando {syncProgress.current} tickets...
            </p>
        </div>
    );

    return (
        <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
                <div>
                    <h1 className="text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
                        <Shield className="text-primary" size={36} />
                        Dashboard Operativo
                    </h1>
                    <p className="text-muted-foreground text-lg font-medium">Vista Ejecutiva de Rendimiento</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 px-6 py-3 bg-muted border border-border text-foreground rounded-2xl hover:bg-muted/80 transition-all font-black"
                    >
                        <FileDown size={18} />
                        Exportar Excel
                    </button>
                    <button
                        onClick={loadData}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 transition-all font-black shadow-xl shadow-primary/25 active:scale-95"
                    >
                        <TrendingUp size={18} />
                        Refrescar Datos
                    </button>
                </div>
            </header>

            {/* Indicator Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <OperativeKpiCard
                    title="Críticos (+48h)"
                    value={stats.critico}
                    icon={AlertTriangle}
                    color="text-red-500"
                    bg="bg-red-500/10"
                />
                <OperativeKpiCard
                    title="En Riesgo (24-48h)"
                    value={stats.amarillo}
                    icon={Clock}
                    color="text-orange-500"
                    bg="bg-orange-500/10"
                />
                <OperativeKpiCard
                    title="A Tiempo (<24h)"
                    value={stats.verde}
                    icon={CheckCircle2}
                    color="text-green-500"
                    bg="bg-green-500/10"
                />
                <OperativeKpiCard
                    title="Total Tickets"
                    value={stats.total}
                    icon={Activity}
                    color="text-primary"
                    bg="bg-primary/10"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Visual Chart Section */}
                {/* Visual Chart Section - Ahora usando WorkloadSummary */}
                <WorkloadSummary tickets={allTickets} />

                {/* Top 5 Urgent Tickets */}
                <div className="lg:col-span-2 bg-card rounded-3xl border border-border overflow-hidden shadow-sm flex flex-col">
                    <div className="p-6 border-b border-border bg-muted/20 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <h2 className="font-black text-xs uppercase tracking-[.2em] text-muted-foreground flex items-center gap-2">
                                <AlertTriangle size={14} className="text-red-500" /> Top 5 Tickets Urgentes
                            </h2>
                        </div>
                        <button
                            onClick={() => navigate('/operaciones/trazabilidad')}
                            className="text-[10px] font-black text-primary hover:underline uppercase tracking-wider"
                        >
                            Ver Todo en Trazabilidad
                        </button>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left">
                            <thead className="bg-muted/50 text-[10px] uppercase text-muted-foreground font-black tracking-widest border-b border-border">
                                <tr>
                                    <th className="p-4">ID / ASUNTO</th>
                                    <th className="p-4">CLIENTE</th>
                                    <th className="p-4 text-center">SLA</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {topUrgentTickets.map((ticket) => (
                                    <tr
                                        key={ticket.id}
                                        className="group hover:bg-primary/[0.02] cursor-pointer transition-colors"
                                        onClick={() => handleTicketClick(ticket)}
                                    >
                                        <td className="p-4">
                                            <div className="font-black text-primary text-xl leading-none">#{ticket.id}</div>
                                            <div className="text-[9px] text-muted-foreground truncate max-w-[150px] font-bold mt-1 uppercase">{ticket.asunto}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-black text-xs uppercase">{ticket.nombre_cliente}</div>
                                            <div className="text-[9px] text-muted-foreground font-medium">{ticket.nombre_tecnico || 'Sin asignar'}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col items-center">
                                                <div className="text-xl font-black font-mono tracking-tighter text-red-500">{ticket.horas_abierto}H</div>
                                                <div className="w-full h-1 bg-red-500 rounded-full mt-1 animate-pulse"></div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {topUrgentTickets.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="p-12 text-center text-muted-foreground font-bold text-xs">
                                            No hay tickets críticos pendientes. ¡Excelente!
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Ticket Detail Drawer */}
            {selectedTicket && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedTicket(null)}></div>
                    <div className="relative w-full max-w-lg bg-card border-l border-border h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-border bg-muted/20">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                    <Shield size={24} />
                                </div>
                                <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <h2 className="text-2xl font-black text-foreground">Ticket #{selectedTicket.id}</h2>
                            <p className="text-sm font-bold text-primary uppercase tracking-widest mt-1">{selectedTicket.asunto}</p>
                        </div>

                        {/* Information Sections */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {loadingDetail ? (
                                <div className="p-8 space-y-6">
                                    <div className="h-4 bg-muted animate-pulse rounded w-1/3"></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="h-16 bg-muted animate-pulse rounded-2xl"></div>
                                        <div className="h-16 bg-muted animate-pulse rounded-2xl"></div>
                                    </div>
                                    <div className="h-32 bg-muted animate-pulse rounded-2xl"></div>
                                </div>
                            ) : (
                                <div className="p-6 space-y-8">
                                    {/* Ticket General Info Section */}
                                    <section className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-[.25em] text-muted-foreground flex items-center gap-2">
                                            <Tag size={14} className="text-primary" /> INFORMACIÓN TICKET
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                                                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                                    <CheckCircle2 size={12} />
                                                    <span className="text-[9px] font-black uppercase">Estado / Prioridad</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${(ticketDetail?.id_estado || selectedTicket.id_estado) === 3 ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                                                        {renderSafe(ticketDetail?.nombre_estado || selectedTicket.nombre_estado, 'Abierto')}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase border bg-orange-500/10 text-orange-500 border-orange-500/20">
                                                        {renderSafe(ticketDetail?.nombre_prioridad || selectedTicket.prioridad, 'Alta')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                                                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                                    <Calendar size={12} />
                                                    <span className="text-[9px] font-black uppercase">Creado</span>
                                                </div>
                                                <p className="text-xs font-bold">
                                                    {renderSafe(ticketDetail?.fecha_creacion ? new Date(ticketDetail.fecha_creacion).toLocaleString() : null, 'N/A')}
                                                </p>
                                            </div>
                                            <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                                                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                                    <UserPlus size={12} />
                                                    <span className="text-[9px] font-black uppercase">Creado por</span>
                                                </div>
                                                <p className="text-xs font-bold truncate">
                                                    {renderSafe(ticketDetail?.user_creado, 'Sistema')}
                                                </p>
                                            </div>
                                            <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                                                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                                    <User size={12} />
                                                    <span className="text-[9px] font-black uppercase">Técnico</span>
                                                </div>
                                                <p className="text-xs font-bold truncate">
                                                    {renderSafe(ticketDetail?.nombre_tecnico || selectedTicket.nombre_tecnico, 'Sin asignar')}
                                                </p>
                                            </div>
                                            <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                                                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                                    <Clock size={12} />
                                                    <span className="text-[9px] font-black uppercase">Visita / Inicio</span>
                                                </div>
                                                <p className="text-[10px] font-bold">
                                                    {renderSafe(ticketDetail?.fecha_visita ? `${ticketDetail.fecha_visita} ${ticketDetail.hora_visita || ''}` : (ticketDetail?.fecha_inicio ? new Date(ticketDetail.fecha_inicio).toLocaleString() : null), 'No definida')}
                                                </p>
                                            </div>
                                            <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                                                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                                    <Clock size={12} />
                                                    <span className="text-[9px] font-black uppercase">Fin Estimado</span>
                                                </div>
                                                <p className="text-[10px] font-bold">
                                                    {renderSafe(ticketDetail?.fecha_final || ticketDetail?.fecha_termino ? new Date(ticketDetail.fecha_final || ticketDetail.fecha_termino).toLocaleString() : null, 'No definida')}
                                                </p>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Client Info Section */}
                                    <section className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-[.25em] text-muted-foreground flex items-center gap-2">
                                            <User size={14} className="text-primary" /> INFORMACIÓN CLIENTE
                                        </h3>
                                        <div className="bg-muted/30 p-4 rounded-2xl border border-border/50 space-y-3">
                                            <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                                <span className="text-[9px] font-black uppercase text-muted-foreground">Nombre</span>
                                                <span className="text-xs font-black">{renderSafe(ticketDetail?.nombre_cliente || ticketDetail?.servicio_completo?.nombre, 'No disponible')}</span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                                <span className="text-[9px] font-black uppercase text-muted-foreground">Cédula / DNI</span>
                                                <span className="text-xs font-black">{renderSafe(ticketDetail?.servicio_completo?.cedula, 'No disponible')}</span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                                <span className="text-[9px] font-black uppercase text-muted-foreground">Dirección</span>
                                                <span className="text-xs font-bold text-right ml-4">{renderSafe(ticketDetail?.servicio_completo?.direccion, 'No disponible')}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-black uppercase text-muted-foreground">Teléfono / Email</span>
                                                <div className="text-right">
                                                    <p className="text-xs font-black">{renderSafe(ticketDetail?.servicio_completo?.telefono, 'No disponible')}</p>
                                                    <p className="text-[9px] text-muted-foreground">{renderSafe(ticketDetail?.servicio_completo?.email, '')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Service Technical Info Section */}
                                    <section className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-[.25em] text-muted-foreground flex items-center gap-2">
                                            <Activity size={14} className="text-primary" /> INFORMACIÓN SERVICIO
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                                                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                                    <Shield size={12} />
                                                    <span className="text-[9px] font-black uppercase">Usuario de Red</span>
                                                </div>
                                                <p className="text-xs font-black truncate">{renderSafe(ticketDetail?.servicio_completo?.usuario_rb || ticketDetail?.servicio_completo?.usuario, 'No disponible')}</p>
                                            </div>
                                            <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                                                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                                    <Info size={12} />
                                                    <span className="text-[9px] font-black uppercase">Nº IP</span>
                                                </div>
                                                <p className="text-xs font-mono font-black">{renderSafe(ticketDetail?.servicio_completo?.ip || selectedTicket?.servicio_completo?.ip, 'Sin IP')}</p>
                                            </div>
                                            <div className="bg-muted/30 p-4 rounded-2xl border border-border/50 col-span-2">
                                                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                                    <Wifi size={12} />
                                                    <span className="text-[9px] font-black uppercase">Plan Internet</span>
                                                </div>
                                                <p className="text-xs font-black">
                                                    {renderSafe(ticketDetail?.servicio_completo?.plan_internet?.nombre ||
                                                        selectedTicket?.servicio_completo?.plan_internet?.nombre ||
                                                        ticketDetail?.servicio_completo?.plan_internet, 'Sin Plan')}
                                                </p>
                                            </div>
                                            <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                                                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                                    <LinkIcon size={12} />
                                                    <span className="text-[9px] font-black uppercase">Router / AP</span>
                                                </div>
                                                <p className="text-xs font-bold truncate">
                                                    {renderSafe(ticketDetail?.servicio_completo?.modelo_router_wifi ||
                                                        selectedTicket?.servicio_completo?.modelo_router_wifi ||
                                                        ticketDetail?.servicio_completo?.router, 'N/A')}
                                                </p>
                                                <p className="text-[9px] font-medium text-muted-foreground truncate">
                                                    {renderSafe(ticketDetail?.servicio_completo?.sectorial?.nombre ||
                                                        selectedTicket?.servicio_completo?.sectorial?.nombre ||
                                                        ticketDetail?.servicio_completo?.ap, 'Sin Nodo')}
                                                </p>
                                            </div>
                                            <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                                                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                                    <CalendarDays size={12} />
                                                    <span className="text-[9px] font-black uppercase">Instalación / Zona</span>
                                                </div>
                                                <p className="text-xs font-bold truncate">{renderSafe(ticketDetail?.servicio_completo?.fecha_instalacion, 'N/A')}</p>
                                                <p className="text-[9px] font-medium text-muted-foreground truncate">{renderSafe(ticketDetail?.servicio_completo?.zona, 'N/A')}</p>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Ticket Description */}
                                    <section className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-[.25em] text-muted-foreground flex items-center gap-2">
                                            <FileText size={14} className="text-primary" /> Descripción del Ticket
                                        </h3>
                                        <div className="bg-primary/5 p-5 rounded-3xl border border-primary/10 relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-3 opacity-10">
                                                <FileText size={64} />
                                            </div>
                                            <div
                                                className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap relative z-10 cursor-pointer"
                                                onClick={(e) => {
                                                    const target = e.target as HTMLElement;
                                                    if (target.tagName === 'IMG') {
                                                        setPreviewImage((target as HTMLImageElement).src);
                                                    }
                                                }}
                                                dangerouslySetInnerHTML={{
                                                    __html: selectedTicket.descripcion || 'Sin descripción detallada por el momento.'
                                                }}
                                            />
                                        </div>
                                    </section>

                                    {/* Comments Section */}
                                    <section className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-[.25em] text-muted-foreground flex items-center gap-2">
                                            <MessageSquare size={14} className="text-primary" /> Historial de Comentarios
                                        </h3>

                                        {loadingComments ? (
                                            <div className="flex flex-col items-center justify-center py-12 space-y-3">
                                                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase">Cargando bitácora...</p>
                                            </div>
                                        ) : comments.length === 0 ? (
                                            <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl opacity-60">
                                                <p className="text-xs font-bold text-muted-foreground">No hay comentarios en este ticket aún.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {comments.map((comment, idx) => (
                                                    <div key={idx} className="bg-muted/30 p-4 rounded-2xl border border-border/50 relative group">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                                    <User size={12} />
                                                                </div>
                                                                <span className="text-[10px] font-black uppercase">{comment.nombre_usuario || 'Sistema'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground">
                                                                <Calendar size={10} />
                                                                {new Date(comment.fecha).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-foreground/80 leading-relaxed">{comment.comentario}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                </div>
                            )}
                        </div>

                        {/* Quick Note Input */}
                        <div className="p-6 border-t border-border bg-card">
                            <div className="relative">
                                <textarea
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    placeholder="Escribe una nota rápida o actualización..."
                                    className="w-full bg-muted/50 border border-border rounded-2xl p-4 pr-12 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none h-24 font-medium transition-all"
                                ></textarea>
                                <button
                                    onClick={handleAddNote}
                                    disabled={!newNote.trim() || sendingNote}
                                    className="absolute bottom-4 right-4 p-2 bg-primary text-white rounded-xl hover:scale-110 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 transition-all shadow-lg shadow-primary/20"
                                >
                                    {sendingNote ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <Send size={20} />
                                    )}
                                </button>
                            </div>
                            <p className="text-[9px] font-bold text-muted-foreground mt-3 uppercase text-center">Las notas se sincronizan automáticamente con WispHub</p>
                        </div>
                    </div>
                </div>
            )}
            {/* Image Preview Overlay */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setPreviewImage(null)}
                >
                    <button
                        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                        onClick={() => setPreviewImage(null)}
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={previewImage}
                        alt="Preview"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                    />
                </div>
            )}
        </div>
    );
}

function OperativeKpiCard({ title, value, icon: Icon, color, bg }: any) {
    return (
        <div className={`p-6 bg-card rounded-3xl border border-border transition-all text-left shadow-sm group`}>
            <div className={`w-12 h-12 rounded-2xl ${bg} ${color} flex items-center justify-center mb-4 transition-transform`}>
                <Icon size={24} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</p>
            <p className={`text-4xl font-black mt-2 ${color}`}>{value}</p>
        </div>
    );
}
