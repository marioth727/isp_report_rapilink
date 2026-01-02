import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { LayoutDashboard, Kanban, FileText, LogOut, Calendar, Phone, Settings, History, Menu, Sun, Moon, Megaphone, ChevronDown, ChevronUp, User as UserIcon, Shield } from 'lucide-react';
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
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        'Gestión Comercial': true,
        'Reportes': true,
        'Administración': false
    });

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

    const navGroups = [
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
    ];

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
                                            <span>{item.label}</span>
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

            {/* Mobile Sidebar Portal */}
            <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
                <NavContent />
            </MobileSidebar>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-background relative w-full pt-16 lg:pt-0">
                <div className="max-w-7xl mx-auto p-4 md:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
