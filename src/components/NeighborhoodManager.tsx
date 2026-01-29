
import { useState, useEffect } from 'react';
import {
    X,
    Search,
    RefreshCcw,
    MapPin,
    Trash2,
    Save,
    Loader2,
    Map as MapIcon,
    CheckCircle2,
    Layers
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { WorkflowService } from '../lib/workflowService';
import clsx from 'clsx';

// Corregir iconos de Leaflet (problema común en bundles modernos)
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface Neighborhood {
    name: string;
    latitude: number;
    longitude: number;
    city?: string;
    updated_at?: string;
}

interface NeighborhoodManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

// Componente para manejar clics en el mapa
function LocationMarker({ position, setPosition }: { position: [number, number], setPosition: (pos: [number, number]) => void }) {
    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });

    return position ? (
        <Marker position={position} />
    ) : null;
}

// Componente para centrar el mapa cuando cambia la posición
function ChangeView({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
}

export function NeighborhoodManager({ isOpen, onClose }: NeighborhoodManagerProps) {
    const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNeighborhood, setSelectedNeighborhood] = useState<Neighborhood | null>(null);
    const [editMode, setEditMode] = useState(false);

    // Estados de edición
    const [editLat, setEditLat] = useState(0);
    const [editLng, setEditLng] = useState(0);
    const [saving, setSaving] = useState(false);

    // Estados de fusión
    const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchNeighborhoods();
        }
    }, [isOpen]);

    const fetchNeighborhoods = async () => {
        setLoading(true);
        try {
            const data = await WorkflowService.getAllNeighborhoods();
            setNeighborhoods(data || []);
        } catch (error) {
            console.error('Error fetching neighborhoods:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        if (!confirm('¿Deseas sincronizar los barrios desde la lista de clientes? Esto detectará barrios nuevos pero no sobreescribirá los ya geolocalizados.')) return;

        setSyncing(true);
        try {
            const result = await WorkflowService.syncNeighborhoodsWithClients();
            if (result.success) {
                alert(`Sincronización completada. Se detectaron ${result.count} barrios nuevos.`);
                fetchNeighborhoods();
            }
        } catch (error) {
            console.error('Error syncing:', error);
            alert('Error al sincronizar.');
        } finally {
            setSyncing(false);
        }
    };

    const handleSelect = (n: Neighborhood) => {
        setSelectedNeighborhood(n);
        setEditLat(n.latitude || 10.9685); // Default Barranquilla/Soledad area if 0
        setEditLng(n.longitude || -74.7813);
        setEditMode(false);
    };

    const handleSave = async () => {
        if (!selectedNeighborhood) return;
        setSaving(true);
        try {
            const success = await WorkflowService.saveNeighborhoodGeoref({
                name: selectedNeighborhood.name,
                latitude: editLat,
                longitude: editLng,
                city: selectedNeighborhood.city
            });
            if (success) {
                setSelectedNeighborhood({
                    ...selectedNeighborhood,
                    latitude: editLat,
                    longitude: editLng
                });
                setEditMode(false);
                fetchNeighborhoods();
            }
        } catch (error) {
            console.error('Error saving:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (name: string) => {
        if (!confirm(`¿Estás seguro de eliminar el barrio "${name}"?`)) return;
        try {
            const success = await WorkflowService.deleteNeighborhood(name);
            if (success) {
                if (selectedNeighborhood?.name === name) setSelectedNeighborhood(null);
                setSelectedForMerge(prev => prev.filter(n => n !== name));
                fetchNeighborhoods();
            }
        } catch (error) {
            console.error('Error deleting:', error);
        }
    };

    const handleMerge = async () => {
        if (selectedForMerge.length < 2) return;
        const masterName = selectedForMerge[0];
        const aliases = selectedForMerge.slice(1);

        if (!confirm(`¿Deseas fusionar ${aliases.length} barrios en "${masterName}"? Los barrios secundarios serán eliminados.`)) return;

        setSaving(true);
        try {
            for (const alias of aliases) {
                await WorkflowService.deleteNeighborhood(alias);
            }
            alert('Fusión completada con éxito.');
            setSelectedForMerge([]);
            setSelectedNeighborhood(null);
            fetchNeighborhoods();
        } catch (error) {
            console.error('Error merging:', error);
            alert('Error parcial durante la fusión.');
        } finally {
            setSaving(false);
        }
    };

    const toggleMergeSelection = (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedForMerge(prev =>
            prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
        );
    };

    const filtered = neighborhoods.filter(n =>
        n.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 md:p-8">
            <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-white/20">
                {/* Header */}
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                            <MapIcon size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Gestor de barrios geolocalizados</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Normalización y control logístico de zonas</p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel: List */}
                    <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
                        <div className="p-4 space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar barrio..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all font-medium"
                                />
                            </div>

                            <button
                                onClick={handleSync}
                                disabled={syncing}
                                className="w-full py-2.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 hover:bg-blue-100 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                                {syncing ? 'Sincronizando...' : 'Sincronizar Clientes'}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar">
                            {loading ? (
                                <div className="py-20 text-center space-y-3">
                                    <Loader2 className="mx-auto text-blue-900 animate-spin" size={32} />
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Cargando catálogo...</p>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="py-20 text-center px-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">No hay barrios encontrados</p>
                                </div>
                            ) : (
                                filtered.map(n => (
                                    <div key={n.name} className="relative group">
                                        <button
                                            onClick={() => handleSelect(n)}
                                            className={clsx(
                                                "w-full p-4 rounded-2xl border transition-all text-left flex items-start gap-3 relative overflow-hidden",
                                                selectedNeighborhood?.name === n.name
                                                    ? "bg-white border-blue-200 shadow-md transform scale-[1.02]"
                                                    : "bg-white border-slate-100 hover:border-slate-300",
                                                selectedForMerge.includes(n.name) && "ring-2 ring-blue-500 ring-offset-2"
                                            )}
                                        >
                                            <div className={clsx(
                                                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                                n.latitude && n.longitude && n.latitude !== 0
                                                    ? "bg-emerald-50 text-emerald-600"
                                                    : "bg-amber-50 text-amber-600"
                                            )}>
                                                <MapPin size={16} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-slate-800 uppercase truncate">{n.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">
                                                    {n.latitude && n.longitude && n.latitude !== 0 ? 'Geolocalizado' : 'Pendiente Coordenadas'}
                                                </p>
                                            </div>
                                            {selectedNeighborhood?.name === n.name && (
                                                <div className="absolute top-0 right-0 h-full w-1 bg-blue-900" />
                                            )}
                                        </button>

                                        {/* Checkbox de fusión */}
                                        <button
                                            onClick={(e) => toggleMergeSelection(n.name, e)}
                                            className={clsx(
                                                "absolute top-2 right-2 w-5 h-5 rounded-md border flex items-center justify-center transition-all z-20",
                                                selectedForMerge.includes(n.name)
                                                    ? "bg-blue-600 border-blue-600 text-white"
                                                    : "bg-white/80 border-slate-300 opacity-0 group-hover:opacity-100"
                                            )}
                                        >
                                            {selectedForMerge.includes(n.name) && <Layers size={10} />}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Merge Actions Bar */}
                        {selectedForMerge.length > 1 && (
                            <div className="p-4 bg-blue-900 text-white animate-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col gap-2">
                                    <p className="text-[10px] font-black uppercase text-blue-200">Fusionar Selección ({selectedForMerge.length})</p>
                                    <button
                                        onClick={handleMerge}
                                        className="w-full py-2 bg-white text-blue-900 rounded-lg text-[10px] font-black uppercase hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Layers size={14} /> Fusionar en "{selectedForMerge[0]}"
                                    </button>
                                    <button
                                        onClick={() => setSelectedForMerge([])}
                                        className="text-[9px] font-bold text-blue-300 uppercase hover:text-white transition-colors"
                                    >
                                        Cancelar Selección
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Map / Editor */}
                    <div className="flex-1 flex flex-col relative">
                        {selectedNeighborhood ? (
                            <>
                                {/* Map */}
                                <div className="flex-1 relative z-10">
                                    <MapContainer
                                        center={[editLat || 10.9685, editLng || -74.7813]}
                                        zoom={14}
                                        style={{ height: '100%', width: '100%' }}
                                    >
                                        <TileLayer
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        />
                                        <LocationMarker position={[editLat, editLng]} setPosition={(pos) => {
                                            setEditLat(pos[0]);
                                            setEditLng(pos[1]);
                                            setEditMode(true);
                                        }} />
                                        <ChangeView center={[editLat, editLng]} />
                                    </MapContainer>

                                    {/* Overlay Info */}
                                    <div className="absolute top-6 left-6 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-slate-200 max-w-xs transition-all animate-in fade-in slide-in-from-top-4 duration-300">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 bg-blue-900 rounded-xl flex items-center justify-center text-white">
                                                <MapPin size={20} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-900 uppercase leading-none">{selectedNeighborhood.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{selectedNeighborhood.city || 'Ciudad Detectada'}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                                                <span>Latitud</span>
                                                <span className="text-slate-900">{editLat.toFixed(6)}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                                                <span>Longitud</span>
                                                <span className="text-slate-900">{editLng.toFixed(6)}</span>
                                            </div>
                                        </div>

                                        {editMode ? (
                                            <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                                                <button
                                                    onClick={() => setEditMode(false)}
                                                    className="flex-1 py-2 rounded-lg text-[9px] font-black uppercase bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={handleSave}
                                                    disabled={saving}
                                                    className="flex-1 py-2 rounded-lg text-[9px] font-black uppercase bg-blue-900 text-white hover:bg-blue-800 shadow-md shadow-blue-900/10 transition-all flex items-center justify-center gap-1"
                                                >
                                                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                    {saving ? 'Guardando' : 'Guardar'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="mt-4 pt-4 border-t border-slate-100 italic text-[9px] text-slate-400 font-bold text-center">
                                                Haz clic en el mapa para ajustar la ubicación
                                            </div>
                                        )}
                                    </div>

                                    {/* Action FABs */}
                                    <div className="absolute top-6 right-6 z-[1000] flex flex-col gap-2">
                                        <button
                                            onClick={() => handleDelete(selectedNeighborhood.name)}
                                            className="p-3 bg-white text-red-500 rounded-2xl shadow-xl hover:bg-red-50 transition-all border border-slate-100"
                                            title="Eliminar Barrio"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50/50 text-center">
                                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-6">
                                    <MapIcon size={48} />
                                </div>
                                <h3 className="text-sm font-black text-slate-900 uppercase">Selecciona un barrio del listado</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase mt-2 max-w-xs leading-relaxed">
                                    Para geolocalizarlo en el mapa o sincronizar los clientes desde WispHub.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Info */}
                <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-between items-center">
                    <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-black text-slate-500 uppercase">Geolocalizados: {neighborhoods.filter(n => n.latitude && n.latitude !== 0).length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-[10px] font-black text-slate-500 uppercase">Pendientes: {neighborhoods.filter(n => !n.latitude || n.latitude === 0).length}</span>
                        </div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
                        <CheckCircle2 size={12} /> Sincronización Automática Activa con Clientes WispHub
                    </div>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
                .leaflet-container {
                    cursor: crosshair !important;
                }
            `}</style>
        </div>
    );
}

