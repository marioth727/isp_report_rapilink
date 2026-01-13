import { useEffect, useState } from 'react';
import { WisphubService } from '../lib/wisphub';
import {
    AlertTriangle,
    Clock,
    CheckCircle2,
    TrendingUp,
    Filter,
    X,
    ChevronUp,
    ChevronDown,
    ArrowUpDown,
    Shield,
    MessageSquare,
    Send,
    User,
    Calendar,
    Info,
    Activity,
    FileText,
    Wifi,
    Tag,
    UserPlus,
    CalendarDays,
    Link as LinkIcon
} from 'lucide-react';


import { TicketTimeline } from '../components/dashboard/TicketTimeline';

import { useLocation } from 'react-router-dom';

type FilterType = 'todos' | 'vencidos' | 'riesgo' | 'dia';
type SortConfig = { key: string; direction: 'asc' | 'desc' } | null;

export function OperationsDashboard() {
    const location = useLocation();

    // Read initial filter from navigation state (if any)
    const initialFilter = (location.state as any)?.filter || 'todos';

    const [allTickets, setAllTickets] = useState<any[]>([]);
    const [filteredTickets, setFilteredTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
    const [activeFilter, setActiveFilter] = useState<FilterType>(initialFilter);
    const [filterSubject, setFilterSubject] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [subjects, setSubjects] = useState<string[]>([]);

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

    const [statusFilter, setStatusFilter] = useState<'all' | 'nuevo' | 'en-proceso'>('all');


    const itemsPerPage = 15;

    const [stats, setStats] = useState({
        total: 0,
        critico: 0,
        amarillo: 0,
        verde: 0
    });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        applyFilterAndSort();
    }, [allTickets, activeFilter, filterSubject, sortConfig, statusFilter]);

    const loadData = async () => {
        setLoading(true);
        setSyncProgress({ current: 0, total: 0 });
        try {
            const data = await WisphubService.getAllTickets((current, total) => {
                setSyncProgress({ current, total });
            });

            // FILTRO ESTRICTO: Ocultar tickets que ya están CERRADOS en WispHub
            // WispHub a veces los incluye en la lista de abiertos, pero el usuario NO quiere verlos.
            const activeTickets = data.filter((t: any) => t.nombre_estado !== 'Cerrado' && t.id_estado !== 3);
            setAllTickets(activeTickets);

            const newStats = activeTickets.reduce((acc: any, ticket: any) => {
                acc.total++;
                if (ticket.sla_status === 'critico') acc.critico++;
                else if (ticket.sla_status === 'amarillo') acc.amarillo++;
                else acc.verde++;
                return acc;
            }, { total: 0, critico: 0, amarillo: 0, verde: 0 });

            setStats(newStats);

            // Extract unique subjects
            const uniqueSubjects = Array.from(new Set(data.map((t: any) => t.asunto))).sort();
            setSubjects(uniqueSubjects as string[]);
        } catch (error) {
            console.error("Error loading dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilterAndSort = () => {
        let result = [...allTickets];

        // Primary Filters (SLA & Subject)
        result = result.filter(t => {
            const matchesSLA =
                activeFilter === 'todos' ? true :
                    activeFilter === 'vencidos' ? t.sla_status === 'critico' :
                        activeFilter === 'riesgo' ? t.sla_status === 'amarillo' :
                            activeFilter === 'dia' ? t.sla_status === 'verde' : true;

            const matchesSubject = filterSubject ? t.asunto === filterSubject : true;

            // Status Filter (Nuevo / En Proceso)
            const matchesStatus =
                statusFilter === 'all' ? true :
                    statusFilter === 'nuevo' ? Number(t.id_estado) === 1 :
                        statusFilter === 'en-proceso' ? Number(t.id_estado) === 2 : true;

            return matchesSLA && matchesSubject && matchesStatus;
        });

        // Sort
        if (sortConfig) {
            result.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Handle numeric values
                if (sortConfig.key === 'id' || sortConfig.key === 'horas_abierto') {
                    aValue = Number(aValue) || 0;
                    bValue = Number(bValue) || 0;
                } else {
                    aValue = String(aValue || '').toLowerCase();
                    bValue = String(bValue || '').toLowerCase();
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        setFilteredTickets(result);
        setCurrentPage(1);
    };

    const resetFilters = () => {
        setActiveFilter('todos');
        setFilterSubject('');
        setSortConfig(null);
        setCurrentPage(1);
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
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

    const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
    const paginatedTickets = filteredTickets.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const startIndex = filteredTickets.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const endIndex = Math.min(currentPage * itemsPerPage, filteredTickets.length);

    const getSLAColor = (status: string) => {
        switch (status) {
            case 'critico': return 'bg-red-500/20 text-red-500 border-red-500/50 animate-pulse';
            case 'amarillo': return 'bg-orange-500/20 text-orange-500 border-orange-500/50';
            default: return 'bg-green-500/20 text-green-500 border-green-500/50';
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground animate-pulse font-medium text-lg uppercase tracking-widest font-black">
                Sincronizando {syncProgress.current} tickets...
                {syncProgress.total > 0 && <span className="opacity-50 ml-2">de {syncProgress.total}</span>}
            </p>
        </div>
    );

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
                        Control de SLA y Trazabilidad
                        <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">LIVE</span>
                    </h1>
                    <p className="text-muted-foreground text-lg font-medium">Gestión Operativa Global de Tickets Nuevos</p>
                </div>
                <div className="flex gap-3">
                    {(activeFilter !== 'todos' || filterSubject !== '' || sortConfig !== null) && (
                        <button
                            onClick={() => {
                                resetFilters();
                                setFilterSubject('');
                            }}
                            className="flex items-center justify-center w-12 h-12 bg-destructive/10 text-destructive rounded-2xl hover:bg-destructive/20 transition-all font-black border border-destructive/20 active:scale-95 group"
                            title="Resetear Filtros"
                        >
                            <X size={20} className="group-hover:rotate-90 transition-transform" />
                        </button>
                    )}
                    <button
                        onClick={loadData}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 transition-all font-black shadow-xl shadow-primary/25 active:scale-95"
                    >
                        <Clock size={18} />
                        Actualizar
                    </button>
                </div>
            </header>

            {/* KPI Cards as Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <button
                    onClick={() => setActiveFilter('vencidos')}
                    className={`bg-card p-6 rounded-3xl border-2 transition-all text-left flex items-center space-x-6 shadow-xl hover:shadow-2xl active:scale-[0.98] ${activeFilter === 'vencidos' ? 'border-red-500 bg-red-500/5' : 'border-border'}`}
                >
                    <div className="p-4 bg-red-500/10 rounded-2xl text-red-500 shadow-inner">
                        <AlertTriangle size={32} />
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[.2em]">Vencidos (&gt;48h)</p>
                        <p className="text-4xl font-black text-red-500 leading-none mt-2">{stats.critico}</p>
                    </div>
                </button>

                <button
                    onClick={() => setActiveFilter('riesgo')}
                    className={`bg-card p-6 rounded-3xl border-2 transition-all text-left flex items-center space-x-6 shadow-xl hover:shadow-2xl active:scale-[0.98] ${activeFilter === 'riesgo' ? 'border-orange-500 bg-orange-500/5' : 'border-border'}`}
                >
                    <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-500 shadow-inner">
                        <Clock size={32} />
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[.2em]">En Riesgo (24-48h)</p>
                        <p className="text-4xl font-black text-orange-500 leading-none mt-2">{stats.amarillo}</p>
                    </div>
                </button>

                <button
                    onClick={() => setActiveFilter('dia')}
                    className={`bg-card p-6 rounded-3xl border-2 transition-all text-left flex items-center space-x-6 shadow-xl hover:shadow-2xl active:scale-[0.98] ${activeFilter === 'dia' ? 'border-green-500 bg-green-500/5' : 'border-border'}`}
                >
                    <div className="p-4 bg-green-500/10 rounded-2xl text-green-500 shadow-inner">
                        <CheckCircle2 size={32} />
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[.2em]">Al Día (&lt;24h)</p>
                        <p className="text-4xl font-black text-green-500 leading-none mt-2">{stats.verde}</p>
                    </div>
                </button>

                <button
                    onClick={() => setActiveFilter('todos')}
                    className={`bg-card p-6 rounded-3xl border-2 transition-all text-left flex items-center space-x-6 shadow-xl hover:shadow-2xl active:scale-[0.98] ${activeFilter === 'todos' ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                    <div className="p-4 bg-primary/10 rounded-2xl text-primary shadow-inner">
                        <TrendingUp size={32} />
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[.2em]">Tickets Totales</p>
                        <p className="text-4xl font-black text-primary leading-none mt-2">{stats.total}</p>
                    </div>
                </button>
            </div>



            {/* Main Table Section */}
            <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
                <div className="p-6 border-b border-border bg-muted/20 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    <div className="flex items-center gap-3">
                        <Filter className="text-primary" size={20} />
                        <h2 className="font-black text-xs uppercase tracking-[.2em] text-muted-foreground mr-4">Listado de Trazabilidad</h2>

                        {/* Status Filter UI */}
                        <div className="flex bg-muted/40 p-1 rounded-lg">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${statusFilter === 'all' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:bg-muted/60'}`}
                            >
                                Todos
                            </button>
                            <button
                                onClick={() => setStatusFilter('nuevo')}
                                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${statusFilter === 'nuevo' ? 'bg-blue-500/10 text-blue-600 shadow-sm border border-blue-200' : 'text-muted-foreground hover:bg-muted/60'}`}
                            >
                                Nuevos
                            </button>
                            <button
                                onClick={() => setStatusFilter('en-proceso')}
                                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${statusFilter === 'en-proceso' ? 'bg-orange-500/10 text-orange-600 shadow-sm border border-orange-200' : 'text-muted-foreground hover:bg-muted/60'}`}
                            >
                                En Progreso
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <select
                            value={filterSubject}
                            onChange={(e) => setFilterSubject(e.target.value)}
                            className="bg-background border border-border text-[10px] font-black uppercase tracking-wider rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 outline-none w-full md:w-64"
                        >
                            <option value="">Todos los Asuntos</option>
                            {subjects.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <span className="text-[10px] font-black bg-primary/10 text-primary px-3 py-1 rounded-full whitespace-nowrap">{filteredTickets.length} RESULTADOS</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-muted/50 text-[10px] uppercase text-muted-foreground font-black tracking-widest border-b border-border">
                            <tr>
                                <th className="p-4 cursor-pointer hover:text-primary transition-colors group" onClick={() => handleSort('id')}>
                                    <div className="flex items-center gap-1">
                                        ID {sortConfig?.key === 'id' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        {!sortConfig && <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100" />}
                                    </div>
                                </th>
                                <th className="p-4 cursor-pointer hover:text-primary transition-colors group" onClick={() => handleSort('nombre_cliente')}>
                                    <div className="flex items-center gap-1">
                                        CLIENTE {sortConfig?.key === 'nombre_cliente' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        {!sortConfig && <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100" />}
                                    </div>
                                </th>
                                <th className="p-4 cursor-pointer hover:text-primary transition-colors group" onClick={() => handleSort('asunto')}>
                                    <div className="flex items-center gap-1">
                                        ASUNTO {sortConfig?.key === 'asunto' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        {!sortConfig && <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100" />}
                                    </div>
                                </th>
                                <th className="p-4 cursor-pointer hover:text-primary transition-colors group text-center" onClick={() => handleSort('nombre_estado')}>
                                    <div className="flex items-center justify-center gap-1">
                                        ESTADO {sortConfig?.key === 'nombre_estado' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        {!sortConfig && <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100" />}
                                    </div>
                                </th>
                                <th className="p-4 cursor-pointer hover:text-primary transition-colors group text-center" onClick={() => handleSort('id_prioridad')}>
                                    <div className="flex items-center justify-center gap-1">
                                        PRIORIDAD {sortConfig?.key === 'id_prioridad' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        {!sortConfig && <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100" />}
                                    </div>
                                </th>
                                <th className="p-4 cursor-pointer hover:text-primary transition-colors group" onClick={() => handleSort('nombre_tecnico')}>
                                    <div className="flex items-center gap-1">
                                        TÉCNICO {sortConfig?.key === 'nombre_tecnico' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        {!sortConfig && <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100" />}
                                    </div>
                                </th>
                                <th className="p-4 text-center cursor-pointer hover:text-primary transition-colors group" onClick={() => handleSort('horas_abierto')}>
                                    <div className="flex items-center justify-center gap-1">
                                        SLA {sortConfig?.key === 'horas_abierto' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        {!sortConfig && <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100" />}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {paginatedTickets.map((ticket) => (
                                <tr
                                    key={ticket.id}
                                    className="group hover:bg-primary/[0.02] cursor-pointer transition-colors"
                                    onClick={() => handleTicketClick(ticket)}
                                >
                                    <td className="p-4">
                                        <div className="font-black text-primary text-xl leading-none">#{ticket.id}</div>
                                        <div className="text-[9px] text-muted-foreground font-bold mt-1 uppercase tracking-tighter">Ticket ID</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-black text-xs uppercase text-foreground">{ticket.nombre_cliente}</div>
                                        <div className="text-[9px] text-muted-foreground font-medium mt-0.5">ID Servicio: {ticket.servicio || 'N/A'}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-[10px] font-black uppercase tracking-wide text-foreground/80 bg-muted/50 px-2 py-1 rounded inline-block max-w-[200px] truncate">
                                            {ticket.asunto}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border tracking-widest ${Number(ticket.id_estado) === 3 ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                            Number(ticket.id_estado) === 2 ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                                'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                            }`}>
                                            {ticket.nombre_estado}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border tracking-widest ${Number(ticket.id_prioridad) === 3 ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                            Number(ticket.id_prioridad) === 2 ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                                Number(ticket.id_prioridad) === 4 ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                                                    'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                            }`}>
                                            {ticket.prioridad}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                <User size={12} />
                                            </div>
                                            <span className="text-[10px] font-bold uppercase">{ticket.nombre_tecnico || 'Sin asignar'}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col items-center w-full max-w-[80px] mx-auto">
                                            <div className="text-xl font-black font-mono tracking-tighter tabular-nums mb-1">{ticket.horas_abierto}H</div>

                                            {/* SLA Progress Bar */}
                                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                                                <div
                                                    className={`h-full rounded-full transition-all ${ticket.sla_status === 'critico' ? 'bg-red-500 w-full' :
                                                        ticket.sla_status === 'amarillo' ? 'bg-orange-500 w-[75%]' :
                                                            'bg-green-500 w-[40%]'
                                                        }`}
                                                ></div>
                                            </div>

                                            <div className={`px-3 py-0.5 rounded-full text-[8px] font-black uppercase border tracking-widest ${getSLAColor(ticket.sla_status)}`}>
                                                {ticket.sla_status === 'critico' ? 'Vencido' : ticket.sla_status === 'amarillo' ? 'Riesgo' : 'OK'}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-border bg-muted/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        Mostrando <span className="text-foreground">{startIndex}</span> a <span className="text-foreground">{endIndex}</span> de <span className="text-primary">{filteredTickets.length}</span> registros
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 bg-card border border-border rounded-xl text-muted-foreground hover:text-primary hover:border-primary disabled:opacity-30 disabled:hover:text-muted-foreground disabled:hover:border-border transition-all shadow-sm"
                        >
                            <ChevronDown className="rotate-90" size={18} />
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum = i + 1;
                                if (totalPages > 5 && currentPage > 3) {
                                    pageNum = currentPage - 3 + i + 1;
                                }
                                if (pageNum > totalPages) return null;
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${currentPage === pageNum ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'bg-card border border-border text-muted-foreground hover:border-primary'}`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 bg-card border border-border rounded-xl text-muted-foreground hover:text-primary hover:border-primary disabled:opacity-30 disabled:hover:text-muted-foreground disabled:hover:border-border transition-all shadow-sm"
                        >
                            <ChevronDown className="-rotate-90" size={18} />
                        </button>
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
                                                        ticketDetail?.servicio_completo?.router ||
                                                        ticketDetail?.servicio_completo?.modelo_router, 'N/A')}
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
                                                className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap relative z-10 description-content cursor-pointer"
                                                onClick={(e) => {
                                                    const target = e.target as HTMLElement;
                                                    if (target.tagName === 'IMG') {
                                                        setPreviewImage((target as HTMLImageElement).src);
                                                    }
                                                }}
                                                dangerouslySetInnerHTML={{
                                                    __html: ticketDetail?.descripcion || 'Sin descripción detallada por el momento.'
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
                                                <TicketTimeline
                                                    comments={comments.map(c => ({
                                                        nombre_tecnico: c.nombre_usuario || 'Sistema',
                                                        fecha: c.fecha,
                                                        descripcion: c.comentario
                                                    }))}
                                                    ticketDate={ticketDetail?.fecha_creacion || selectedTicket.fecha_creacion}
                                                    ticketAuthor={ticketDetail?.nombre_tecnico || selectedTicket.nombre_tecnico || 'Sistema'}
                                                />
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
            {/* Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 animate-in fade-in duration-200">
                    <button
                        onClick={() => setPreviewImage(null)}
                        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                    >
                        <X size={32} />
                    </button>
                    <img
                        src={previewImage}
                        alt="Preview"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    />
                </div>
            )}
        </div>
    );
}
