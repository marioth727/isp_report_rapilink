import { useState, useEffect } from 'react';
import {
    Package,
    Archive,
    Truck,
    UserCheck,
    AlertCircle,
    Plus,
    ArrowRightLeft,
    ChevronRight,
    Filter,
    Smartphone,
    QrCode,
    CheckCircle2,
    ClipboardCheck,
    BarChart3,
    FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AssetRegistrationModal } from '../components/operations/AssetRegistrationModal';
import clsx from 'clsx';

export default function InventoryDashboard() {
    const [stats, setStats] = useState({
        total: 0,
        warehouse: 0,
        assigned: 0,
        installed: 0,
        defective: 0
    });
    const [alerts, setAlerts] = useState<any[]>([]);
    const [recentMovements, setRecentMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [userRole, setUserRole] = useState<string>('technician');
    const navigate = useNavigate();

    useEffect(() => {
        loadDashboardData();
        loadUserRole();
    }, []);

    const loadUserRole = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();
            if (data) setUserRole(data.role || 'technician');
        }
    };

    // Helper: Verificar permisos por rol
    const canAccess = (feature: string): boolean => {
        const permissions: Record<string, string[]> = {
            admin: ['install', 'search', 'rma', 'audit', 'slips', 'analytics'],
            supervisor: ['install', 'search', 'rma', 'audit', 'slips'],
            technician: ['install', 'search', 'rma', 'audit']
        };
        return permissions[userRole]?.includes(feature) ?? false;
    };

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const { data: assets } = await supabase.from('inventory_assets').select('status, item_id');
            if (assets) {
                const counts = assets.reduce((acc: any, curr: any) => {
                    const status = curr.status || 'warehouse';
                    acc[status] = (acc[status] || 0) + 1;
                    acc.total++;
                    return acc;
                }, { total: 0, warehouse: 0, assigned: 0, installed: 0, defective: 0, recovered: 0 });
                setStats(counts);
            }

            // 2. Fetch items for alerts
            const { data: items } = await supabase
                .from('inventory_items')
                .select('id, name, min_stock_level, inventory_categories(name)');

            if (items && assets) {
                const stockAlerts = items
                    .map(item => {
                        const currentStock = assets.filter(a => a.item_id === item.id && a.status === 'warehouse').length;
                        const minLevel = item.min_stock_level || 0;

                        return {
                            ...item,
                            currentStock,
                            isCritical: currentStock === 0 && minLevel > 0,
                            isLow: currentStock <= minLevel && minLevel > 0 && currentStock > 0
                        };
                    })
                    .filter(a => a.isCritical || a.isLow)
                    .sort((a, b) => a.currentStock - b.currentStock);

                setAlerts(stockAlerts);
            }

            // 3. Recent Movements
            const { data: movements } = await supabase
                .from('inventory_movements')
                .select('*, inventory_assets(*, inventory_items(*)), origin:profiles!origin_holder_id(full_name), dest:profiles!destination_holder_id(full_name)')
                .order('created_at', { ascending: false })
                .limit(5);

            if (movements) setRecentMovements(movements);

        } catch (error) {
            console.error('Error loading inventory dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        { label: 'Total Activos', value: stats.total, icon: Package, color: 'text-primary', bg: 'bg-primary/10', path: '/operaciones/inventario/stock' },
        { label: 'En Bodega', value: stats.warehouse, icon: Archive, color: 'text-emerald-500', bg: 'bg-emerald-500/10', path: '/operaciones/inventario/stock' },
        { label: 'Asignado a Técnicos', value: stats.assigned, icon: Truck, color: 'text-amber-500', bg: 'bg-amber-500/10', path: '/operaciones/inventario/tecnicos' },
        { label: 'Instalado', value: stats.installed, icon: UserCheck, color: 'text-indigo-500', bg: 'bg-indigo-500/10', path: '/operaciones/inventario/stock' },
        { label: 'Defectuosos', value: stats.defective, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', path: '/operaciones/inventario/rma' },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header Mejorado - Estilo Ejecutivo */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
                        Gestión de Inventario
                    </h1>
                    <p className="text-slate-500 font-medium">Control unificado de activos y trazabilidad técnica.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
                        <Filter className="w-4 h-4 text-slate-500" />
                        Filtrar
                    </button>
                    <button
                        onClick={() => setIsRegisterModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-900 text-white rounded-xl text-sm font-bold uppercase tracking-wide shadow-sm hover:bg-blue-800 hover:shadow-md transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Registrar Activo
                    </button>
                </div>
            </div>

            {/* Tarjetas de Estadísticas - Estilo Clean Executive */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {statCards.map((stat, idx) => (
                    <button
                        key={idx}
                        onClick={() => stat.path && navigate(stat.path)}
                        className={clsx(
                            "group relative overflow-hidden p-6 rounded-2xl border bg-white hover:shadow-md transition-all duration-300 text-left",
                            "border-slate-200 border-l-4",
                            stat.color.replace('text-', 'border-l-') // Dynamic left border color based on text color
                        )}
                    >
                        <div className="relative z-10 flex flex-col justify-between h-full gap-4">
                            <div className="flex justify-between items-start">
                                <div className={clsx("p-2.5 rounded-xl flex items-center justify-center transition-colors", stat.bg)}>
                                    <stat.icon className={clsx("w-6 h-6", stat.color)} strokeWidth={2.5} />
                                </div>
                            </div>

                            <div>
                                <h3 className="text-3xl font-black text-slate-800 tracking-tight">
                                    {stat.value}
                                </h3>
                                <p className={clsx("text-[11px] font-bold uppercase tracking-widest mt-1 opacity-80", stat.color)}>
                                    {stat.label}
                                </p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
            {/* Operaciones de Campo */}
            {/* Operaciones de Campo */}
            <div className="space-y-4">
                <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">📱 Operaciones de Campo</h2>
                {/* Botones de Acción - Estilo Plano Clean */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <button
                        onClick={() => navigate('/operaciones/instalaciones')}
                        className="group flex flex-col gap-4 bg-white border border-slate-200 p-6 rounded-2xl hover:border-blue-300 hover:shadow-md hover:bg-blue-50/30 transition-all text-left"
                    >
                        <div className="p-3 bg-blue-100/50 text-blue-600 rounded-xl w-fit group-hover:scale-110 transition-transform">
                            <Smartphone size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-sm font-black uppercase text-slate-800">Instalar</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WispHub + OLT</p>
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/operaciones/inventario/escaner')}
                        className="group flex flex-col gap-4 bg-white border border-slate-200 p-6 rounded-2xl hover:border-emerald-300 hover:shadow-md hover:bg-emerald-50/30 transition-all text-left"
                    >
                        <div className="p-3 bg-emerald-100/50 text-emerald-600 rounded-xl w-fit group-hover:scale-110 transition-transform">
                            <QrCode size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-sm font-black uppercase text-slate-800">Buscar</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">S/N o MAC</p>
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/operaciones/inventario/rma')}
                        className="group flex flex-col gap-4 bg-white border border-slate-200 p-6 rounded-2xl hover:border-red-300 hover:shadow-md hover:bg-red-50/30 transition-all text-left"
                    >
                        <div className="p-3 bg-red-100/50 text-red-600 rounded-xl w-fit group-hover:scale-110 transition-transform">
                            <AlertCircle size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-sm font-black uppercase text-slate-800">RMA</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipos Dañados</p>
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/operaciones/inventario/auditoria')}
                        className="group flex flex-col gap-4 bg-white border border-slate-200 p-6 rounded-2xl hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/30 transition-all text-left"
                    >
                        <div className="p-3 bg-indigo-100/50 text-indigo-600 rounded-xl w-fit group-hover:scale-110 transition-transform">
                            <ClipboardCheck size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-sm font-black uppercase text-slate-800">Auditar</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Toma Física</p>
                        </div>
                    </button>
                </div>
            </div>

            {/* Administración y Reportes */}
            {(canAccess('slips') || canAccess('analytics')) && (
                <div className="space-y-4">
                    <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">📊 Administración y Reportes</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {canAccess('slips') && (
                            <button
                                onClick={() => navigate('/operaciones/inventario/actas')}
                                className="group flex flex-col gap-4 bg-white border border-slate-200 p-6 rounded-2xl hover:border-amber-300 hover:shadow-md hover:bg-amber-50/30 transition-all text-left"
                            >
                                <div className="p-3 bg-amber-100/50 text-amber-600 rounded-xl w-fit group-hover:scale-110 transition-transform">
                                    <FileText size={24} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="text-sm font-black uppercase text-slate-800">Actas</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entrega y Cierre</p>
                                </div>
                            </button>
                        )}

                        {canAccess('analytics') && (
                            <button
                                onClick={() => navigate('/operaciones/inventario/analiticas')}
                                className="group flex flex-col gap-4 bg-white border border-slate-200 p-6 rounded-2xl hover:border-violet-300 hover:shadow-md hover:bg-violet-50/30 transition-all text-left"
                            >
                                <div className="p-3 bg-violet-100/50 text-violet-600 rounded-xl w-fit group-hover:scale-110 transition-transform">
                                    <BarChart3 size={24} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="text-sm font-black uppercase text-slate-800">Reportes</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gasto y Rotación</p>
                                </div>
                            </button>
                        )}
                    </div>
                </div>
            )}


            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                            <ArrowRightLeft className="w-4 h-4" />
                            Movimientos Recientes
                        </h2>
                        <button className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider">Ver todo</button>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="divide-y divide-slate-100">
                            {recentMovements.length > 0 ? recentMovements.map((mov) => (
                                <div key={mov.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400">
                                            <Package className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-bold text-slate-800 line-clamp-1">
                                                {mov.inventory_assets?.inventory_items?.name || 'Desconocido'}
                                            </p>
                                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                {mov.inventory_assets?.serial_number}
                                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                                <span className={clsx(
                                                    "font-bold",
                                                    mov.movement_type === 'entry' ? "text-emerald-500" :
                                                        mov.movement_type === 'assignment' ? "text-amber-500" : "text-blue-500"
                                                )}>
                                                    {mov.movement_type === 'entry' ? 'Entrada' : mov.movement_type === 'assignment' ? 'Asignación' : mov.movement_type}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[9px] font-bold uppercase text-slate-400">Destino</p>
                                            <p className="text-[11px] font-bold text-slate-700">{mov.dest?.full_name || 'Almacén'}</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                </div>
                            )) : (
                                <div className="p-12 text-center text-slate-300 space-y-2">
                                    <Archive className="w-10 h-10 mx-auto opacity-50" />
                                    <p className="text-xs font-bold uppercase">No hay movimientos registrados</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 px-1">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        Alertas de Stock
                    </h2>
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-5 space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="p-2.5 bg-red-100/50 rounded-xl text-red-500">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-red-900 uppercase tracking-tight">Estado de Bodega</p>
                                <p className="text-[10px] text-red-600/80 leading-tight">Niveles críticos detectados</p>
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                            {alerts.length === 0 ? (
                                <div className="p-6 text-center bg-white/50 rounded-xl border border-dashed border-red-200 text-red-300">
                                    <CheckCircle2 className="w-6 h-6 mx-auto mb-2 opacity-50" />
                                    <p className="text-[10px] font-black uppercase">Todo en orden</p>
                                </div>
                            ) : (
                                alerts.map(alert => (
                                    <div key={alert.id} className={clsx(
                                        "p-3 rounded-xl border flex items-center justify-between gap-3 transition-all bg-white",
                                        alert.isCritical ? "border-red-200 shadow-sm" : "border-amber-200 shadow-sm"
                                    )}>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold text-slate-800 truncate">{alert.name}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{alert.inventory_categories?.name}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={clsx(
                                                "text-sm font-black leading-none",
                                                alert.isCritical ? "text-red-500" : "text-amber-500"
                                            )}>{alert.currentStock}</p>
                                            <p className="text-[8px] font-bold uppercase text-slate-400">Min: {alert.min_stock_level}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <button
                            onClick={() => navigate('/operaciones/inventario/stock')}
                            className="w-full py-2.5 bg-white border border-red-200 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-colors shadow-sm"
                        >
                            Ver Inventario
                        </button>
                    </div>
                </div>
            </div>

            <AssetRegistrationModal
                isOpen={isRegisterModalOpen}
                onClose={() => setIsRegisterModalOpen(false)}
                onSuccess={loadDashboardData}
            />
        </div>
    );
}
