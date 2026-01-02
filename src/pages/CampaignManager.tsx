
import { useState, useEffect } from 'react';
import { WisphubService, type WispHubClient, type WispHubPlan } from '../lib/wisphub';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Phone, ArrowLeft, ArrowRight, Loader2, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CRMInteraction } from '../types';

export function CampaignManager() {
    const navigate = useNavigate();
    const location = useLocation(); // Hook to read state
    const [clients, setClients] = useState<WispHubClient[]>([]);
    const [loading, setLoading] = useState(false);

    // Initialize page from history state (return from interaction) or default to 1
    const [page, setPage] = useState(() => (location.state as any)?.page || 1);
    const [limit] = useState(20);
    const [totalCount, setTotalCount] = useState(0);

    // Filters
    const [filterPlan, setFilterPlan] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterManagement, setFilterManagement] = useState('all'); // all, pending, managed, sale

    // Interactions Data
    const [interactionsMap, setInteractionsMap] = useState<Map<number, CRMInteraction>>(new Map());

    const [plans, setPlans] = useState<WispHubPlan[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadPlans();
    }, []);

    useEffect(() => {
        setPage(1); // Reset page on filter change
        loadClients();
    }, [filterPlan, filterStatus]); // Reload when filters change

    useEffect(() => {
        loadClients();
    }, [page]);

    // Load interactions when clients list updates
    useEffect(() => {
        if (clients.length > 0) {
            const ids = clients.map(c => c.id_servicio).filter(Boolean);
            if (ids.length > 0) loadInteractions(ids);
        } else {
            setInteractionsMap(new Map());
        }
    }, [clients]);

    const loadInteractions = async (clientIds: number[]) => {
        // Fetch latest interaction for these clients
        const { data } = await supabase
            .from('crm_interactions')
            .select('*')
            .in('client_id', clientIds)
            .order('created_at', { ascending: false });

        if (data) {
            const map = new Map<number, CRMInteraction>();
            data.forEach((interaction: any) => {
                if (interaction.client_id && !map.has(interaction.client_id)) {
                    map.set(interaction.client_id, interaction);
                }
            });
            setInteractionsMap(map);
        }
    };

    const loadPlans = async () => {
        const fetchedPlans = await WisphubService.getInternetPlans();
        setPlans(fetchedPlans);
    };

    const loadClients = async () => {
        setLoading(true);
        try {
            const data = await WisphubService.getAllClients(page, limit, {
                plan: filterPlan,
                status: filterStatus
            });
            setClients(data.results);
            setTotalCount(data.count);
        } catch (error) {
            console.error("Error loading clients:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery) {
            setPage(1);
            loadClients();
            return;
        }

        setLoading(true);
        try {
            const results = await WisphubService.searchClients(searchQuery);
            setClients(results);
            setTotalCount(results.length);
            setPage(1);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleManage = (client: WispHubClient) => {
        const interaction = interactionsMap.get(client.id_servicio);
        // Pass current page to persist state on return
        navigate('/gestion', {
            state: {
                selectedClient: client,
                previousInteraction: interaction,
                returnPage: page
            }
        });
    };

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-primary">Gestor de Campañas</h1>
                    <p className="text-muted-foreground">Gestiona y contacta clientes de forma proactiva.</p>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-card p-4 rounded-lg border shadow-sm flex flex-col md:flex-row gap-4 items-end md:items-center">

                {/* Search */}
                <form onSubmit={handleSearch} className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar cliente por nombre o cédula..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 bg-background border rounded-md p-2 text-sm focus:ring-2 focus:ring-primary/50"
                    />
                </form>

                {/* Plan Filter */}
                <div className="w-full md:w-48 space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Plan</label>
                    <select
                        value={filterPlan}
                        onChange={(e) => setFilterPlan(e.target.value)}
                        className="w-full bg-background border rounded-md p-2 text-sm"
                    >
                        <option value="">Todos los Planes</option>
                        {plans.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                    </select>
                </div>

                {/* Status Filter */}
                <div className="w-full md:w-36 space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Estado</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full bg-background border rounded-md p-2 text-sm"
                    >
                        <option value="">Todos</option>
                        <option value="1">Activo</option>
                        <option value="2">Suspendido</option>
                        <option value="3">Retirado</option>
                    </select>
                </div>

                {/* Management Filter */}
                <div className="w-full md:w-40 space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <Filter className="w-3 h-3" /> Gestión
                    </label>
                    <select
                        value={filterManagement}
                        onChange={(e) => setFilterManagement(e.target.value)}
                        className="w-full bg-background border rounded-md p-2 text-sm font-medium text-indigo-700"
                    >
                        <option value="all">Todos</option>
                        <option value="pending">Sin Gestión (Hoy)</option>
                        <option value="tracking">En Seguimiento (Amarillo)</option>
                        <option value="managed">Gestionados</option>
                        <option value="sale">Ventas (Verde)</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground">
                            <tr>
                                <th className="p-4 font-medium">Cliente</th>
                                <th className="p-4 font-medium">Cédula</th>
                                <th className="p-4 font-medium">Instalación</th>
                                <th className="p-4 font-medium">Plan Actual</th>
                                <th className="p-4 font-medium">Estado</th>
                                <th className="p-4 font-medium">Saldo</th>
                                <th className="p-4 font-medium text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                            Cargando clientes...
                                        </div>
                                    </td>
                                </tr>
                            ) : clients.length > 0 ? (
                                clients
                                    .filter(client => {
                                        if (filterManagement === 'all') return true;
                                        const interaction = interactionsMap.get(client.id_servicio);
                                        if (filterManagement === 'pending') return !interaction;
                                        if (filterManagement === 'tracking') return interaction?.result === 'Lo pensará';
                                        if (filterManagement === 'managed') return !!interaction;
                                        if (filterManagement === 'sale') return interaction?.result === 'Aceptó Migración';
                                        return true;
                                    })
                                    .map((client) => {
                                        const interaction = interactionsMap.get(client.id_servicio);
                                        let statusDot = "bg-gray-300";

                                        if (interaction) {
                                            if (interaction.result === 'Aceptó Migración') {
                                                statusDot = "bg-green-500 animate-pulse";
                                            } else if (interaction.result === 'Lo pensará') {
                                                statusDot = "bg-yellow-500";
                                            } else {
                                                // Rejected / No answer
                                                statusDot = "bg-red-500";
                                            }
                                        }

                                        return (
                                            <tr key={client.id_servicio} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-3 h-3 rounded-full ${statusDot} shadow-sm flex-shrink-0`} title={interaction ? `Última: ${interaction.result}` : 'Sin gestión'} />
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{client.nombre}</span>
                                                            {interaction && (
                                                                <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                                                    {new Date(interaction.created_at || '').toLocaleDateString()} - {interaction.result}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-muted-foreground">{client.cedula}</td>
                                                <td className="p-4 text-xs text-muted-foreground">
                                                    {client.fecha_instalacion ? client.fecha_instalacion.split(' ')[0] : 'N/A'}
                                                </td>
                                                <td className="p-4">
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded text-xs font-semibold">
                                                        {client.plan_internet?.nombre || 'Sin Plan'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${client.estado === 'Activo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                                        client.estado === 'Suspendido' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {client.estado}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                                                    {client.saldo_total ? `$ ${client.saldo_total.toLocaleString()}` : '$ 0'}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {interaction && interaction.result === 'Aceptó Migración' ? (
                                                        <span className="flex items-center justify-end gap-1 text-green-600 font-bold text-xs px-3 py-1.5">
                                                            ✅ Venta
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleManage(client)}
                                                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-md text-xs font-bold shadow-sm transition-transform active:scale-95 flex items-center gap-2 ml-auto"
                                                        >
                                                            <Phone className="w-3 h-3" /> Gestionar
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                        No se encontraron clientes en esta página.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t bg-muted/20 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                        Mostrando {totalCount === 0 ? 0 : (page - 1) * limit + 1} - {Math.min(page * limit, totalCount)} de {totalCount} (Página {page})
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                            className="p-2 border rounded hover:bg-muted disabled:opacity-50"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setPage((p: number) => p + 1)}
                            disabled={loading || (page * limit >= totalCount)} // Correct last page check
                            className="p-2 border rounded hover:bg-muted disabled:opacity-50"
                        >
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
