
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import clsx from 'clsx';
import { Save, Plus, Trash2, DollarSign, Target, Calculator, UserPlus, Loader2 } from 'lucide-react';

interface PlanPrice {
    id: string;
    name: string;
    price: number;
}

interface CategoryGoal {
    name: string;
    target: number;
}

interface Threshold {
    optimal: number;
    alert: number;
}

interface TrafficLightConfig {
    dailyContacts: Threshold;
    conversionRate: Threshold;
    churnRate: Threshold;
    recoveryRate: Threshold;
    npsScore: Threshold;
    arpu: Threshold;
}

interface ConfigData {
    dailyGoal: number;
    weeklyGoals: CategoryGoal[];
    thresholds: TrafficLightConfig;
}

const DEFAULT_CATEGORIES = [
    "Upgrade Gratis",
    "Migración con Ahorro",
    "Migración con Aumento",
    "Obsoletos",
    "Suspendidos"
];

const DEFAULT_THRESHOLDS: TrafficLightConfig = {
    dailyContacts: { optimal: 40, alert: 30 },
    conversionRate: { optimal: 75, alert: 65 },
    churnRate: { optimal: 10, alert: 15 }, // Lower is better logic handled in component
    recoveryRate: { optimal: 50, alert: 40 },
    npsScore: { optimal: 60, alert: 45 },
    arpu: { optimal: 70000, alert: 60000 }
};

