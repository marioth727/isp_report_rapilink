import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
    LayoutDashboard,
    Kanban,
    FileText,
    LogOut,
    Calendar,
    Phone,
    Settings,
    History,
    Moon,
    Sun,
    Megaphone,
    ChevronDown,
    ChevronUp,
    User as UserIcon,
    Shield,
    Clock,
    Search as SearchIcon,
    BarChart3,
    ClipboardList,
    ShieldAlert,
    Menu,
    Loader2,
    UserPlus,
    Activity
} from 'lucide-react';
import { WisphubService, type WispHubClient } from '../../lib/wisphub';
import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { MobileSidebar } from './MobileSidebar';

export function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            if (saved === 'dark' || saved === 'light') return saved;
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
    });

    const [isAdmin, setIsAdmin] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [allowedMenus, setAllowedMenus] = useState<string[]>(["Dashboard"]);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        'Escalamiento': true,
        'Gestión Operativa': true,
        'Gestión Comercial': true,
        'Reportes': true,
        'Administración': false
    });

    // Global Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<WispHubClient[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [hasCriticalTickets, setHasCriticalTickets] = useState(false);

    useEffect(() => {
        checkCriticalTickets();
        const interval = setInterval(checkCriticalTickets, 300000); // Check every 5 mins
        return () => clearInterval(interval);
    }, []);

    const checkCriticalTickets = async () => {
        try {
            const tickets = await WisphubService.getAllTickets();
            const critical = tickets.some(t => t.sla_status === 'critico');
            setHasCriticalTickets(critical);
        } catch (error) {
            console.error("Error checking critical tickets:", error);
        }
    };

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUserEmail(user.email || null);
            if (user.user_metadata?.role === 'admin') {
                setIsAdmin(true);
            }

            // Load Menu Permissions from Profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('allowed_menus')
                .eq('id', user.id)
                .single();

            if (profile?.allowed_menus) {
                setAllowedMenus(profile.allowed_menus);
            }
        }
    };

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const toggleGroup = (title: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [title]: !prev[title]
        }));
    };

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const handleGlobalSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 3) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        setIsSearching(true);
        setShowResults(true);
        try {
            const results = await WisphubService.searchClients(query);
            setSearchResults(results);
        } catch (error) {
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectClient = (client: WispHubClient) => {
        setSearchQuery('');
        setShowResults(false);
        navigate('/gestion', { state: { selectedClient: client } });
    };

    const navGroups = [
        {
            title: 'Escalamiento',
            icon: Activity,
            items: [
                { to: '/operaciones/productividad', icon: BarChart3, label: 'Productividad' },
                { to: '/operaciones/mis-tareas', icon: ClipboardList, label: 'Mis Tareas' },
                { to: '/operaciones/supervision', icon: ShieldAlert, label: 'Supervisión' },
            ]
        },
        {
            title: 'Gestión Operativa',
            icon: Shield,
            items: [
                { to: '/operaciones', icon: LayoutDashboard, label: 'Dashboard Operativo' },
                { to: '/operaciones/trazabilidad', icon: Clock, label: 'Control de Trazabilidad' },
            ]
        },
        {
            title: 'Gestión Comercial',
            icon: Megaphone,
            items: [
                { to: '/campanas', icon: Megaphone, label: 'Gestor de Campañas' },
                { to: '/pipeline', icon: Kanban, label: 'Pipeline de Ventas' },
                { to: '/gestion', icon: Phone, label: 'Gestión Manual' },
                { to: '/historial', icon: History, label: 'Historial' },
            ]
        },
        {
            title: 'Reportes',
            icon: FileText,
            items: [
                { to: '/reportes/diario', icon: FileText, label: 'Reportes Diarios' },
                { to: '/reportes/semanal', icon: Calendar, label: 'Reporte Semanal' },
            ]
        }
    ].filter(group => allowedMenus.includes(group.title));

    const NavContent = () => (
        <div className="flex flex-col h-full bg-[#11101d] text-white">
            {/* Logo/Brand Section */}
            <div className="p-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                    <Shield className="w-6 h-6 text-primary" />
                </div>
                <div className="flex flex-col">
                    <span className="text-lg font-bold tracking-tight leading-tight">Rapilink</span>
                    <span className="text-[10px] text-gray-500 font-medium uppercase tracking-[0.2em]">CRM Reports</span>
                </div>
            </div>

            {/* Main Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto custom-scrollbar">
                {/* Dashboard - Special Item (No Group) */}
                {allowedMenus.includes('Dashboard') && (
                    <NavLink
                        to="/"
                        className={({ isActive }) =>
                            clsx(
                                "flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group",
                                isActive
                                    ? "bg-white text-[#11101d]"
                                    : "text-gray-400 hover:bg-white/10 hover:text-white"
                            )
                        }
                    >
                        <LayoutDashboard className="w-5 h-5 transition-transform group-hover:scale-110" />
                        <span>Dashboard</span>
                    </NavLink>
                )}

                {/* Groups with Accordion */}
                {navGroups.map((group) => {
                    const isExpanded = expandedGroups[group.title];
                    const isAnyActive = group.items.some(item => location.pathname === item.to);

                    return (
                        <div key={group.title} className="space-y-1">
                            <button
                                onClick={() => toggleGroup(group.title)}
                                className={clsx(
                                    "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group",
                                    isAnyActive ? "text-white" : "text-gray-400 hover:bg-white/10 hover:text-white"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <group.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                                    <span>{group.title}</span>
                                </div>
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            {isExpanded && (
                                <div className="ml-4 pl-4 border-l border-white/5 space-y-1 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {group.items.map((item) => (
                                        <NavLink
                                            key={item.to}
                                            to={item.to}
                                            className={({ isActive }) =>
                                                clsx(
                                                    "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200",
                                                    isActive
                                                        ? "text-white font-semibold flex items-center gap-3"
                                                        : "text-gray-500 hover:text-gray-300 flex items-center gap-3"
                                                )
                                            }
                                        >
                                            <item.icon className="w-4 h-4" />
                                            <span className="flex-1">{item.label}</span>
                                            {item.to === '/operaciones' && hasCriticalTickets && (
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                                                </span>
                                            )}
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Admin Section */}
                {isAdmin && (
                    <div className="space-y-1">
                        <button
                            onClick={() => toggleGroup('Administración')}
                            className={clsx(
                                "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group",
                                location.pathname === '/configuracion' ? "text-white font-semibold" : "text-gray-400 hover:bg-white/10 hover:text-white"
                            )}
                        >
                            <div className="flex items-center gap-4">
                                <Settings className="w-5 h-5 transition-transform group-hover:scale-110" />
                                <span>Administración</span>
                            </div>
                            {expandedGroups['Administración'] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {expandedGroups['Administración'] && (
                            <div className="ml-4 pl-4 border-l border-white/5 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                <NavLink
                                    to="/configuracion"
                                    className={({ isActive }) =>
                                        clsx(
                                            "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200",
                                            isActive ? "text-white font-semibold flex items-center gap-3" : "text-gray-500 hover:text-gray-300 flex items-center gap-3"
                                        )
                                    }
                                >
                                    <Settings className="w-4 h-4" />
                                    <span>Configuración</span>
                                </NavLink>
                            </div>
                        )}
                    </div>
                )}
            </nav>

            {/* User Profile Footer Section */}
            <div className="p-4 bg-[#1d1b31] border-t border-white/5 flex flex-col gap-3">
                <div className="flex items-center gap-3 px-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                        <UserIcon className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col min-w-0 overflow-hidden flex-1">
                        <span className="text-sm font-semibold truncate text-white">{userEmail?.split('@')[0] || 'Usuario'}</span>
                        <span className="text-xs text-gray-500 truncate lowercase">{isAdmin ? 'Administrador' : 'Agente'}</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-2 bg-white/5 hover:bg-destructive/20 hover:text-destructive rounded-lg transition-colors shrink-0 group"
                        title="Cerrar Sesión"
                    >
                        <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                </div>

                {/* Theme Toggle in Footer */}
                <button
                    onClick={toggleTheme}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-xs font-semibold text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all group"
                >
                    {theme === 'light' ? (
                        <>
                            <Moon className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                            <span>Mesa de Noche</span>
                        </>
                    ) : (
                        <>
                            <Sun className="w-4 h-4 group-hover:rotate-45 transition-transform" />
                            <span>Luz de Día</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
            {/* Desktop Sidebar - Hidden on mobile, visible on lg */}
            <aside className="hidden lg:flex w-64 border-r border-border bg-[#11101d] flex-col shrink-0">
                <NavContent />
            </aside>

            {/* Mobile Header - Visible only on mobile */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-border bg-card flex items-center justify-between px-4 z-40">
                <div className="flex items-center gap-2">
                    <Shield className="w-6 h-6 text-primary" />
                    <h1 className="text-lg font-bold text-primary">Rapilink</h1>
                </div>
                <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="p-2 hover:bg-muted rounded-md"
                >
                    <Menu className="w-6 h-6" />
                </button>
            </div>

            {/* Desktop Header / Top Bar */}
            <div className="hidden lg:flex fixed top-0 left-64 right-0 h-16 bg-card/80 backdrop-blur-md border-b border-border items-center px-8 z-30 justify-between">
                <div className="relative w-full max-w-md group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchIcon className="w-4 h-4" />}
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleGlobalSearch(e.target.value)}
                        onFocus={() => searchQuery.length >= 3 && setShowResults(true)}
                        placeholder="Buscar cliente por nombre o cédula..."
                        className="w-full bg-muted/50 border border-border rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />

                    {showResults && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            {searchResults.length > 0 ? (
                                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                                    {searchResults.map((client) => (
                                        <button
                                            key={client.id_servicio}
                                            onClick={() => handleSelectClient(client)}
                                            className="w-full flex items-center gap-4 p-4 hover:bg-primary/[0.04] transition-colors border-b border-border last:border-0 text-left"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                                <UserPlus size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-black uppercase truncate">{client.nombre}</p>
                                                <p className="text-[10px] text-muted-foreground font-bold">C.C. {client.cedula} • ID: {client.id_servicio}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : !isSearching && (
                                <div className="p-8 text-center">
                                    <p className="text-xs font-bold text-muted-foreground">No se encontraron clientes para tu búsqueda.</p>
                                </div>
                            )}

                            {searchQuery.length >= 3 && (
                                <div className="p-3 bg-muted/50 border-t border-border flex justify-center">
                                    <button
                                        onClick={() => setShowResults(false)}
                                        className="text-[9px] font-black uppercase text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        Cerrar resultados
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right hidden xl:block">
                        <p className="text-[10px] font-black text-muted-foreground uppercase leading-none mb-1">Usuario Actual</p>
                        <p className="text-xs font-black uppercase text-foreground">{userEmail?.split('@')[0]}</p>
                    </div>
                    <button
                        onClick={() => navigate('/configuracion')}
                        className="p-2 hover:bg-muted rounded-xl transition-colors group flex items-center gap-2"
                        title="Editar Perfil"
                    >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                            <UserIcon size={20} />
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-[10px] font-black text-primary uppercase leading-tight">Perfil</span>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase leading-tight">Configurar</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* Mobile Sidebar Portal */}
            <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
                <NavContent />
            </MobileSidebar>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-background relative w-full pt-16">
                <div className="max-w-7xl mx-auto p-4 md:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
