import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import {
    Search,
    Truck,
    AlertCircle,
    User,
    MapPin,
    Phone,
    FileText,
    X,
    Loader2,
    ExternalLink,
    ChevronDown,
    CloudUpload,
    CloudDownload
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';

// Componente Portal para evitar el recorte de los tickets durante el arrastre
const Portal = ({ children }: { children: React.ReactNode }) => {
    return createPortal(children, document.body);
};

// Función para crear marcadores personalizados con conteo
const createClusterIcon = (count: number) => {
    return L.divIcon({
        className: 'custom-cluster-icon',
        html: `
            <div class="relative flex items-center justify-center" style="width: 32px; height: 36px;">
                <div class="absolute top-0 w-8 h-8 bg-primary/20 rounded-full animate-ping"></div>
                <div class="relative w-8 h-8 bg-primary border-2 border-white rounded-full flex items-center justify-center shadow-xl">
                    <span class="text-[10px] font-black text-white">${count}</span>
                </div>
                <!-- Punta del marcador -->
                <div class="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rotate-45 border-r border-b border-white"></div>
            </div>
        `,
        iconSize: [32, 36],
        iconAnchor: [16, 36],
        popupAnchor: [0, -36]
    });
};
import { WorkflowService } from '../lib/workflowService';
import { WisphubService } from '../lib/wisphub';
import { OperationalTimeline } from './OperationalTimeline';
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
    latitud?: string;
    longitud?: string;
    // Campos de tracking (WispHub API)
    fecha_inicio?: string;
    fecha_fin?: string;
    estado?: string;
}

