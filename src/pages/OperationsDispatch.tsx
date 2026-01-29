import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import {
    Truck,
    MapPin,
    AlertCircle,
    Clock,
    Search,
    Calendar,
    Loader2,
    X,
    Phone,
    ExternalLink,
    FileText,
    User,
    LayoutList,
    Map as MapIcon
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { WorkflowService } from '../lib/workflowService';
import { WisphubService } from '../lib/wisphub';
import clsx from 'clsx';

interface DispatchTicket {
    id: string;
    asunto: string;
    nombre_cliente: string;
    barrio: string;
    prioridad: string;
    id_prioridad: number;
    score: number;
    recurrence: number;
    fecha_creacion: string;
    horas_abierto: number;
    current_tecnico?: string;
    descripcion?: string;
    direccion?: string;
    telefono?: string;
    celular?: string;
    id_servicio?: string | number;
    creado_por?: string;
    estado_servicio?: string;
    tecnico_actual?: string;
    usuario_wisphub?: string;
    cedula?: string;
}

export function OperationsDispatch() {
    const [loading, setLoading] = useState(true);
    const [tickets, setTickets] = useState<DispatchTicket[]>([]);
    const [assignedRoutes, setAssignedRoutes] = useState<Record<string, DispatchTicket[]>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [neighborhoods, setNeighborhoods] = useState<Record<string, any>>({});
    const [selectedTicket, setSelectedTicket] = useState<DispatchTicket | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [mapFilter, setMapFilter] = useState<string | null>(null);

    // Corregir iconos de Leaflet
    useEffect(() => {
        const DefaultIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        });
        L.Marker.prototype.options.icon = DefaultIcon;
    }, []);

    // SWR para Técnicos
    const { data: techList } = useSWR('platform-users', () => WorkflowService.getPlatformUsers());
    const technicians = useMemo(() => {
        if (!techList) return [];
        return techList.filter(u => u.is_field_tech === true);
    }, [techList]);

    // SWR para Tickets iniciales (se procesarán en useEffect para agregar scoring/barrios)
    const { data: rawTickets, mutate: mutateTickets, error: ticketsError } = useSWR('wisphub-pending-tickets',
        () => WisphubService.getAllTickets({ status: '1' }),
        { refreshInterval: 300000, revalidateOnFocus: true }
    );


    useEffect(() => {
        // Si ya tenemos los datos básicos (aunque estén vacíos), procesamos.
        // Solo esperamos si techList o rawTickets son undefined (cargando de red).
        if (techList !== undefined && rawTickets !== undefined) {
            processTickets(rawTickets || []);
        }
    }, [rawTickets, techList, technicians]);

    const processTickets = async (allTickets: any[]) => {
        console.log(`[Dispatch] Iniciando procesamiento de ${allTickets.length} tickets...`);

        // 1. Mapeo rápido inicial (lo que ya mapeó WisphubService)
        const initialTickets: DispatchTicket[] = allTickets.map(t => ({
            ...t,
            barrio: t.barrio || 'Cargando...',
            score: t.score || 0,
            recurrence: t.recurrence || 0,
            tecnico_actual: t.nombre_tecnico || 'Sin Asignar'
        }));

        setTickets(initialTickets);

        // Quitar el loading principal rápido si ya tenemos tickets
        if (initialTickets.length > 0) setLoading(false);

        try {
            // 2. Procesamiento "Smart" (Scoring, Barrios, Recurrencia)
            // Lo hacemos en paralelo pero con un límite o progresivamente
            const enriched = await Promise.all(allTickets.map(async (t) => {
                try {
                    const score = await WorkflowService.calculateDispatchScore(t);
                    const barrio = t.servicio_completo?.barrio || t.servicio_completo?.localidad || 'Sin Barrio';
                    const recurrence = await WorkflowService.getClientRecurrence(t.servicio, new Date().getFullYear(), new Date().getMonth() + 1);

                    return {
                        ...t,
                        barrio,
                        score,
                        recurrence,
                        tecnico_actual: t.nombre_tecnico || 'Sin Asignar'
                    };
                } catch (e) {
                    console.error(`[Dispatch] Error enriqueciendo ticket ${t.id}:`, e);
                    return { ...t, barrio: 'Error', score: 0, recurrence: 0 };
                }
            }));

            const sorted = enriched.sort((a, b) => b.score - a.score);
            setTickets(sorted);
            console.log(`[Dispatch] Enriquecimiento completado para ${sorted.length} tickets.`);

            // 3. Inicializar rutas
            if (Object.keys(assignedRoutes).length === 0 || Object.keys(assignedRoutes).length !== technicians.length) {
                const initRoutes: Record<string, DispatchTicket[]> = {};
                technicians.forEach(tech => {
                    initRoutes[tech.id] = [];
                });
                setAssignedRoutes(initRoutes);
            }

            // 4. Georef (Baja prioridad)
            const uniqueBarrios = Array.from(new Set(sorted.map(t => t.barrio)));
            const georefMap: Record<string, any> = { ...neighborhoods };
            for (const b of uniqueBarrios) {
                if (!georefMap[b]) {
                    WorkflowService.getNeighborhoodGeoref(b).then(ref => {
                        if (ref) setNeighborhoods(prev => ({ ...prev, [b]: ref }));
                    });
                }
            }
        } catch (error) {
            console.error('[Dispatch] Error en enriquecimiento batch:', error);
        } finally {
            setLoading(false);
        }
    };

    // Cargar detalles extendidos al seleccionar un ticket
    useEffect(() => {
        if (selectedTicket && (!selectedTicket.creado_por || selectedTicket.creado_por === 'Sistema')) {
            loadTicketDetail(selectedTicket.id);
        }
    }, [selectedTicket?.id]);

    const loadTicketDetail = async (id: string) => {
        setDetailLoading(true);
        try {
            const detail = await WisphubService.getTicketDetail(id);
            if (detail && selectedTicket && detail.id === selectedTicket.id) {
                // Fusionar con datos existentes para no perder el score/barrio
                setSelectedTicket({
                    ...selectedTicket,
                    ...detail,
                    tecnico_actual: detail.nombre_tecnico || selectedTicket.tecnico_actual
                });
            }
        } catch (error) {
            console.error("Error loading ticket detail:", error);
        } finally {
            setDetailLoading(false);
        }
    };


    const onDragEnd = (result: DropResult) => {
        const { source, destination } = result;
        if (!destination) return;

        // Mismo lugar
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        let sourceList: DispatchTicket[] = [];
        let destList: DispatchTicket[] = [];

        // Identificar origen
        if (source.droppableId === 'unassigned') {
            sourceList = [...tickets];
        } else {
            sourceList = [...assignedRoutes[source.droppableId]];
        }

        // Remover item
        const [movedItem] = sourceList.splice(source.index, 1);

        // Identificar destino
        if (destination.droppableId === 'unassigned') {
            destList = [...tickets];
            destList.splice(destination.index, 0, movedItem);
            setTickets(destList);
        } else {
            destList = [...assignedRoutes[destination.droppableId]];
            destList.splice(destination.index, 0, movedItem);
            setAssignedRoutes({
                ...assignedRoutes,
                [destination.droppableId]: destList
            });
        }

        // Actualizar origen si no es el mismo que destino
        if (source.droppableId !== destination.droppableId) {
            if (source.droppableId === 'unassigned') {
                setTickets(sourceList);
            } else {
                setAssignedRoutes({
                    ...assignedRoutes,
                    [source.droppableId]: sourceList,
                    [destination.droppableId]: destList
                });
            }
        }
    };

    const handlePublish = async () => {
        const totalToAssign = Object.values(assignedRoutes).flat().length;
        if (totalToAssign === 0) {
            alert('No hay tickets asignados para publicar.');
            return;
        }

        if (!confirm(`¿Estás seguro de que deseas publicar ${totalToAssign} tickets? Se actualizará el técnico en WispHub de forma masiva.`)) {
            return;
        }

        setLoading(true);
        try {
            for (const [techId, routeTickets] of Object.entries(assignedRoutes)) {
                if (routeTickets.length === 0) continue;

                const technician = technicians.find(t => t.id === techId);
                if (!technician) continue;

                for (const ticket of routeTickets) {
                    console.log(`[Publish] Reasignando ticket ${ticket.id} a ${technician.full_name}...`);
                    await WorkflowService.changeWispHubTechnician(ticket.id, techId);
                }
            }
            alert('¡Despacho publicado con éxito! Los técnicos ya tienen sus rutas en WispHub.');
            mutateTickets();
        } catch (error) {
            console.error('Error publishing dispatch:', error);
            alert('Error al publicar el despacho. Revisa la consola para más detalles.');
        } finally {
            setLoading(false);
        }
    };

    if ((loading || !rawTickets || !techList) && !ticketsError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <div className="text-center space-y-2">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">
                        {!techList ? 'Sincronizando Técnicos...' : !rawTickets ? 'Obteniendo Tickets de WispHub...' : 'Calculando rutas óptimas y prioridades...'}
                    </p>
                    {rawTickets && (
                        <p className="text-[10px] font-bold text-primary uppercase">
                            Procesando {rawTickets.length} tickets encontrados...
                        </p>
                    )}
                </div>
                <button
                    onClick={() => setLoading(false)}
                    className="text-[10px] font-black uppercase text-muted-foreground hover:text-primary transition-colors mt-4"
                >
                    Forzar entrada (Ignorar carga)
                </button>
            </div>
        );
    }

    if (ticketsError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 border-2 border-dashed border-destructive/20 rounded-[2rem] bg-destructive/5 text-center">
                <AlertCircle className="w-12 h-12 text-destructive" />
                <div className="space-y-1">
                    <h3 className="font-black uppercase text-lg">Error de Comunicación</h3>
                    <p className="text-sm font-medium text-muted-foreground tracking-tight">WispHub no responde o la sesión en el navegador expiró.</p>
                </div>
                <button
                    onClick={() => mutateTickets()}
                    className="bg-destructive text-destructive-foreground px-6 py-2 rounded-xl font-black uppercase text-xs hover:scale-105 transition-all shadow-lg mt-2"
                >
                    Reintentar Conexión
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground uppercase flex items-center gap-3">
                        <Truck className="text-primary" size={32} />
                        Despacho & Logística
                    </h1>
                    <p className="text-muted-foreground font-medium text-sm">Optimización de rutas y georreferencia técnica en tiempo real.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-[10px] font-black uppercase text-muted-foreground leading-none">WispHub Sync</span>
                            <span className="text-[10px] font-bold text-primary tabular-nums">Auto-refresca @ 5m</span>
                        </div>
                        <button
                            onClick={() => {
                                setLoading(true);
                                mutateTickets();
                            }}
                            className="bg-primary/10 hover:bg-primary/20 text-primary p-2 rounded-xl transition-all border border-primary/20 flex items-center gap-2"
                            title="Sincronizar ahora con WispHub"
                        >
                            <Truck className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase pr-1">Refrescar</span>
                        </button>
                    </div>

                    <div className="bg-card border-2 border-border px-4 py-2 rounded-2xl flex items-center gap-4 shadow-sm">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-muted-foreground uppercase">Tickets</span>
                            <span className="text-lg font-black text-primary">{tickets.length}</span>
                        </div>
                        <div className="w-px h-8 bg-border" />
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-muted-foreground uppercase">Técnicos</span>
                            <span className="text-lg font-black text-foreground">{technicians.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Columna Izquierda: POOL DE TICKETS */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-card border-2 border-border rounded-[2rem] p-6 flex flex-col h-[750px]">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-foreground">
                                    <AlertCircle size={18} className="text-orange-500" /> Pool de Pendientes
                                </h3>
                                <div className="flex bg-muted rounded-xl p-1 border border-border">
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={clsx(
                                            "p-1.5 rounded-lg transition-all",
                                            viewMode === 'list' ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                        title="Vista Lista"
                                    >
                                        <LayoutList size={16} />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('map')}
                                        className={clsx(
                                            "p-1.5 rounded-lg transition-all",
                                            viewMode === 'map' ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                        title="Vista Mapa"
                                    >
                                        <MapIcon size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                <input
                                    type="text"
                                    placeholder="Buscar cliente o barrio..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-muted/50 border border-border rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                                />
                                {mapFilter && (
                                    <button
                                        onClick={() => setMapFilter(null)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-primary hover:text-primary/70 transition-colors"
                                    >
                                        Limpiar Mapa
                                    </button>
                                )}
                            </div>

                            <Droppable droppableId="unassigned">
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2"
                                    >
                                        {viewMode === 'map' ? (
                                            <div className="h-full rounded-2xl overflow-hidden relative border border-border">
                                                <MapContainer
                                                    center={[10.9685, -74.7813]}
                                                    zoom={12}
                                                    style={{ height: '100%', width: '100%' }}
                                                >
                                                    <TileLayer
                                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                    />
                                                    {Object.entries(
                                                        tickets.reduce((acc, t) => {
                                                            if (!t.barrio || t.barrio === 'Sin Barrio') return acc;
                                                            if (!acc[t.barrio]) acc[t.barrio] = { count: 0, lat: neighborhoods[t.barrio]?.latitude, lng: neighborhoods[t.barrio]?.longitude };
                                                            acc[t.barrio].count++;
                                                            return acc;
                                                        }, {} as Record<string, { count: number; lat?: number; lng?: number }>)
                                                    ).map(([bName, data]) => (
                                                        data.lat && data.lng && (
                                                            <Marker
                                                                key={bName}
                                                                position={[data.lat, data.lng]}
                                                                eventHandlers={{
                                                                    click: () => setMapFilter(bName)
                                                                }}
                                                            >
                                                                <Popup>
                                                                    <div className="p-2 text-center">
                                                                        <p className="text-[10px] font-black uppercase mb-1">{bName}</p>
                                                                        <div className="bg-primary text-white text-[10px] font-black px-2 py-1 rounded-full">
                                                                            {data.count} Tickets
                                                                        </div>
                                                                    </div>
                                                                </Popup>
                                                            </Marker>
                                                        )
                                                    ))}
                                                </MapContainer>
                                                <div className="absolute top-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm p-2 rounded-lg border border-border shadow-lg">
                                                    <p className="text-[8px] font-black uppercase text-primary">Vista Geográfica NOC</p>
                                                    <p className="text-[7px] font-bold text-muted-foreground uppercase leading-none">Toca un marcador para ver tickets</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {tickets
                                                    .filter(t => {
                                                        const matchesSearch = t.nombre_cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                            t.barrio.toLowerCase().includes(searchQuery.toLowerCase());
                                                        const matchesMap = !mapFilter || t.barrio === mapFilter;
                                                        return matchesSearch && matchesMap;
                                                    })
                                                    .map((ticket, index) => (
                                                        <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    {...provided.dragHandleProps}
                                                                    className={clsx(
                                                                        "p-4 bg-muted/30 border-2 rounded-2xl transition-all cursor-pointer",
                                                                        snapshot.isDragging ? "border-primary shadow-2xl scale-105 bg-card" : "border-border hover:border-primary/40 hover:bg-card shadow-sm"
                                                                    )}
                                                                    onClick={() => setSelectedTicket(ticket)}
                                                                >
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <div className="space-y-1">
                                                                            <p className="text-[10px] font-black uppercase text-muted-foreground truncate max-w-[150px]">
                                                                                {ticket.asunto}
                                                                            </p>
                                                                            <h4 className="text-xs font-black uppercase text-foreground leading-tight">
                                                                                {ticket.nombre_cliente}
                                                                            </h4>
                                                                        </div>
                                                                        <div className="flex flex-col items-end gap-1">
                                                                            <div className={clsx(
                                                                                "px-2 py-1 rounded-lg text-[9px] font-black uppercase",
                                                                                ticket.score > 200 ? "bg-red-500/10 text-red-500" :
                                                                                    ticket.score > 100 ? "bg-orange-500/10 text-orange-500" : "bg-emerald-500/10 text-emerald-500"
                                                                            )}>
                                                                                Score: {ticket.score}
                                                                            </div>
                                                                            {ticket.prioridad && (
                                                                                <div className={clsx(
                                                                                    "px-1.5 py-0.5 rounded text-[7px] font-bold border whitespace-nowrap",
                                                                                    ticket.id_prioridad >= 4 ? "bg-red-50 border-red-200 text-red-600" :
                                                                                        ticket.id_prioridad === 3 ? "bg-orange-50 border-orange-200 text-orange-600" :
                                                                                            "bg-blue-50 border-blue-200 text-blue-600"
                                                                                )}>
                                                                                    {ticket.prioridad}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-3 mt-3">
                                                                        <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase">
                                                                            <MapPin size={10} className={neighborhoods[ticket.barrio] ? "text-primary" : "text-muted-foreground"} />
                                                                            {ticket.barrio}
                                                                        </div>
                                                                        <div className="w-1 h-1 rounded-full bg-border" />
                                                                        <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase">
                                                                            <Clock size={10} />
                                                                            {ticket.horas_abierto}h
                                                                        </div>
                                                                        {ticket.recurrence > 1 && (
                                                                            <>
                                                                                <div className="w-1 h-1 rounded-full bg-border" />
                                                                                <div className="flex items-center gap-1 text-[9px] font-black text-red-500 uppercase">
                                                                                    <AlertCircle size={10} />
                                                                                    {ticket.recurrence}ª Visita
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </Draggable>
                                                    ))}
                                            </div>
                                        )}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    </div>

                    {/* Columna Derecha: RUTAS POR TÉCNICO */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20">
                                    <Calendar size={24} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-black uppercase tracking-tight text-foreground">Planeación para Mañana</h4>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Organiza las rutas arrastrando los tickets a cada técnico.</p>
                                </div>
                            </div>
                            <button
                                onClick={handlePublish}
                                className="px-6 py-2.5 bg-foreground text-background rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-foreground/10"
                            >
                                Publicar Despacho
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {technicians.map((tech) => (
                                <div key={tech.id} className="bg-card border-2 border-border rounded-[2.5rem] p-6 flex flex-col h-[500px]">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black uppercase">
                                                {tech.full_name?.substring(0, 2)}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black uppercase">{tech.full_name}</h4>
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Zona: {(tech as any).location || 'Norte'}</p>
                                            </div>
                                        </div>
                                        <div className="text-[10px] font-black bg-muted px-2 py-1 rounded-lg">
                                            {assignedRoutes[tech.id]?.length || 0} Tickets
                                        </div>
                                    </div>

                                    <Droppable droppableId={tech.id}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                                className={clsx(
                                                    "flex-1 rounded-2xl p-2 transition-all flex flex-col gap-3 min-h-[100px] overflow-y-auto custom-scrollbar",
                                                    snapshot.isDraggingOver ? "bg-primary/[0.03] border-2 border-dashed border-primary/30" : "bg-muted/10 border-2 border-transparent"
                                                )}
                                            >
                                                {assignedRoutes[tech.id]?.map((ticket, index) => (
                                                    <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                className={clsx(
                                                                    "p-3 bg-card border border-border shadow-sm rounded-xl flex items-center justify-between group cursor-pointer transition-all hover:border-primary/30",
                                                                    snapshot.isDragging && "opacity-50"
                                                                )}
                                                                onClick={() => setSelectedTicket(ticket)}
                                                            >
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className="text-[10px] font-black text-muted-foreground w-4">{index + 1}</div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-[10px] font-black uppercase truncate">{ticket.nombre_cliente}</p>
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <MapPin size={8} className="text-primary" />
                                                                            <span className="text-[8px] font-bold text-muted-foreground uppercase truncate">{ticket.barrio}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className={clsx(
                                                                    "px-1.5 py-0.5 rounded text-[8px] font-black",
                                                                    ticket.score > 150 ? "text-red-500" : "text-muted-foreground"
                                                                )}>
                                                                    {ticket.score}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                                {assignedRoutes[tech.id]?.length === 0 && (
                                                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/30 border-2 border-dashed border-border rounded-xl">
                                                        <PlusIcon size={24} />
                                                        <p className="text-[9px] font-black uppercase mt-2">Arrastra un ticket aquí</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Droppable>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </DragDropContext>

            {/* Ticket Detail Side Panel - Slide-over UI */}
            {selectedTicket && (
                <div className="fixed inset-0 z-50 overflow-hidden">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedTicket(null)} />

                    <div className="absolute inset-y-0 right-0 max-w-full flex">
                        <div className="w-screen max-w-md transform transition-all duration-500 ease-in-out">
                            <div className="h-full flex flex-col bg-white shadow-2xl overflow-y-auto rounded-l-[2.5rem] border-l-4 border-primary">
                                {/* Header */}
                                <div className="p-8 bg-slate-50 border-b border-slate-100 flex items-start justify-between relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-12 -mt-6 -mr-6 bg-primary/5 rounded-full blur-2xl" />

                                    <div className="relative z-10 w-full">
                                        <div className="flex items-center flex-wrap gap-2 mb-6">
                                            <span className={clsx(
                                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                                                selectedTicket.score > 150 ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-primary/10 text-primary border border-primary/20"
                                            )}>
                                                {selectedTicket.id_prioridad === 5 && <AlertCircle size={10} />}
                                                Ticket: #{selectedTicket.id}
                                            </span>
                                            <span className={clsx(
                                                "px-2 py-1 rounded-lg text-[10px] font-black uppercase",
                                                selectedTicket.id_prioridad >= 4 ? "bg-red-100 text-red-700" :
                                                    selectedTicket.id_prioridad === 3 ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                                            )}>
                                                Prioridad: {selectedTicket.prioridad}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-auto">{new Date(selectedTicket.fecha_creacion).toLocaleDateString()}</span>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <p className="text-xs font-bold text-primary uppercase tracking-widest border-l-4 border-primary pl-3">{selectedTicket.asunto}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setSelectedTicket(null)}
                                        className="p-2 bg-white rounded-full shadow-lg border border-slate-100 hover:scale-110 active:scale-95 transition-all text-slate-400 hover:text-red-500"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="p-8 space-y-8 flex-1">
                                    {/* Action Shortcuts */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {selectedTicket.celular && (
                                            <a
                                                href={`tel:${selectedTicket.celular}`}
                                                className="flex flex-col items-center justify-center p-4 bg-emerald-50 rounded-3xl border border-emerald-100 text-emerald-700 hover:bg-emerald-100 transition-all group"
                                            >
                                                <Phone size={20} className="mb-2 group-hover:scale-110 transition-transform" />
                                                <span className="text-[10px] font-black uppercase">Llamar Cliente</span>
                                            </a>
                                        )}
                                        <a
                                            href={`https://wisphub.io/tickets/ver/${selectedTicket.id}/`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-3xl border border-blue-100 text-blue-700 hover:bg-blue-100 transition-all group"
                                        >
                                            <ExternalLink size={20} className="mb-2 group-hover:scale-110 transition-transform" />
                                            <span className="text-[10px] font-black uppercase">Ver en WispHub</span>
                                        </a>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex flex-col gap-1">
                                            <h2 className="text-2xl font-black text-slate-900 leading-tight uppercase break-words">
                                                {selectedTicket.nombre_cliente || 'Sin Nombre de Cliente'}
                                            </h2>
                                            {selectedTicket.cedula && (
                                                <p className="text-[11px] font-bold text-slate-400 uppercase">C.C. {selectedTicket.cedula}</p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 group">
                                            <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 transition-transform group-hover:rotate-12">
                                                <MapPin size={16} />
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Dirección de Servicio</span>
                                                <p className="text-xs font-bold text-slate-700">{selectedTicket.direccion}</p>
                                                <p className="text-[10px] font-black text-primary uppercase mt-1">Barrio: {selectedTicket.barrio}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex items-center gap-2 group">
                                                <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 transition-transform group-hover:rotate-12">
                                                    <User size={16} />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ID / Usuario</span>
                                                    <p className="text-xs font-bold text-slate-700 truncate max-w-[120px]">
                                                        {detailLoading ? '...' : (selectedTicket.id_servicio || 'N/A') + ' / ' + (selectedTicket.usuario_wisphub || 'N/A')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 group">
                                                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 transition-transform group-hover:rotate-12">
                                                    <AlertCircle size={16} />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Estado Serv.</span>
                                                    {detailLoading ? (
                                                        <span className="animate-pulse bg-slate-100 h-4 w-12 block rounded mt-1" />
                                                    ) : (
                                                        <span className={clsx(
                                                            "text-[10px] font-black uppercase px-2 py-0.5 rounded",
                                                            selectedTicket.estado_servicio?.toLowerCase() === 'activo' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                                        )}>
                                                            {selectedTicket.estado_servicio}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Creado Por</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">
                                                        {detailLoading ? '...' : selectedTicket.creado_por?.substring(0, 1)}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-600">
                                                        {detailLoading ? 'Cargando...' : selectedTicket.creado_por}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Técnico Actual</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-black text-blue-500 uppercase">
                                                        {detailLoading ? '...' : (selectedTicket.tecnico_actual || 'S')?.substring(0, 1)}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-600 truncate">
                                                        {detailLoading ? 'Cargando...' : selectedTicket.tecnico_actual}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full h-px bg-slate-100" />

                                    {/* Description */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} className="text-slate-400" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción del Reporte</span>
                                        </div>
                                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar">
                                            <div
                                                className="text-sm font-medium text-slate-600 leading-relaxed html-content"
                                                dangerouslySetInnerHTML={{ __html: selectedTicket.descripcion || 'Sin descripción detallada.' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Metadata / Tags */}
                                    <div className="flex flex-wrap gap-2 pt-4">
                                        <div className="px-3 py-1.5 bg-slate-100 rounded-xl text-[9px] font-black text-slate-500 uppercase">
                                            SLA: {selectedTicket.horas_abierto} Horas
                                        </div>
                                        <div className="px-3 py-1.5 bg-slate-100 rounded-xl text-[9px] font-black text-slate-500 uppercase">
                                            Smart Score: {selectedTicket.score} pts
                                        </div>
                                        {selectedTicket.recurrence > 1 && (
                                            <div className="px-3 py-1.5 bg-red-100 rounded-xl text-[9px] font-black text-red-600 uppercase flex items-center gap-1">
                                                <AlertCircle size={10} /> {selectedTicket.recurrence}ª RECURRENCIA
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                                    <button
                                        onClick={() => setSelectedTicket(null)}
                                        className="flex-1 py-4 bg-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all"
                                    >
                                        Cerrar Panel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .html-content img {
                    max-width: 100% !important;
                    height: auto !important;
                    border-radius: 1.5rem;
                    margin: 1.5rem 0;
                    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
                    border: 4px solid white;
                }
                .html-content p {
                    margin-bottom: 0.75rem;
                }
                .html-content {
                    word-break: break-word;
                }
            `}</style>
        </div>
    );
}

function PlusIcon({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    );
}