export function Configuration() {
    // Default Config
    const [config, setConfig] = useState<ConfigData>({
        dailyGoal: 5,
        weeklyGoals: DEFAULT_CATEGORIES.map(cat => ({ name: cat, target: 0 })),
        thresholds: DEFAULT_THRESHOLDS
    });

    // Default Plan Catalogue
    const [plans, setPlans] = useState<PlanPrice[]>([
        { id: '1', name: 'Plan 200 Megas', price: 60000 },
        { id: '2', name: 'Plan 400 Megas', price: 80000 },
        { id: '3', name: 'Plan 600 Megas', price: 100000 },
    ]);

    // New User State
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserWispHubId, setNewUserWispHubId] = useState('');
    const [newUserOperationalLevel, setNewUserOperationalLevel] = useState(1);
    const [newUserAllowedMenus, setNewUserAllowedMenus] = useState<string[]>(["Dashboard"]);
    const [creatingUser, setCreatingUser] = useState(false);

    const [newPlanName, setNewPlanName] = useState('');
    const [newPlanPrice, setNewPlanPrice] = useState('');
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<any[]>([]);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editingUserName, setEditingUserName] = useState('');
    const [editingWispHubId, setEditingWispHubId] = useState('');
    const [editingOperationalLevel, setEditingOperationalLevel] = useState(1);
    const [editingAllowedMenus, setEditingAllowedMenus] = useState<string[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);

    const MENU_OPTIONS = [
        "Dashboard",
        "Escalamiento",
        "Gestión Operativa",
        "Gestión Comercial",
        "Reportes"
    ];

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreatingUser(true);

        try {
            // Create a temporary client to avoid logging out the admin
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const tempSupabase = createClient(supabaseUrl, supabaseAnonKey);

            const { error } = await tempSupabase.auth.signUp({
                email: newUserEmail,
                password: newUserPassword,
                options: {
                    data: {
                        full_name: newUserName,
                        role: 'user'
                    }
                }
            });

            if (error) throw error;

            // 2. Create Profile Record
            if (error === null) {
                // We need to wait a brief moment for the auth trigger if any, 
                // but since we want specific data, we upsert manually.
                const { data: signUpData } = await tempSupabase.auth.getSession();
                const userId = signUpData?.session?.user?.id;

                if (userId) {
                    await supabase.from('profiles').upsert({
                        id: userId,
                        full_name: newUserName,
                        wisphub_id: newUserWispHubId,
                        operational_level: newUserOperationalLevel,
                        allowed_menus: newUserAllowedMenus
                    });
                }
            }

            alert(`Usuario ${newUserName} creado exitosamente.`);
            setNewUserEmail('');
            setNewUserPassword('');
            setNewUserName('');
            setNewUserWispHubId('');
            setNewUserOperationalLevel(1);
            setNewUserAllowedMenus(["Dashboard"]);
            fetchConfig();
        } catch (error: any) {
            console.error('Error creating user:', error);
            alert('Error al crear usuario: ' + error.message);
        } finally {
            setCreatingUser(false);
        }
    };

    // Load settings from Supabase on mount
    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setCurrentUser(user);

            // Load Config
            const { data, error: fetchError } = await supabase
                .from('crm_config')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

            if (data) {
                setConfig({
                    dailyGoal: data.daily_goal || 5,
                    weeklyGoals: data.weekly_goals || DEFAULT_CATEGORIES.map(cat => ({ name: cat, target: 0 })),
                    thresholds: data.thresholds ? { ...DEFAULT_THRESHOLDS, ...data.thresholds } : DEFAULT_THRESHOLDS
                });
                if (data.plan_prices) setPlans(data.plan_prices);
            }

            // Load Users (Profiles)
            const { data: profiles } = await supabase
                .from('profiles')
                .select('*')
                .order('full_name', { ascending: true });

            if (profiles && profiles.length > 0) {
                // Asegurar que cada perfil tenga un email decente para mostrar
                const mappedProfiles = profiles.map((p: any) => ({
                    ...p,
                    email: p.email || (p.id === user.id ? user.email : `Cuenta: ${p.id.slice(0, 8)}`)
                }));
                setUsers(mappedProfiles);
            } else {
                // Fallback: Identificar usuarios por interacciones
                const { data: interactions } = await supabase.from('crm_interactions').select('user_id');
                const uniqueIds = Array.from(new Set((interactions || []).map((i: any) => i.user_id)));

                setUsers(uniqueIds.map(id => ({
                    id,
                    full_name: null,
                    email: id === user.id ? user.email : `ID: ${id.slice(0, 8)}`,
                    role: 'user'
                })));
            }
        } catch (err) {
            console.error('Error loading config:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUser = async (userId: string) => {
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();

            // 1. Actualizar Tabla de Perfiles
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    full_name: editingUserName,
                    wisphub_id: editingWispHubId,
                    operational_level: editingOperationalLevel,
                    allowed_menus: editingAllowedMenus
                });

            if (profileError) throw profileError;

            // 2. Si es el usuario actual, actualizar también Metadatos de Auth para consistencia inmediata
            if (currentUser && currentUser.id === userId) {
                await supabase.auth.updateUser({
                    data: { full_name: editingUserName }
                });
            }

            alert('Usuario actualizado correctamente');
            setEditingUserId(null);
            fetchConfig();
        } catch (error: any) {
            alert('Error al actualizar: ' + error.message);
        }
    };

    const handleSave = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('Error: No usuario autenticado');
                return;
            }

            const { error } = await supabase
                .from('crm_config')
                .upsert({
                    user_id: user.id,
                    daily_goal: config.dailyGoal,
                    weekly_goals: config.weeklyGoals,
                    thresholds: config.thresholds,
                    plan_prices: plans,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            alert('¡Configuración guardada exitosamente en la nube!');
        } catch (error) {
            console.error('Error saving config:', error);
            alert('Error al guardar la configuración.');
        }
    };

    const handleCategoryChange = (name: string, value: string) => {
        const newGoals = config.weeklyGoals.map(g =>
            g.name === name ? { ...g, target: Number(value) } : g
        );
        setConfig({ ...config, weeklyGoals: newGoals });
    };

    const handleThresholdChange = (metric: keyof TrafficLightConfig, field: 'optimal' | 'alert', value: string) => {
        setConfig({
            ...config,
            thresholds: {
                ...config.thresholds,
                [metric]: {
                    ...config.thresholds[metric],
                    [field]: Number(value)
                }
            }
        });
    };

    const totalWeeklyGoal = config.weeklyGoals.reduce((sum, g) => sum + g.target, 0);

    const addPlan = () => {
        if (!newPlanName || !newPlanPrice) return;
        const newPlan = {
            id: Date.now().toString(),
            name: newPlanName,
            price: Number(newPlanPrice)
        };
        setPlans([...plans, newPlan]);
        setNewPlanName('');
        setNewPlanPrice('');
    };

    const removePlan = (id: string) => {
        setPlans(plans.filter(p => p.id !== id));
    };

    if (loading) return <div className="p-12 text-center text-muted-foreground animate-pulse">Cargando configuración...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
                    <p className="text-muted-foreground">Define tus metas, precios y umbrales de calidad.</p>
                </div>
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-all active:scale-95"
                >
                    <Save className="w-5 h-5" /> Guardar Cambios
                </button>
            </div>

            {/* Main Grid */}
            <div className="grid gap-8 md:grid-cols-2">

                {/* 1. Goals Section */}
                <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-6">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <Target className="w-5 h-5 text-indigo-500" /> Definición de Metas
                    </h3>

                    {/* Daily Goal */}
                    <div className="p-4 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                        <label className="text-sm font-bold text-indigo-300 block mb-2">Meta Diaria (Gestiones Exitosas)</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                value={config.dailyGoal}
                                onChange={(e) => setConfig({ ...config, dailyGoal: Number(e.target.value) })}
                                className="w-24 p-2 rounded-md border border-input bg-background font-bold text-center text-lg"
                            />
                            <span className="text-sm text-muted-foreground">ventas / día</span>
                        </div>
                    </div>

                    {/* Weekly Goals per Category */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-bold">Metas Semanales por Categoría</label>
                            <span className="text-xs bg-secondary px-2 py-1 rounded text-muted-foreground">
                                Suma Total: <strong className="text-white">{totalWeeklyGoal}</strong>
                            </span>
                        </div>
                        <div className="space-y-3">
                            {config.weeklyGoals.map((goal) => (
                                <div key={goal.name} className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{goal.name}</span>
                                    <input
                                        type="number"
                                        value={goal.target}
                                        onChange={(e) => handleCategoryChange(goal.name, e.target.value)}
                                        className="w-20 p-1.5 rounded border border-input bg-background text-right"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2. Quality Thresholds (New Section) */}
                <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-6">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-yellow-500" /> Métricas de Calidad
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Define los umbrales para el semáforo de rendimiento.
                    </p>

                    <div className="space-y-4">
                        {[
                            { id: 'dailyContacts', label: 'Contactos Diarios', suffix: '' },
                            { id: 'conversionRate', label: 'Tasa de Conversión', suffix: '%' },
                            { id: 'churnRate', label: 'Tasa de Churn (Bajas)', suffix: '% (Menor es mejor)' },
                            { id: 'recoveryRate', label: 'Tasa de Recuperación', suffix: '%' },
                            { id: 'npsScore', label: 'NPS (Satisfacción)', suffix: 'pts' },
                            { id: 'arpu', label: 'ARPU (Ticket Promedio)', suffix: '$' },
                        ].map((metric) => (
                            <div key={metric.id} className="grid grid-cols-12 gap-2 items-center text-sm">
                                <span className="col-span-4 text-muted-foreground font-medium">{metric.label}</span>

                                <div className="col-span-8 grid grid-cols-2 gap-2">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] text-green-500 font-bold uppercase">Óptimo {'>'}</label>
                                        <input
                                            type="number"
                                            value={config.thresholds[metric.id as keyof TrafficLightConfig].optimal}
                                            onChange={(e) => handleThresholdChange(metric.id as keyof TrafficLightConfig, 'optimal', e.target.value)}
                                            className="w-full p-1.5 rounded border border-green-500/30 bg-background text-center"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] text-yellow-500 font-bold uppercase">Alerta {'>'}</label>
                                        <input
                                            type="number"
                                            value={config.thresholds[metric.id as keyof TrafficLightConfig].alert}
                                            onChange={(e) => handleThresholdChange(metric.id as keyof TrafficLightConfig, 'alert', e.target.value)}
                                            className="w-full p-1.5 rounded border border-yellow-500/30 bg-background text-center"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Plan Prices Section */}
                <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4 md:col-span-2">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-500" /> Catálogo de Precios
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Ingresa el nombre EXACTO del plan (como aparece en el CRM) y su precio mensual para el cálculo de ARPU.
                    </p>

                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <label className="text-xs font-medium mb-1 block">Nombre del Plan</label>
                            <input
                                placeholder="Ej: Plan 200 Megas"
                                value={newPlanName}
                                onChange={(e) => setNewPlanName(e.target.value)}
                                className="w-full p-2 rounded-md border border-input bg-background text-sm"
                            />
                        </div>
                        <div className="w-24">
                            <label className="text-xs font-medium mb-1 block">Precio ($)</label>
                            <input
                                type="number"
                                placeholder="50000"
                                value={newPlanPrice}
                                onChange={(e) => setNewPlanPrice(e.target.value)}
                                className="w-full p-2 rounded-md border border-input bg-background text-sm"
                            />
                        </div>
                        <button
                            onClick={addPlan}
                            className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                        {plans.map(plan => (
                            <div key={plan.id} className="flex justify-between items-center p-3 bg-muted/30 rounded border border-border/50 text-sm">
                                <span className="font-medium truncate mr-2">{plan.name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-green-600 font-bold">
                                        ${plan.price.toLocaleString()}
                                    </span>
                                    <button
                                        onClick={() => removePlan(plan.id)}
                                        className="text-muted-foreground hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. User Management Section (Admin Only) */}
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-6">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-indigo-500" /> Gestión de Usuarios (Agentes)
                </h3>
                <p className="text-sm text-muted-foreground">
                    Crea nuevas cuentas de acceso para el personal. Estas cuentas tendrán rol de "Usuario" por defecto.
                </p>

                <form onSubmit={handleCreateUser} className="space-y-6">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Nombre Completo</label>
                                <input
                                    type="text"
                                    value={newUserName}
                                    onChange={(e) => setNewUserName(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                                    placeholder="Ej. Ana García"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Correo Electrónico</label>
                                <input
                                    type="email"
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                                    placeholder="agente@rapilink.com"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Contraseña Provisional</label>
                                <input
                                    type="text"
                                    value={newUserPassword}
                                    onChange={(e) => setNewUserPassword(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {/* WispHub & Level */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Usuario WispHub (Mapping)</label>
                                <input
                                    type="text"
                                    value={newUserWispHubId}
                                    onChange={(e) => setNewUserWispHubId(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                                    placeholder="Ej. admin@rapilink-sas"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Nivel Operativo</label>
                                <select
                                    value={newUserOperationalLevel}
                                    onChange={(e) => setNewUserOperationalLevel(Number(e.target.value))}
                                    className="w-full p-2.5 rounded-xl border border-input bg-background text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                                >
                                    <option value={1}>Nivel 1 (Soporte Técnico)</option>
                                    <option value={2}>Nivel 2 (Supervisor)</option>
                                    <option value={3}>Nivel 3 (Jefe)</option>
                                    <option value={4}>Nivel 4 (Gerencia)</option>
                                </select>
                            </div>
                        </div>

                        {/* Permissions */}
                        <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                            <label className="text-xs font-bold text-muted-foreground uppercase mb-3 block">Permisos de Menú</label>
                            <div className="grid grid-cols-1 gap-2">
                                {MENU_OPTIONS.map(menu => (
                                    <label key={menu} className="flex items-center gap-3 text-xs cursor-pointer group p-1 hover:bg-white/50 rounded-lg transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={newUserAllowedMenus.includes(menu)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setNewUserAllowedMenus([...newUserAllowedMenus, menu]);
                                                } else {
                                                    setNewUserAllowedMenus(newUserAllowedMenus.filter(m => m !== menu));
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                        />
                                        <span className="font-medium group-hover:text-primary transition-colors">{menu}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            disabled={creatingUser}
                            className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                            {creatingUser ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                            {creatingUser ? 'Creando Usuario...' : 'Crear Cuenta Completa'}
                        </button>
                    </div>
                </form>

                {/* Users List */}
                <div className="mt-8 border-t border-border pt-6">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Usuarios Registrados</h4>
                    <div className="grid gap-3">
                        {users.map((user) => (
                            <div key={user.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] text-primary font-black uppercase bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                                            {user.email || 'SIN EMAIL'}
                                        </span>
                                        {user.id === currentUser?.id && (
                                            <span className="text-[9px] font-black text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase border border-green-200 shadow-sm">Tú</span>
                                        )}
                                    </div>
                                    {editingUserId === user.id ? (
                                        <div className="flex flex-col gap-2 mt-2">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase">Nombre Completo</label>
                                                <input
                                                    type="text"
                                                    value={editingUserName}
                                                    onChange={(e) => setEditingUserName(e.target.value)}
                                                    className="p-1 px-2 rounded border border-primary bg-background text-sm font-bold"
                                                    autoFocus
                                                    placeholder="Nombre completo..."
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase">Usuario de WispHub (Mapping)</label>
                                                <input
                                                    type="text"
                                                    value={editingWispHubId}
                                                    onChange={(e) => setEditingWispHubId(e.target.value)}
                                                    className="p-1 px-2 rounded border border-border bg-background text-sm font-bold"
                                                    placeholder="Ej. admin@rapilink-sas"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase">Nivel Operativo</label>
                                                <select
                                                    value={editingOperationalLevel}
                                                    onChange={(e) => setEditingOperationalLevel(Number(e.target.value))}
                                                    className="p-1 px-2 rounded border border-border bg-background text-sm font-bold"
                                                >
                                                    <option value={1}>Nivel 1 (Soporte Técnico)</option>
                                                    <option value={2}>Nivel 2 (Supervisor de Operaciones)</option>
                                                    <option value={3}>Nivel 3 (Jefe de Operaciones)</option>
                                                    <option value={4}>Nivel 4 (Gerencia)</option>
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-2 mt-2">
                                                <label className="text-[9px] font-black text-muted-foreground uppercase">Permisos de Menú</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {MENU_OPTIONS.map(menu => (
                                                        <label key={menu} className="flex items-center gap-2 text-xs cursor-pointer group">
                                                            <input
                                                                type="checkbox"
                                                                checked={editingAllowedMenus.includes(menu)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setEditingAllowedMenus([...editingAllowedMenus, menu]);
                                                                    } else {
                                                                        setEditingAllowedMenus(editingAllowedMenus.filter(m => m !== menu));
                                                                    }
                                                                }}
                                                                className="rounded border-border text-primary focus:ring-primary/20"
                                                            />
                                                            <span className="group-hover:text-primary transition-colors">{menu}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black uppercase text-foreground">{user.full_name || 'Sin Nombre'}</span>
                                            <div className="flex gap-2 items-center mt-1">
                                                {user.wisphub_id && (
                                                    <span className="text-[9px] font-bold text-indigo-500 uppercase bg-indigo-50 px-1.5 rounded border border-indigo-100 italic">@{user.wisphub_id}</span>
                                                )}
                                                <span className={clsx(
                                                    "text-[9px] font-black px-1.5 rounded border uppercase",
                                                    user.operational_level === 1 ? "bg-blue-50 text-blue-600 border-blue-200" :
                                                        user.operational_level === 2 ? "bg-orange-50 text-orange-600 border-orange-200" :
                                                            user.operational_level === 3 ? "bg-purple-50 text-purple-600 border-purple-200" :
                                                                "bg-red-50 text-red-600 border-red-200"
                                                )}>
                                                    N{user.operational_level || 1}
                                                </span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {(user.allowed_menus || ["Dashboard"]).map((m: string) => (
                                                        <span key={m} className="text-[8px] bg-muted px-1 rounded text-muted-foreground font-medium">{m}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    {editingUserId === user.id ? (
                                        <>
                                            <button
                                                onClick={() => handleUpdateUser(user.id)}
                                                className="px-3 py-1.5 bg-green-500 text-white text-[10px] font-black rounded-lg uppercase"
                                            >
                                                Guardar
                                            </button>
                                            <button
                                                onClick={() => setEditingUserId(null)}
                                                className="px-3 py-1.5 bg-muted text-muted-foreground text-[10px] font-black rounded-lg uppercase"
                                            >
                                                Cancelar
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setEditingUserId(user.id);
                                                setEditingUserName(user.full_name || '');
                                                setEditingWispHubId(user.wisphub_id || '');
                                                setEditingOperationalLevel(user.operational_level || 1);
                                                setEditingAllowedMenus(user.allowed_menus || ["Dashboard"]);
                                            }}
                                            className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-black rounded-lg uppercase transition-colors"
                                        >
                                            Editar Perfil
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>

    );
}
