import useSWR from 'swr';
import { useState, useEffect } from 'react';
import { WisphubService, type WispHubClient, type WispHubPlan } from '../lib/wisphub';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Phone, ArrowLeft, ArrowRight, Loader2, Filter, FileDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CRMInteraction } from '../types';
import * as XLSX from 'xlsx';

export function CampaignManager() {
    const navigate = useNavigate();
    const location = useLocation();

    // Initialize page from history state (return from interaction) or default to 1
    const [page, setPage] = useState(() => (location.state as any)?.page || 1);
    const [limit] = useState(20);

    // Filters
    const [filterPlan, setFilterPlan] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterManagement, setFilterManagement] = useState('all'); // all, pending, managed, sale
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSearch, setActiveSearch] = useState('');

    // plans data
    const [plans, setPlans] = useState<WispHubPlan[]>([]);

    // SWR Fetcher
    const fetcher = async ([p, l, fPlan, fStatus, q]: [number, number, string, string, string]) => {
        if (q) {
            const results = await WisphubService.searchClients(q);
            return { results, count: results.length };
        }
        return await WisphubService.getAllClients(p, l, {
            plan: fPlan,
            status: fStatus
        });
    };

    const { data, isValidating } = useSWR(
        [page, limit, filterPlan, filterStatus, activeSearch],
        fetcher,
        {
            revalidateOnFocus: false,
            keepPreviousData: true
        }
    );

    const clients = data?.results || [];
    const totalCount = data?.count || 0;

    // SWR for Interactions (Tags)
    const clientIds = clients.map(c => c.id_servicio).filter(Boolean);
    const { data: interactionsMap } = useSWR(
        clientIds.length > 0 ? ['crm_interactions', clientIds] : null,
        async ([_, ids]) => {
            const { data, error } = await supabase
                .from('crm_interactions')
                .select('*')
                .in('client_id', ids)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const map = new Map<number, CRMInteraction>();
            data?.forEach((interaction: any) => {
                if (interaction.client_id && !map.has(interaction.client_id)) {
                    map.set(interaction.client_id, interaction);
                }
            });
            return map;
        },
        {
            revalidateOnFocus: true, // Actualizar cuando el usuario vuelve a la tab
            dedupingInterval: 10000   // Evitar peticiones duplicadas en 10 segundos
        }
    );

    useEffect(() => {
        loadPlans();
    }, []);

    // Use stable map or empty map if loading
    const activeInteractions = interactionsMap || new Map<number, CRMInteraction>();

    const loadPlans = async () => {
        const fetchedPlans = await WisphubService.getInternetPlans();
        setPlans(fetchedPlans);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        setActiveSearch(searchQuery);
    };

    const handleFilterChange = (type: 'plan' | 'status', value: string) => {
        setPage(1);
        setActiveSearch(''); // Reset search when filtering
        setSearchQuery('');
        if (type === 'plan') setFilterPlan(value);
        if (type === 'status') setFilterStatus(value);
    };

    const handleManage = (client: WispHubClient) => {
        const interaction = activeInteractions.get(client.id_servicio);
        navigate('/gestion', {
            state: {
                selectedClient: client,
                previousInteraction: interaction,
                returnPage: page
            }
        });
    };

    const exportToExcel = () => {
        if (!clients.length) return;

        const csvData = clients.map(c => {
            const interaction = activeInteractions.get(c.id_servicio);
            return {
                Cliente: c.nombre,
                Cedula: c.cedula,
                Instalacion: c.fecha_instalacion ? c.fecha_instalacion.split(' ')[0] : 'N/A',
                Plan_Actual: c.plan_internet?.nombre || 'Sin Plan',
                Estado: c.estado,
                Saldo: c.saldo_total || 0,
                Ultima_Gestion: interaction ? `${new Date(interaction.created_at || '').toLocaleDateString()} - ${interaction.result}` : 'Sin gestión'
            };
        });

        const ws = XLSX.utils.json_to_sheet(csvData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Clientes Campaña");
        XLSX.writeFile(wb, `Campana_Clientes_Pagina_${page}.xlsx`);
    };

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black tracking-tight text-slate-900">Gestor de Campañas</h1>
                        {isValidating && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
                    </div>
                    <p className="text-slate-500 mt-1">Gestiona y contacta clientes de forma proactiva.</p>
                </div>
                <button
                    onClick={exportToExcel}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all text-sm font-bold shadow-sm"
                >
                    <FileDown size={16} className="text-blue-900" />
                    Exportar Página
                </button>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end md:items-center">

                {/* Search */}
                <form onSubmit={handleSearch} className="relative flex-1 w-full group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar cliente por nombre o cédula..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-500 transition-all placeholder:text-slate-400 text-slate-700"
                    />
                </form>

                {/* Plan Filter */}
                <div className="w-full md:w-48 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Plan</label>
                    <select
                        value={filterPlan}
                        onChange={(e) => handleFilterChange('plan', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    >
                        <option value="">Todos los Planes</option>
                        {plans.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                    </select>
                </div>

                {/* Status Filter */}
                <div className="w-full md:w-36 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Estado</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    >
                        <option value="">Todos</option>
                        <option value="1">Activo</option>
                        <option value="2">Suspendido</option>
                        <option value="3">Retirado</option>
                    </select>
                </div>

                {/* Management Filter */}
                <div className="w-full md:w-48 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                        <Filter className="w-3 h-3 text-blue-600" /> Gestión
                    </label>
                    <select
                        value={filterManagement}
                        onChange={(e) => setFilterManagement(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-blue-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    >
                        <option value="all">Todos</option>
                        <option value="pending">Sin Gestión (Hoy)</option>
                        <option value="tracking">En Seguimiento</option>
                        <option value="managed">Gestionados</option>
                        <option value="sale">Ventas (Verde)</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50/80 border-b border-slate-200">
                            <tr>
                                <th className="p-4 font-extrabold text-[10px] uppercase tracking-widest text-slate-500">Cliente</th>
                                <th className="p-4 font-extrabold text-[10px] uppercase tracking-widest text-slate-500">Cédula</th>
                                <th className="p-4 font-extrabold text-[10px] uppercase tracking-widest text-slate-500">Instalación</th>
                                <th className="p-4 font-extrabold text-[10px] uppercase tracking-widest text-slate-500">Plan Actual</th>
                                <th className="p-4 font-extrabold text-[10px] uppercase tracking-widest text-slate-500">Estado</th>
                                <th className="p-4 font-extrabold text-[10px] uppercase tracking-widest text-slate-500">Saldo</th>
                                <th className="p-4 font-extrabold text-[10px] uppercase tracking-widest text-slate-500 text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isValidating && clients.length === 0 ? (
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
                                        const interaction = activeInteractions.get(client.id_servicio);
                                        if (filterManagement === 'pending') return !interaction;
                                        if (filterManagement === 'tracking') return interaction?.result === 'Lo pensará';
                                        if (filterManagement === 'managed') return !!interaction;
                                        if (filterManagement === 'sale') return interaction?.result === 'Aceptó Migración';
                                        return true;
                                    })
                                    .map((client) => {
                                        const interaction = activeInteractions.get(client.id_servicio);
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
                                            <tr key={client.id_servicio} className="hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors group">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2.5 h-2.5 rounded-full ${statusDot} shadow-sm flex-shrink-0 ring-2 ring-white`} title={interaction ? `Última: ${interaction.result}` : 'Sin gestión'} />
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-800 group-hover:text-blue-900 transition-colors">{client.nombre}</span>
                                                            {interaction && (
                                                                <span className="text-[10px] font-medium text-slate-400 truncate max-w-[150px]">
                                                                    {new Date(interaction.created_at || '').toLocaleDateString()} - {interaction.result}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 font-medium text-slate-500">{client.cedula}</td>
                                                <td className="p-4 text-xs font-bold text-slate-400">
                                                    {client.fecha_instalacion ? client.fecha_instalacion.split(' ')[0] : 'N/A'}
                                                </td>
                                                <td className="p-4">
                                                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-[10px] font-black uppercase tracking-wide">
                                                        {client.plan_internet?.nombre || 'Sin Plan'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border ${client.estado === 'Activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                        client.estado === 'Suspendido' ? 'bg-red-50 text-red-700 border-red-100' :
                                                            'bg-slate-100 text-slate-600 border-slate-200'
                                                        }`}>
                                                        {client.estado}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-black text-slate-700">
                                                    {client.saldo_total ? `$ ${client.saldo_total.toLocaleString()}` : '$ 0'}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {interaction && interaction.result === 'Aceptó Migración' ? (
                                                        <span className="inline-flex items-center justify-end gap-1.5 text-emerald-600 font-extrabold text-[10px] px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                                                            Venta ✅
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleManage(client)}
                                                            className="bg-white border border-slate-200 text-slate-600 hover:text-blue-900 hover:border-blue-900 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2 ml-auto hover:bg-blue-50"
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
                            disabled={page === 1 || isValidating}
                            className="p-2 border rounded hover:bg-muted disabled:opacity-50"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setPage((p: number) => p + 1)}
                            disabled={isValidating || (page * limit >= totalCount)} // Correct last page check
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