export function OperationsDispatch() {
    const [loading, setLoading] = useState(true);
    const [tickets, setTickets] = useState<DispatchTicket[]>([]);
    const [assignedRoutes, setAssignedRoutes] = useState<Record<string, DispatchTicket[]>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [neighborhoods, setNeighborhoods] = useState<Record<string, any>>({});
    const [selectedTicket, setSelectedTicket] = useState<DispatchTicket | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [mapFilter, setMapFilter] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<'dispatch' | 'timeline'>('dispatch');

    // Filtros Operativos
    const [filterTechId, setFilterTechId] = useState<string>('all');
    const [showInstallations, setShowInstallations] = useState<boolean>(false);

    // Ref para control del mapa
    const mapRef = useRef<L.Map | null>(null);

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


    // ==================== UTILIDADES DE FILTRADO ====================
    const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    // Tickets filtrados (usados en Lista y Mapa)
    const filteredTickets = useMemo(() => {
        return tickets.filter(t => {
            // Filtro por Buscador
            const matchesSearch = !searchQuery ||
                normalize(t.nombre_cliente).includes(normalize(searchQuery)) ||
                normalize(t.barrio).includes(normalize(searchQuery));

            // Filtro por Técnico (Dropdown) - Buscamos por nombre ya que WispHub devuelve nombres
            const selectedTech = technicians.find(tech => tech.id === filterTechId);
            const matchesTech = filterTechId === 'all' ||
                (selectedTech?.full_name && t.tecnico_actual && normalize(t.tecnico_actual).includes(normalize(selectedTech.full_name)));


            // Filtro por Instalación - Restringido al técnico de instalaciones según memoria técnica
            const isInstallationTech = t.tecnico_actual && (
                normalize(t.tecnico_actual).includes('instalaciones@rapilink-sas') ||
                normalize(t.tecnico_actual).includes('instalaciones')
            );
            const matchesInstall = !showInstallations || isInstallationTech;

            // Filtro por Mapa (Barrio seleccionado)
            const matchesMap = !mapFilter || t.barrio === mapFilter;

            return matchesSearch && matchesTech && matchesInstall && matchesMap;
        });
    }, [tickets, searchQuery, filterTechId, showInstallations, mapFilter, technicians]);

    // Agrupar tickets por barrio para el mapa
    const ticketsByNeighborhood = useMemo(() => {
        return filteredTickets.reduce((acc, t) => {
            if (!t.barrio || t.barrio === 'Sin Barrio') return acc;
            if (!acc[t.barrio]) acc[t.barrio] = [];
            acc[t.barrio].push(t);
            return acc;
        }, {} as Record<string, DispatchTicket[]>);
    }, [filteredTickets]);


    // ==================== ANIMACIÓN DE MAPA ====================
    const calculateBounds = useCallback(() => {
        const visibleMarkers = filteredTickets.filter(t =>
            neighborhoods[t.barrio]?.latitude && neighborhoods[t.barrio]?.longitude
        );

        if (visibleMarkers.length === 0) return null;

        const coords = visibleMarkers.map(t => [
            Number(neighborhoods[t.barrio].latitude),
            Number(neighborhoods[t.barrio].longitude)
        ] as [number, number]);

        return L.latLngBounds(coords);
    }, [filteredTickets, neighborhoods]);

    useEffect(() => {
        if (!mapRef.current || activeView !== 'dispatch') return; // Only adjust bounds if dispatch view is active
        const bounds = calculateBounds();
        if (bounds) {
            mapRef.current.flyToBounds(bounds, { padding: [50, 50], duration: 1 });
        }
    }, [calculateBounds, activeView]);


    // ==================== DRAG & DROP FIX ====================
    const onDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result;
        if (!destination) return;

        // Mismo lugar
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        // Buscar el ticket por ID
        let movedItem: DispatchTicket | undefined;
        if (source.droppableId === 'unassigned') {
            movedItem = tickets.find(t => t.id === draggableId);
        } else {
            movedItem = assignedRoutes[source.droppableId]?.find(t => t.id === draggableId);
        }

        if (!movedItem) {
            console.error('❌ [Drag] No se encontró el ticket:', draggableId);
            return;
        }

        // Remover del origen
        if (source.droppableId === 'unassigned') {
            setTickets(prev => prev.filter(t => t.id !== draggableId));
        } else {
            setAssignedRoutes(prev => ({
                ...prev,
                [source.droppableId]: prev[source.droppableId].filter(t => t.id !== draggableId)
            }));
        }

        // Agregar al destino
        if (destination.droppableId === 'unassigned') {
            setTickets(prev => [...prev, movedItem!]);
        } else {
            setAssignedRoutes(prev => ({
                ...prev,
                [destination.droppableId]: [...(prev[destination.droppableId] || []), movedItem!]
            }));
        }

        console.log(`✅ [Drag] Movido ${movedItem.nombre_cliente} a ${destination.droppableId}`);
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
        <div className="animate-in fade-in duration-700 h-full w-full overflow-hidden relative bg-slate-900">
            <DragDropContext onDragEnd={onDragEnd}>

                {/* CAPA 0: MAPA BASE (FULLSCREEN) */}
                <div className="absolute inset-0 z-0">
                    <div className="w-full h-full relative overflow-hidden">
                        {activeView === 'dispatch' ? (
                            <MapContainer
                                ref={mapRef}
                                center={[10.9685, -74.7813]} // Default center for Barranquilla
                                zoom={12}
                                style={{ height: '100%', width: '100%' }}
                                zoomControl={false}
                                className="z-0"
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                                />
                                {Object.entries(ticketsByNeighborhood).map(([bName, ticketsInNeighborhood]) => {
                                    const data = {
                                        count: ticketsInNeighborhood.length,
                                        lat: neighborhoods[bName]?.latitude,
                                        lng: neighborhoods[bName]?.longitude
                                    };
                                    if (!data.lat || !data.lng) return null;

                                    return (
                                        <Marker
                                            key={bName}
                                            position={[data.lat, data.lng]}
                                            icon={createClusterIcon(data.count)}
                                            eventHandlers={{
                                                click: () => setMapFilter(bName)
                                            }}
                                        >
                                            <Popup className="noc-popup">
                                                <div className="p-3 text-center min-w-[120px]">
                                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{bName}</p>
                                                    <div className="bg-primary/10 text-primary text-[10px] font-black py-2 px-3 rounded-xl border border-primary/20">
                                                        {data.count} Reportes activos
                                                    </div>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    );
                                })}
                            </MapContainer>
                        ) : (
                            <div className="w-full h-full overflow-y-auto custom-scrollbar pt-40 px-6 bg-slate-50">
                                <OperationalTimeline
                                    tickets={filteredTickets}
                                    fieldTechnicians={technicians}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* CAPA 1: OVERLAY DE WIDGETS */}
                <div className="absolute inset-0 z-10 p-3 md:p-4 pointer-events-none overflow-hidden">
                    {/* CAPA 1.1: ENCABEZADO FLOTANTE (CENTRAL) */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-3 w-full pointer-events-none">
                        <div className="bg-white/80 backdrop-blur-3xl px-10 py-4 rounded-[2.5rem] border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center gap-6 pointer-events-auto transition-all hover:shadow-[0_25px_60px_rgba(0,0,0,0.15)]">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">En Vivo</span>
                                </div>
                                <h1 className="text-3xl font-[1000] uppercase tracking-[-0.05em] text-slate-900 leading-none">
                                    Centro de Despacho
                                </h1>
                            </div>

                            {/* BENTO STATS INTEGRATED */}
                            <div className="flex items-center gap-6 pl-6 border-l border-slate-200">
                                <div className="text-center">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Barrios</p>
                                    <p className="text-xl font-black text-slate-800 tracking-tighter leading-none">{Object.keys(neighborhoods).length}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Tickets</p>
                                    <p className="text-xl font-black text-slate-800 tracking-tighter leading-none">{filteredTickets.length}</p>
                                </div>
                            </div>
                        </div>

                        {/* SELECTOR DE VISTA (TABS) */}
                        <div className="bg-slate-100/50 backdrop-blur-xl p-1 rounded-2xl flex gap-1 pointer-events-auto border border-slate-200">
                            <button
                                onClick={() => setActiveView('dispatch')}
                                className={clsx(
                                    "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    activeView === 'dispatch' ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                Mapa de Despacho
                            </button>
                            <button
                                onClick={() => setActiveView('timeline')}
                                className={clsx(
                                    "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    activeView === 'timeline' ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                Jornada Operativa
                            </button>
                        </div>
                    </div>

                    {/* CAPA 1.2: CONTENIDO DE DESPACHO (LATERALES) */}
                    {activeView === 'dispatch' && (
                        <div className="grid grid-cols-[280px_1fr_300px] gap-4 w-full h-full">
                            {/* Columna Izquierda: Control & Pool */}
                            <div className="flex flex-col gap-4 h-full overflow-hidden">
                                {/* Widget: Filtros Operativos */}
                                <div className="bg-white/70 backdrop-blur-3xl p-6 rounded-[2rem] border border-white/50 shadow-[0_20px_40px_rgba(0,0,0,0.05)] pointer-events-auto animate-in slide-in-from-left-8 duration-500">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-6 bg-primary rounded-full" />
                                            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">Filtros</h2>
                                        </div>
                                        <div className="px-2 py-1 bg-slate-100 rounded-lg">
                                            <span className="text-[10px] font-black text-slate-500">{filteredTickets.length} / {tickets.length}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-5">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <User size={10} /> Técnico Asignado
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={filterTechId}
                                                    onChange={(e) => setFilterTechId(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-primary/20 transition-all appearance-none pr-10"
                                                >
                                                    <option value="all">Todos los Técnicos</option>
                                                    {technicians.map(t => (
                                                        <option key={t.id} value={t.id}>{t.full_name}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200/50">
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        checked={showInstallations}
                                                        onChange={(e) => setShowInstallations(e.target.checked)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-primary transition-all duration-300"></div>
                                                    <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full peer-checked:translate-x-5 transition-all duration-300 shadow-sm"></div>
                                                </div>
                                                <span className="text-[10px] font-black uppercase text-slate-600 group-hover:text-primary transition-colors">Ver Instalaciones</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Widget: Pool de Tickets Pendientes */}
                                <div className="flex-1 flex flex-col min-h-0 bg-white/70 backdrop-blur-3xl rounded-[2.5rem] border border-white/50 shadow-[0_25px_50px_rgba(0,0,0,0.05)] overflow-hidden pointer-events-auto animate-in slide-in-from-left-8 duration-700 delay-150">
                                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-primary/10 rounded-xl">
                                                <Truck size={14} className="text-primary" />
                                            </div>
                                            <h2 className="text-xs font-black uppercase tracking-tight text-slate-800">Pool Pendientes</h2>
                                        </div>
                                    </div>

                                    <div className="px-5 py-4">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Buscar..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-[1.25rem] pl-12 pr-4 py-3 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-primary/20 transition-all border-dashed"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-6">
                                        <Droppable droppableId="unassigned">
                                            {(provided, snapshot) => (
                                                <div
                                                    {...provided.droppableProps}
                                                    ref={provided.innerRef}
                                                    className={clsx(
                                                        "min-h-[200px] transition-all duration-300 rounded-2xl",
                                                        snapshot.isDraggingOver ? "bg-primary/5 ring-2 ring-primary/20 ring-dashed" : "bg-transparent"
                                                    )}
                                                >
                                                    {filteredTickets.map((ticket, index) => (
                                                        <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                                                            {(provided, snapshot) => {
                                                                const content = (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        className={clsx(
                                                                            "group p-3 mb-2 rounded-xl transition-all border shadow-sm",
                                                                            snapshot.isDragging
                                                                                ? "bg-white shadow-[0_15px_30px_rgba(var(--primary-rgb),0.15)] border-primary ring-2 ring-primary/10 rotate-2 z-[9999] opacity-100 scale-105"
                                                                                : "bg-white border-slate-100 hover:border-primary/20 hover:shadow-md hover:-translate-y-0.5"
                                                                        )}
                                                                        onClick={() => setSelectedTicket(ticket)}
                                                                    >
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase">#{ticket.id}</div>
                                                                                {ticket.id_prioridad >= 4 && (
                                                                                    <div className="bg-red-50 text-red-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-red-100 uppercase">Muy Urgente</div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <h3 className="text-xs font-black text-slate-900 group-hover:text-primary transition-colors leading-tight mb-1">{ticket.nombre_cliente}</h3>
                                                                        <div className="flex items-center gap-1.5 text-slate-400">
                                                                            <MapPin size={10} className="text-primary/60" />
                                                                            <span className="text-[10px] font-bold uppercase tracking-tight truncate">{ticket.barrio}</span>
                                                                        </div>
                                                                        <div className="mt-2 pt-2 border-t border-slate-50">
                                                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{ticket.asunto}</span>
                                                                        </div>
                                                                    </div>
                                                                );

                                                                if (snapshot.isDragging) {
                                                                    return <Portal>{content}</Portal>;
                                                                }
                                                                return content;
                                                            }}
                                                        </Draggable>
                                                    ))}
                                                    {provided.placeholder}
                                                </div>
                                            )}
                                        </Droppable>
                                    </div>
                                </div>
                            </div>

                            <div className="relative min-w-0 h-full">
                                {/* WIDGET: BADGE DE FILTRO MAPA (BOTTOM CENTER) */}
                                {mapFilter && (
                                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-primary text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 pointer-events-auto animate-in slide-in-from-bottom-8 duration-500">
                                        <MapPin size={16} className="animate-bounce" />
                                        <span className="text-xs font-black uppercase tracking-widest">Barrio: {mapFilter}</span>
                                        <button
                                            onClick={() => setMapFilter(null)}
                                            className="bg-white/20 hover:bg-white/40 p-1.5 rounded-full transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* COLUMNA DERECHA: ASIGNACIÓN & TÉCNICOS */}
                            <div className="flex flex-col gap-4 h-full overflow-hidden">

                                {/* HEADER DE ASIGNACIÓN COMPACTO */}
                                <div className="bg-slate-900 px-6 py-4 rounded-[2rem] border border-white/10 shadow-2xl flex items-center justify-between pointer-events-auto">
                                    <div className="flex flex-col">
                                        <h2 className="text-sm font-black text-white uppercase tracking-tighter leading-none">Asignación</h2>
                                        <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-1">Hoy</span>
                                    </div>
                                    <button
                                        onClick={handlePublish}
                                        disabled={loading || Object.keys(assignedRoutes).length === 0}
                                        className={clsx(
                                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                                            loading || Object.keys(assignedRoutes).length === 0
                                                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
                                                : "bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 border border-primary/20"
                                        )}
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={12} /> : (
                                            <>
                                                <CloudUpload size={12} />
                                                <span>Publicar</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* LISTA DE TÉCNICOS */}
                                <div className="flex-1 bg-white/70 backdrop-blur-3xl p-5 rounded-[2.5rem] border border-white/50 shadow-[0_25px_50px_rgba(0,0,0,0.05)] overflow-hidden pointer-events-auto animate-in slide-in-from-right-8 duration-700 delay-200">
                                    <div className="flex flex-col gap-5 h-full">
                                        <div className="custom-scrollbar pr-2 flex-1">
                                            {technicians.map((tech) => (
                                                <div key={tech.id} className="mb-6">
                                                    <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50/80 transition-colors group cursor-default">
                                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
                                                            <User size={12} className="text-primary" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="text-[11px] font-bold text-slate-800 tracking-tight truncate border-b border-transparent group-hover:border-primary/20 transition-all">{tech.full_name}</h3>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 bg-slate-100 px-1.5 py-0.5 rounded-lg border border-slate-200/50">
                                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                            <span className="text-[9px] font-black text-slate-600">{(assignedRoutes[tech.id] || []).length}</span>
                                                        </div>
                                                    </div>

                                                    <Droppable droppableId={tech.id}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                {...provided.droppableProps}
                                                                ref={provided.innerRef}
                                                                className={clsx(
                                                                    "mt-1.5 min-h-[40px] transition-all duration-300 rounded-xl flex flex-col gap-1.5",
                                                                    snapshot.isDraggingOver ? "bg-primary/5 border border-primary/20 shadow-inner p-2" : "bg-transparent px-1 pb-2"
                                                                )}
                                                            >
                                                                {(assignedRoutes[tech.id] || []).map((ticket, index) => (
                                                                    <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                                                                        {(provided, snapshot) => {
                                                                            const content = (
                                                                                <div
                                                                                    ref={provided.innerRef}
                                                                                    {...provided.draggableProps}
                                                                                    {...provided.dragHandleProps}
                                                                                    className={clsx(
                                                                                        "group relative p-2 rounded-lg transition-all cursor-grab active:cursor-grabbing border",
                                                                                        snapshot.isDragging
                                                                                            ? "bg-white shadow-xl border-primary ring-2 ring-primary/20 scale-105 rotate-1 z-[9999] opacity-100"
                                                                                            : "bg-white border-slate-100 hover:border-primary/20 shadow-sm"
                                                                                    )}
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className="bg-slate-50 text-slate-400 text-[8px] font-black w-5 h-5 rounded flex items-center justify-center border border-slate-100">
                                                                                            {index + 1}
                                                                                        </div>
                                                                                        <div className="min-w-0 flex-1">
                                                                                            <h4 className="text-[10px] font-bold text-slate-700 tracking-tight group-hover:text-primary transition-colors truncate leading-tight">{ticket.nombre_cliente}</h4>
                                                                                            <div className="flex items-center gap-1">
                                                                                                <span className="text-[8px] font-black text-primary uppercase">#{ticket.id}</span>
                                                                                                <span className="text-[8px] font-medium text-slate-300">•</span>
                                                                                                <span className="text-[8px] font-bold text-slate-400 uppercase truncate">{ticket.barrio}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );

                                                                            if (snapshot.isDragging) {
                                                                                return <Portal>{content}</Portal>;
                                                                            }
                                                                            return content;
                                                                        }}
                                                                    </Draggable>
                                                                ))}
                                                                {provided.placeholder}
                                                                {(assignedRoutes[tech.id] || []).length === 0 && !snapshot.isDraggingOver && (
                                                                    <div className="py-4 text-center border-2 border-dashed border-slate-100 rounded-xl group-hover:border-primary/20 transition-colors">
                                                                        <div className="flex flex-col items-center gap-1">
                                                                            <CloudDownload size={10} className="text-slate-200" />
                                                                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Soltar</span>
                                                                        </div>
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
                            </div>
                        </div>
                    )}
                </div>
            </DragDropContext>

            {/* PANEL DE DETALLE (OVERLAY ABSOLUTO) */}
            {selectedTicket && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-end p-6 pointer-events-none">
                    <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto"
                        onClick={() => setSelectedTicket(null)}
                    />
                    <div className="relative w-full max-w-xl h-full bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-right-12 duration-500 pointer-events-auto">
                        {/* Header del Detalle */}
                        <div className="p-8 pb-4 flex justify-between items-start">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={clsx(
                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white",
                                        selectedTicket.id_prioridad >= 4 ? "bg-red-500" :
                                            selectedTicket.id_prioridad === 3 ? "bg-orange-500" : "bg-primary"
                                    )}>
                                        Ticket #{selectedTicket.id}
                                    </div>
                                    {selectedTicket.recurrence > 1 && (
                                        <div className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                            <AlertCircle size={10} /> Recurrente
                                        </div>
                                    )}
                                </div>
                                <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800 leading-none">
                                    {selectedTicket.nombre_cliente}
                                </h2>
                                <div className="flex flex-col gap-1 mt-1">
                                    {selectedTicket.cedula && (
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">C.C. {selectedTicket.cedula}</p>
                                    )}
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedTicket.asunto}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedTicket(null)}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-4">
                            <div className="space-y-8">
                                {/* Información Principal */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <MapPin size={12} className="text-primary" /> Sector / Barrio
                                        </p>
                                        <p className="text-sm font-black text-slate-700 uppercase leading-none">{selectedTicket.barrio || 'No especificado'}</p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-2 truncate">{selectedTicket.direccion}</p>
                                    </div>
                                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Phone size={12} className="text-emerald-500" /> Contacto Directo
                                        </p>
                                        <p className="text-sm font-black text-slate-700 leading-none">{selectedTicket.celular || selectedTicket.telefono || 'Sin teléfono'}</p>
                                        <div className="flex gap-2 mt-2">
                                            <a
                                                href={`tel:${selectedTicket.celular}`}
                                                className="text-[10px] font-black text-primary uppercase hover:underline"
                                            >
                                                Llamar ahora
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">

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
                            <div className="p-8 bg-white border-t border-slate-100 flex gap-4 mt-8 sticky bottom-0">
                                <button
                                    onClick={() => setSelectedTicket(null)}
                                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                                >
                                    Cerrar Detalles
                                </button>
                                <button
                                    onClick={() => window.open(`https://wisphub.net/tickets/${selectedTicket.id}/`, '_blank')}
                                    className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all"
                                >
                                    <ExternalLink size={18} />
                                </button>
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

