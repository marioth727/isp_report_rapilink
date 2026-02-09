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
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
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
    const [detailLoading, setDetailLoading] = useState<boolean>(false);
    const [mapFilter, setMapFilter] = useState<string | null>(null);
    const [failureAnalytics, setFailureAnalytics] = useState<Record<string, { count: number, lat: number, lng: number }>>({});
    const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    // Helper para fecha local (MOVIDO ARRIBA PARA EVITAR LINT ERRORS)
    const getLocalToday = useCallback(() => {
        return new Date().toLocaleDateString('en-CA');
    }, []);

    const [activeView, setActiveView] = useState<'dispatch' | 'timeline'>('dispatch');

    // MANIFIESTO DE DESPACHO V3: Persistencia de asignación diaria
    const [dispatchManifest, setDispatchManifest] = useState<Record<string, string>>({});
    const [enrichedCompleted, setEnrichedCompleted] = useState<any[]>([]);
    const [isEnriching, setIsEnriching] = useState(false);

    // Filtros Operativos
    const [filterTechId, setFilterTechId] = useState<string>('all');
    const [showInstallations, setShowInstallations] = useState<boolean>(false);
    const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
    const [failureAnalytics, setFailureAnalytics] = useState<Record<string, { count: number, lat: number, lng: number }>>({});
    const [selectedDate, setSelectedDate] = useState<string>(getLocalToday());

    // Ref para control del mapa (RESTAURADO)
    const mapRef = useRef<L.Map | null>(null);

    // SWR HOOKS
    const { data: techList } = useSWR('platform-users', () => WorkflowService.getPlatformUsers());
    const { data: rawTickets, mutate: mutateTickets, error: ticketsError } = useSWR('wisphub-operational-tickets',
        () => WisphubService.getAllTickets({ status: '1,5' }), // Incluimos Rezagados (5)
        { refreshInterval: 60000, revalidateOnFocus: true }
    );
    const { data: inProgressTickets } = useSWR('wisphub-in-progress-tickets',
        () => WisphubService.getAllTickets({ status: '2' }),
        { refreshInterval: 60000, revalidateOnFocus: true }
    );
    const { data: completedTicketsRaw } = useSWR('wisphub-completed-tickets',
        () => WisphubService.getAllTickets({ status: '3,4' }),
        { refreshInterval: 60000, revalidateOnFocus: true }
    );

    const technicians = useMemo(() => {
        if (!techList) return [];
        return techList.filter(u => u.is_field_tech === true);
    }, [techList]);

    const isTodayResilient = useCallback((dateStr: string | null | undefined) => {
        if (!dateStr) return false;

        try {
            let date: Date;
            if (dateStr.includes('/') || dateStr.includes('-')) {
                const parts = dateStr.split(/[\/\s-:]/);
                if (parts.length >= 3) {
                    const p0 = parseInt(parts[0]);
                    const p1 = parseInt(parts[1]);
                    const p2 = parseInt(parts[2]);
                    const h = parts[3] ? parseInt(parts[3]) : 0;
                    const m = parts[4] ? parseInt(parts[4]) : 0;

                    if (p0 > 12) {
                        date = new Date(p2, p1 - 1, p0, h, m);
                    } else if (p1 > 12) {
                        date = new Date(p2, p0 - 1, p1, h, m);
                    } else {
                        // Por defecto tratar como MM/DD (Formato API WispHub US)
                        date = new Date(p2, p0 - 1, p1, h, m);
                    }
                } else {
                    date = new Date(dateStr);
                }
            } else {
                date = new Date(dateStr);
            }

            if (isNaN(date.getTime())) return false;

            // AJUSTE CRÍTICO: Restar 5 horas para normalizar el desfase UTC de la API
            const normalizedDate = new Date(date.getTime() - (5 * 60 * 60 * 1000));
            const y = normalizedDate.getFullYear();
            const mo = String(normalizedDate.getMonth() + 1).padStart(2, '0');
            const d = String(normalizedDate.getDate()).padStart(2, '0');
            const normalizedISO = `${y}-${mo}-${d}`;

            return normalizedISO === selectedDate;
        } catch (e) {
            return false;
        }
    }, [selectedDate]);

    const completedToday = useMemo(() => {
        if (!completedTicketsRaw) return [];
        return completedTicketsRaw.filter(t => isTodayResilient(t.fecha_final || t.fecha_fin || t.fecha_termino));
    }, [completedTicketsRaw, isTodayResilient]);

    // Lógica de Persistencia de Manifiesto
    useEffect(() => {
        const stored = localStorage.getItem(`dispatch_manifest_${selectedDate}`);
        if (stored) {
            try {
                const { date, manifest } = JSON.parse(stored);
                if (date === selectedDate) setDispatchManifest(manifest || {});
                else setDispatchManifest({});
            } catch (e) {
                setDispatchManifest({});
            }
        } else {
            setDispatchManifest({});
        }
    }, [selectedDate]);

    const saveManualDispatch = useCallback((newManifestEntries: Record<string, string>, dateStr?: string) => {
        const date = dateStr || getLocalToday();
        setDispatchManifest(prev => {
            const next = { ...prev, ...newManifestEntries };
            localStorage.setItem(`dispatch_manifest_${date}`, JSON.stringify({ date, manifest: next }));
            return next;
        });
    }, [getLocalToday]);

    // Carga de Borrador de Rutas
    useEffect(() => {
        const stored = localStorage.getItem('dispatch_draft_schedule_v1');
        if (stored) {
            try {
                const { date, routes } = JSON.parse(stored);
                if (date === getLocalToday()) setAssignedRoutes(routes);
            } catch (e) { }
        }
    }, [getLocalToday]);

    // Procesamiento de Tickets (Abiertos y En Progreso para el Pool)
    useEffect(() => {
        if (techList !== undefined && rawTickets !== undefined && inProgressTickets !== undefined) {
            const combined = [...(rawTickets || []), ...(inProgressTickets || [])];
            processTickets(combined);
        }
    }, [rawTickets, inProgressTickets, techList]);

    const processTickets = async (allTickets: any[]) => {
        setTickets(allTickets.map(t => ({ ...t, barrio: t.barrio || 'Cargando...', score: 0 })));
        setLoading(false);
        try {
            // Obtener todos los IDs que ya están en las rutas para no duplicarlos en el POOL
            const assignedIds = new Set(Object.values(assignedRoutes).flat().map(t => t.id));

            const enriched = await Promise.all(allTickets.map(async (t) => {
                const score = await WorkflowService.calculateDispatchScore(t);
                const barrio = t.barrio || t.servicio_completo?.barrio || t.servicio_completo?.localidad || 'Sin Barrio';
                const recurrence = await WorkflowService.getClientRecurrence(t.servicio, new Date().getFullYear(), new Date().getMonth() + 1);
                return { ...t, barrio, score, recurrence, tecnico_actual: t.nombre_tecnico || 'Sin Asignar' };
            }));

            // El POOL solo debe mostrar tickets que NO están asignados a ningún técnico en la App
            const poolTickets = enriched.filter(t => !assignedIds.has(t.id));
            const sorted = poolTickets.sort((a, b) => b.score - a.score);
            setTickets(sorted);

            // ANALÍTICA DE FALLAS PARA MAPA DE CALOR
            const failureKeywords = ['falla', 'sin internet', 'lento', 'corte', 'intermitente', 'rojo', 'señal', 'soporte'];
            const failures = enriched.filter(t =>
                failureKeywords.some(kw => t.asunto.toLowerCase().includes(kw) || t.descripcion?.toLowerCase().includes(kw))
            );

            // Agrupar fallas por barrio para el mapa de calor
            const failureGroups: Record<string, { count: number; lat: number; lng: number }> = {};
            failures.forEach(f => {
                const b = f.barrio || 'Sin Barrio';
                if (!failureGroups[b]) {
                    // Buscar coordenadas base para el barrio
                    const base = enriched.find(t => t.barrio === b && t.latitud && t.longitud);
                    failureGroups[b] = {
                        count: 0,
                        lat: base ? parseFloat(base.latitud!) : 7.12539,
                        lng: base ? parseFloat(base.longitud!) : -73.1198
                    };
                }
                failureGroups[b].count++;
            });
            setFailureAnalytics(failureGroups);

            // Sincronizar assignedRoutes con datos frescos de WispHub (Filtro Anti-Fantasmas)
            // Si un ticket en las rutas ya no viene en los datos de WispHub (porque se cerró), lo quitamos.
            const allValidTicketsMap = new Map(enriched.map(t => [String(t.id), t]));
            setAssignedRoutes(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(techId => {
                    next[techId] = (next[techId] || [])
                        .map(t => allValidTicketsMap.get(String(t.id)) || t) // Refrescar datos por si cambió algo
                        .filter(t => allValidTicketsMap.has(String(t.id))); // Eliminar si ya no existe en WispHub
                });
                return next;
            });

            // Inicializar rutas si están vacías (Lienzo limpio) 
            if (Object.keys(assignedRoutes).length === 0 && technicians.length > 0) {
                const initRoutes: Record<string, DispatchTicket[]> = {};
                technicians.forEach(tech => { initRoutes[tech.id] = []; });
                setAssignedRoutes(initRoutes);
            }

            // GeoRef
            const uniqueBarrios = Array.from(new Set(poolTickets.map(t => t.barrio)));
            for (const b of uniqueBarrios) {
                if (!neighborhoods[b]) {
                    WorkflowService.getNeighborhoodGeoref(b).then(ref => {
                        if (ref) setNeighborhoods(prev => ({ ...prev, [b]: ref }));
                    });
                }
            }
        } catch (e) { }
    };

    // Filtro para Vista de Despacho (Pool)
    const filteredTickets = useMemo(() => {
        // Obtenemos los IDs asignados actualizados
        const assignedIds = new Set(Object.values(assignedRoutes).flat().map(t => t.id));

        return tickets
            .filter(t => !assignedIds.has(t.id)) // Doble filtro de seguridad para el pool
            .filter(t => {
                const matchesSearch = !searchQuery || normalize(t.nombre_cliente).includes(normalize(searchQuery)) || normalize(t.barrio).includes(normalize(searchQuery));
                const selectedTech = technicians.find(tech => tech.id === filterTechId);
                const matchesTech = filterTechId === 'all' || (selectedTech?.full_name && t.tecnico_actual && normalize(t.tecnico_actual).includes(normalize(selectedTech.full_name)));
                const isInstallationTech = t.tecnico_actual && (normalize(t.tecnico_actual).includes('instalaciones@rapilink-sas') || normalize(t.tecnico_actual).includes('instalaciones'));
                const matchesInstall = !showInstallations || isInstallationTech;
                const matchesMap = !mapFilter || t.barrio === mapFilter;
                return matchesSearch && matchesTech && matchesInstall && matchesMap;
            });
    }, [tickets, assignedRoutes, searchQuery, filterTechId, showInstallations, mapFilter, technicians]);

    const ticketsByNeighborhood = useMemo(() => {
        return filteredTickets.reduce((acc, t) => {
            if (!t.barrio || t.barrio === 'Sin Barrio') return acc;
            if (!acc[t.barrio]) acc[t.barrio] = [];
            acc[t.barrio].push(t);
            return acc;
        }, {} as Record<string, DispatchTicket[]>);
    }, [filteredTickets]);

    // Carga Profunda (Timeline)
    useEffect(() => {
        if (activeView === 'timeline' && completedToday.length > 0 && !isEnriching) {
            const enrich = async () => {
                setIsEnriching(true);
                const enriched = [];
                const toProcess = completedToday.slice(0, 30);
                for (const t of toProcess) {
                    try {
                        const detail = await WisphubService.getTicketDetail(t.id);
                        enriched.push({ ...t, ...detail });
                    } catch (e) { enriched.push(t); }
                }
                setEnrichedCompleted(enriched);
                setIsEnriching(false);
            };
            enrich();
        }
    }, [activeView, completedToday.length]);

    // Iconos de Leaflet
    useEffect(() => {
        const DefaultIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        });
        L.Marker.prototype.options.icon = DefaultIcon;
    }, []);

    const onDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;
        let movedItem: DispatchTicket | undefined;
        if (source.droppableId === 'unassigned') {
            movedItem = tickets.find(t => t.id === draggableId);
        } else {
            movedItem = assignedRoutes[source.droppableId]?.find(t => t.id === draggableId);
        }
        if (!movedItem) return;
        if (source.droppableId === 'unassigned') {
            setTickets(prev => prev.filter(t => t.id !== draggableId));
        } else {
            setAssignedRoutes(prev => ({ ...prev, [source.droppableId]: prev[source.droppableId].filter(t => t.id !== draggableId) }));
        }
        if (destination.droppableId === 'unassigned') {
            setTickets(prev => [...prev, movedItem!]);
        } else {
            setAssignedRoutes(prev => ({ ...prev, [destination.droppableId]: [...(prev[destination.droppableId] || []), movedItem!] }));
        }
    };

    const handlePublish = async () => {
        const total = Object.values(assignedRoutes).flat().length;
        if (total === 0 || !confirm(`¿Deseas publicar ${total} tickets?`)) return;
        setLoading(true);
        try {
            const manifestEntries: Record<string, string> = {};
            for (const [techId, routeTickets] of Object.entries(assignedRoutes)) {
                if (routeTickets.length === 0) continue;
                const technician = technicians.find(t => t.id === techId);
                for (const ticket of routeTickets) {
                    await WorkflowService.changeWispHubTechnician(ticket.id, techId);
                    if (technician) manifestEntries[ticket.id] = technician.full_name;
                }
            }
            saveManualDispatch(manifestEntries);
            mutateTickets();
            alert('¡Despacho Publicado!');
        } catch (e) {
            alert('Error al publicar despacho.');
        } finally { setLoading(false); }
    };

    const calculateBounds = useCallback(() => {
        const visible = filteredTickets.filter(t => neighborhoods[t.barrio]?.latitude);
        if (visible.length === 0) return null;
        return L.latLngBounds(visible.map(t => [Number(neighborhoods[t.barrio].latitude), Number(neighborhoods[t.barrio].longitude)]));
    }, [filteredTickets, neighborhoods]);

    useEffect(() => {
        if (!mapRef.current || activeView !== 'dispatch') return;
        const bounds = calculateBounds();
        if (bounds) mapRef.current.flyToBounds(bounds, { padding: [50, 50] });
    }, [calculateBounds, activeView]);

    const loadTicketDetail = async (id: string) => {
        setDetailLoading(true);
        try {
            const detail = await WisphubService.getTicketDetail(id);
            if (detail && selectedTicket?.id === id) {
                setSelectedTicket({ ...selectedTicket, ...detail });
            }
        } catch (e) { } finally { setDetailLoading(false); }
    };
    useEffect(() => { if (selectedTicket && !selectedTicket.creado_por) loadTicketDetail(selectedTicket.id); }, [selectedTicket?.id]);

    if ((loading || !rawTickets || !techList) && !ticketsError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sincronizando Sistema...</p>
            </div>
        );
    }

    if (ticketsError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 border-2 border-dashed border-destructive/20 rounded-[2rem] bg-destructive/5 text-center">
                <AlertCircle className="w-12 h-12 text-destructive" />
                <button onClick={() => mutateTickets()} className="bg-destructive text-white px-6 py-2 rounded-xl font-black uppercase text-xs">Reintentar Conexión</button>
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

                                {showHeatmap && Object.entries(failureAnalytics).map(([bName, data]) => (
                                    <Circle
                                        key={`heat-${bName}`}
                                        center={[data.lat, data.lng]}
                                        radius={200 + (data.count * 100)}
                                        pathOptions={{
                                            fillColor: data.count > 4 ? '#ef4444' : data.count > 2 ? '#f97316' : '#eab308',
                                            color: 'transparent',
                                            fillOpacity: 0.4
                                        }}
                                    >
                                        <Popup>
                                            <div className="p-1 text-center">
                                                <p className="text-[10px] font-black uppercase text-red-600">{bName}</p>
                                                <p className="text-[9px] font-bold">Fallas Técnicas: {data.count}</p>
                                            </div>
                                        </Popup>
                                    </Circle>
                                ))}
                            </MapContainer>
                        ) : (
                            <div className="w-full h-full overflow-y-auto custom-scrollbar pt-40 px-6 bg-slate-50">
                                <OperationalTimeline
                                    // Solo pasamos tickets que están en el Borrador (assignedRoutes) 
                                    // o que ya fueron despachados hoy (dispatchManifest)
                                    // Inyectamos _assignedTechId para que el Timeline sepa a quién pertenecen
                                    tickets={[
                                        ...Object.entries(assignedRoutes).flatMap(([techId, routes]) =>
                                            routes.map(t => ({ ...t, _assignedTechId: techId }))
                                        ),
                                        ...(tickets
                                            .filter(t => dispatchManifest[String(t.id)] && !Object.values(assignedRoutes).flat().some(at => String(at.id) === String(t.id)))
                                            .map(t => {
                                                const techName = dispatchManifest[String(t.id)];
                                                const tech = technicians.find(ft => ft.full_name === techName);
                                                return { ...t, _assignedTechId: tech?.id };
                                            })
                                        ),
                                        // FALLBACK DE SEGURIDAD: Tickets que están en el manifiesto pero WispHub
                                        // aún no los reporta ni en activos ni en completados (Transición)
                                        ...Object.keys(dispatchManifest)
                                            .filter(id => {
                                                const isInActive = tickets.some(t => String(t.id) === id);
                                                const isInCompleted = (enrichedCompleted.length > 0 ? enrichedCompleted : completedToday).some(t => String(t.id) === id);
                                                const isInRoute = Object.values(assignedRoutes).flat().some(at => String(at.id) === id);
                                                return !isInActive && !isInCompleted && !isInRoute;
                                            })
                                            .map(id => {
                                                const techName = dispatchManifest[id];
                                                const tech = technicians.find(ft => ft.full_name === techName);
                                                return {
                                                    id,
                                                    nombre_cliente: 'Actualizando WispHub...',
                                                    barrio: '...',
                                                    asunto: 'Sincronizando estado',
                                                    _assignedTechId: tech?.id,
                                                    _forceTimeline: true
                                                };
                                            })
                                    ]}
                                    fieldTechnicians={technicians}
                                    // En progreso solo lo que nosotros despachamos hoy
                                    inProgressTickets={(inProgressTickets || [])
                                        .filter(t => dispatchManifest[String(t.id)] || Object.values(assignedRoutes).flat().some(at => String(at.id) === String(t.id)))
                                        .map(t => {
                                            const techIdFromRoute = Object.entries(assignedRoutes).find(([_, routes]) => routes.some(at => String(at.id) === String(t.id)))?.[0];
                                            const techName = dispatchManifest[String(t.id)];
                                            const techFromManifest = technicians.find(ft => ft.full_name === techName);
                                            return { ...t, _assignedTechId: techIdFromRoute || techFromManifest?.id };
                                        })
                                    }
                                    // Completados solo lo que nosotros despachamos hoy
                                    // Agregamos una capa de seguridad: si el ticket está en el manifiesto pero no aparece aún en completados ni en activos,
                                    // es que está en proceso de cierre o transición.
                                    completedTickets={[
                                        ...(enrichedCompleted.length > 0 ? enrichedCompleted : completedToday)
                                            .filter(t => dispatchManifest[String(t.id)])
                                            .map(t => {
                                                const techName = dispatchManifest[String(t.id)];
                                                const tech = technicians.find(ft => ft.full_name === techName);
                                                return { ...t, _assignedTechId: tech?.id };
                                            })
                                    ]}
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
                        <div className="flex gap-2">
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
                                    onClick={() => setShowHeatmap(!showHeatmap)}
                                    className={clsx(
                                        "px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                                        showHeatmap ? "bg-red-500 text-white shadow-lg" : "bg-white/50 text-slate-500 hover:text-red-500"
                                    )}
                                >
                                    <div className={clsx("w-2 h-2 rounded-full", showHeatmap ? "bg-white animate-pulse" : "bg-red-500")} />
                                    Mapa de Calor
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

                            {activeView === 'timeline' && (
                                <div className="bg-white/80 backdrop-blur-xl p-1 rounded-2xl flex gap-1 pointer-events-auto border border-slate-200">
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="bg-transparent px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary outline-none"
                                    />
                                </div>
                            )}

                            <button
                                onClick={() => {
                                    if (confirm(`¿Cerrar Jornada de ${selectedDate}? Se limpiarán los borradores y el manifiesto local de este día.`)) {
                                        localStorage.removeItem('dispatch_draft_schedule_v1');
                                        localStorage.removeItem(`dispatch_manifest_${selectedDate}`);
                                        setAssignedRoutes({});
                                        setDispatchManifest({});
                                        window.location.reload();
                                    }
                                }}
                                title="Limpiar todo para empezar de cero"
                                className="bg-white/80 backdrop-blur-xl p-2 rounded-2xl border border-white/50 shadow-sm pointer-events-auto hover:bg-red-50 hover:text-red-500 transition-all text-slate-400"
                            >
                                <X size={20} />
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
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                const today = getLocalToday();
                                                localStorage.setItem('dispatch_draft_schedule_v1', JSON.stringify({
                                                    date: today,
                                                    routes: assignedRoutes
                                                }));
                                                alert('Borrador guardado localmente');
                                            }}
                                            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-slate-800 text-primary hover:bg-slate-700 border border-primary/20"
                                        >
                                            Borrador
                                        </button>
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
                                </div>

                                {/* LISTA DE TÉCNICOS */}
                                <div className="flex-1 bg-white/70 backdrop-blur-3xl p-5 rounded-[2.5rem] border border-white/50 shadow-[0_25px_50px_rgba(0,0,0,0.05)] overflow-hidden pointer-events-auto animate-in slide-in-from-right-8 duration-700 delay-200">
                                    <div className="flex flex-col gap-5 h-full">
                                        <div className="custom-scrollbar pr-2 flex-1 overflow-y-auto min-h-0 pl-1">
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

