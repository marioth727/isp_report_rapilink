
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
// createClient removed 
// Just removing it from the import list if it was destructive.
// Let's just remove the line if it was: import { createClient } from '@supabase/supabase-js';
import clsx from 'clsx';
import {
    Save,
    Plus,
    Trash2,
    DollarSign,
    Target,
    Calculator,
    UserPlus,
    Loader2,
    Camera,
    Map as MapIcon,
    Shield
} from 'lucide-react';
import { InstallationChecklistManager } from '../components/InstallationChecklistManager';
import { NeighborhoodManager } from '../components/NeighborhoodManager';
import { NAV_GROUPS } from '../config/menu';

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
    const [newUserNotificationEmail, setNewUserNotificationEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserWispHubId, setNewUserWispHubId] = useState('');
    const [newUserOperationalLevel, setNewUserOperationalLevel] = useState(0);
    const [newUserIsFieldTech, setNewUserIsFieldTech] = useState(false);
    const [newUserAllowedMenus, setNewUserAllowedMenus] = useState<string[]>(["Dashboard"]);
    const [newUserRole, setNewUserRole] = useState<'agente' | 'admin'>('agente');
    const [creatingUser, setCreatingUser] = useState(false);

    const [newPlanName, setNewPlanName] = useState('');
    const [newPlanPrice, setNewPlanPrice] = useState('');
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<any[]>([]);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editingUserName, setEditingUserName] = useState('');
    const [editingWispHubId, setEditingWispHubId] = useState('');
    const [editingOperationalLevel, setEditingOperationalLevel] = useState(1);
    const [editingIsFieldTech, setEditingIsFieldTech] = useState(false);
    const [editingRole, setEditingRole] = useState<'agente' | 'admin'>('agente');
    const [editingAllowedMenus, setEditingAllowedMenus] = useState<string[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isNeighborhoodManagerOpen, setIsNeighborhoodManagerOpen] = useState(false);

    // MENU_OPTIONS removed in favor of NAV_GROUPS

    // Profile & Password State
    const [activeTab, setActiveTab] = useState<'profile' | 'system'>('profile');
    const [newMyPassword, setNewMyPassword] = useState('');
    const [confirmMyPassword, setConfirmMyPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newMyPassword !== confirmMyPassword) {
            alert("Las contraseñas no coinciden.");
            return;
        }
        if (newMyPassword.length < 6) {
            alert("La contraseña debe tener al menos 6 caracteres.");
            return;
        }

        setChangingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newMyPassword });
            if (error) throw error;

            alert("¡Contraseña actualizada correctamente!");
            setNewMyPassword('');
            setConfirmMyPassword('');
        } catch (error: any) {
            console.error("Error changing password:", error);
            alert("Error al cambiar contraseña: " + error.message);
        } finally {
            setChangingPassword(false);
        }
    };

    // Opciones detalladas para asignar masivamente (opcional en UI, pero bueno tener la lista)

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreatingUser(true);

        try {
            console.log("🚀 %c LÓGICA V2 ACTIVA: Intentando crear usuario vía RPC...", "color: lime; font-weight: bold; font-size: 14px");

            // 1. Call custom RPC to create user directly in auth.users and profiles
            const { data: newUserId, error: rpcError } = await supabase.rpc('create_new_user', {
                email_input: newUserEmail,
                password_input: newUserPassword,
                full_name_input: newUserName,
                role_input: newUserRole,
                wisphub_id_input: newUserWispHubId || null,
                operational_level_input: newUserOperationalLevel,
                is_field_tech_input: newUserIsFieldTech,
                allowed_menus_input: newUserAllowedMenus
            });

            if (rpcError) throw rpcError;

            console.log("User created via RPC with ID:", newUserId);

            alert(`Usuario ${newUserName} creado exitosamente.`);

            // Update notification email separately since RPC might not handle it yet
            if (newUserNotificationEmail) {
                await supabase.from('profiles').update({ notification_email: newUserNotificationEmail }).eq('id', newUserId);
            }

            setNewUserEmail('');
            setNewUserNotificationEmail('');
            setNewUserPassword('');
            setNewUserName('');
            setNewUserWispHubId('');
            setNewUserOperationalLevel(1);
            setNewUserIsFieldTech(false);
            setNewUserRole('agente');
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
        console.log("--- DEBUG ENVIRONMENT ---");
        console.log("VITE_SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL);
        console.log("VITE_SUPABASE_ANON_KEY (Start):", import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 10) + "...");
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

    const handleDeleteUser = async (userId: string, userName: string) => {
        if (!window.confirm(`⚠️ ADVERTENCIA: ¿Estás seguro de que deseas eliminar a ${userName}? 
Esta acción es IRREVERSIBLE y eliminará tanto su perfil como su cuenta de acceso (Auth) de Supabase.`)) {
            return;
        }

        try {
            // 1. Llamar a la función RPC para eliminar de Auth y Profiles de un solo golpe
            const { error: rpcError } = await supabase.rpc('delete_user_by_admin', {
                target_user_id: userId
            });

            if (rpcError) throw rpcError;

            alert('Usuario y cuenta eliminados permanentemente con éxito.');
            fetchConfig();
        } catch (error: any) {
            console.error('Error deleting user:', error);
            alert('Error al eliminar usuario: ' + error.message);
        }
    };

    const [editingEmail, setEditingEmail] = useState('');

    const [editingNotificationEmail, setEditingNotificationEmail] = useState('');
    const [editingPermissions, setEditingPermissions] = useState<any>({});
    const [editingPassword, setEditingPassword] = useState('');


    const handleUpdateUser = async (userId: string) => {
        // alert("1. Iniciando proceso de actualización..."); // CLEANED
        console.log("--- DEBUG UPDATE USER (ATOMIC RPC) ---");
        console.log("Target ID:", userId);

        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();

            // 0. Sincronización Total (Auth + Profile) via RPC MÁSTER V5 (ROBUST JSONB)
            // Empaquetamos todo en un solo objeto 'payload' para evitar errores de firma en PostgREST
            const payloadData = {
                target_user_id: userId,
                new_email: editingEmail || null,
                new_password: editingPassword || null,
                new_full_name: editingUserName,
                new_role: editingRole,
                new_wisphub_id: editingWispHubId,
                new_operational_level: editingOperationalLevel,
                new_is_field_tech: editingIsFieldTech,
                new_allowed_menus: editingAllowedMenus
            };

            // alert("2. DATOS A ENVIAR (V5 Robust):\n" + JSON.stringify(payloadData, null, 2)); // CLEANED
            console.log("Calling RPC update_user_credentials_v5 with payload wrapper:", payloadData);

            // IMPORTANTE: Envolver en { payload: ... } porque la función SQL espera un parámetro llamado 'payload'
            const { data: rpcData, error: rpcError } = await supabase.rpc('update_user_credentials_v5', { payload: payloadData } as any);

            if (rpcError) {
                console.error("RPC Error:", rpcError);
                throw rpcError;
            }

            // Mostrar resultado detallado de la V5
            // alert("3. ¡Respuesta del servidor V5!\n" + JSON.stringify(rpcData, null, 2)); // CLEANED
            console.log("RPC Success: Auth User & Profile Synced Atomically.", rpcData);

            // 1. Si es el usuario actual, usar la API nativa de Supabase como redundancia y seguridad
            if (currentUser && currentUser.id === userId) {
                const userUpdates: any = {
                    data: {
                        full_name: editingUserName,
                        role: editingRole,
                        permissions: editingPermissions
                    }
                };

                if (editingPassword) userUpdates.password = editingPassword;
                if (editingEmail && editingEmail !== currentUser.email) userUpdates.email = editingEmail;

                await supabase.auth.updateUser(userUpdates);
            }

            // Always update permissions in profiles table
            await supabase.from('profiles').update({
                full_name: editingUserName,
                role: editingRole,
                allowed_menus: editingAllowedMenus,
                notification_email: editingNotificationEmail,
                operational_level: editingOperationalLevel,
                is_field_tech: editingIsFieldTech,
                permissions: editingPermissions
            }).eq('id', userId);

            // Update notification email directly
            if (editingNotificationEmail !== undefined) {
                await supabase.from('profiles').update({ notification_email: editingNotificationEmail }).eq('id', userId);
            }

            alert('Usuario actualizado correctamente (Sincronización Total)');
            setEditingUserId(null);
            setEditingEmail('');
            setEditingNotificationEmail('');
            setEditingPassword('');
            fetchConfig();
        } catch (error: any) {
            console.error('Update User Error:', error);
            alert('ERROR GRAVE al actualizar:\n' + JSON.stringify(error, null, 2));
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
        <div className="max-w-7xl mx-auto space-y-8 pb-12 px-4 sm:px-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-6">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase">
                        Configuración <span className="text-sm bg-lime-100 text-lime-700 px-2 py-0.5 rounded-full normal-case tracking-normal align-middle ml-2">v2.1 (Patch Applied)</span>
                    </h2>
                    <p className="text-slate-500 font-medium">Define tus metas, precios y umbrales de calidad.</p>
                </div>
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all active:scale-95 text-sm uppercase tracking-wide"
                >
                    <Save className="w-5 h-5" /> Guardar Cambios
                </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex space-x-1 rounded-xl bg-slate-100 p-1 mb-6">
                <button
                    onClick={() => setActiveTab('profile')}
                    className={clsx(
                        "w-full rounded-lg py-2.5 text-sm font-bold leading-5 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2",
                        activeTab === 'profile'
                            ? "bg-white text-blue-700 shadow"
                            : "text-slate-600 hover:bg-white/[0.12] hover:text-slate-800"
                    )}
                >
                    Mi Perfil & Seguridad
                </button>
                {currentUser?.user_metadata?.role === 'admin' && (
                    <button
                        onClick={() => setActiveTab('system')}
                        className={clsx(
                            "w-full rounded-lg py-2.5 text-sm font-bold leading-5 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2",
                            activeTab === 'system'
                                ? "bg-white text-blue-700 shadow"
                                : "text-slate-600 hover:bg-white/[0.12] hover:text-slate-800"
                        )}
                    >
                        Configuración del Sistema
                    </button>
                )}
            </div>

            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
                <div className="grid gap-8 md:grid-cols-2">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                        <h3 className="text-sm font-black flex items-center gap-2 uppercase text-slate-500 tracking-widest">
                            <UserPlus className="w-4 h-4 text-blue-600" /> Información Personal
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nombre</label>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-700">
                                    {currentUser?.user_metadata?.full_name || 'Sin nombre'}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Email</label>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold text-slate-700">
                                    {currentUser?.email}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Rol</label>
                                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 font-black text-indigo-700 uppercase text-xs">
                                        {currentUser?.user_metadata?.role || 'Agente'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nivel</label>
                                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 font-black text-emerald-700 uppercase text-xs">
                                        Nivel {currentUser?.user_metadata?.operational_level ?? 0}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                        <h3 className="text-sm font-black flex items-center gap-2 uppercase text-slate-500 tracking-widest">
                            <Shield className="w-4 h-4 text-red-500" /> Seguridad
                        </h3>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nueva Contraseña</label>
                                <input
                                    type="password"
                                    value={newMyPassword}
                                    onChange={(e) => setNewMyPassword(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all outline-none"
                                    placeholder="Nueva contraseña..."
                                    minLength={6}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Confirmar Contraseña</label>
                                <input
                                    type="password"
                                    value={confirmMyPassword}
                                    onChange={(e) => setConfirmMyPassword(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all outline-none"
                                    placeholder="Repetir nueva contraseña..."
                                    minLength={6}
                                    required
                                />
                            </div>
                            <button
                                disabled={changingPassword}
                                className="w-full bg-red-600 text-white px-4 py-3 rounded-xl font-bold shadow-sm hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                            >
                                {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {changingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* SYSTEM TAB (ADMIN ONLY) */}
            {activeTab === 'system' && (
                <div className="grid gap-8 md:grid-cols-2 items-start">

                    {/* 1. Goals Section */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                        <h3 className="text-sm font-black flex items-center gap-2 uppercase text-slate-500 tracking-widest">
                            <Target className="w-4 h-4 text-blue-600" /> Definición de Metas
                        </h3>

                        {/* Daily Goal */}
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <label className="text-xs font-bold text-slate-900 block mb-2 uppercase tracking-wide">Meta Diaria (Gestiones)</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    value={config.dailyGoal}
                                    onChange={(e) => setConfig({ ...config, dailyGoal: Number(e.target.value) })}
                                    className="w-24 p-2 rounded-lg border border-slate-200 bg-white font-black text-center text-xl text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                />
                                <span className="text-xs font-bold text-slate-400 uppercase">ventas / día</span>
                            </div>
                        </div>

                        {/* Weekly Goals per Category */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-xs font-bold text-slate-900 uppercase">Metas Semanales</label>
                                <span className="text-[10px] font-bold bg-blue-100/50 text-blue-700 px-2 py-1 rounded border border-blue-200 uppercase">
                                    Total: {totalWeeklyGoal}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {config.weeklyGoals.map((goal) => (
                                    <div key={goal.name} className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600 font-medium text-xs uppercase tracking-tight">{goal.name}</span>
                                        <input
                                            type="number"
                                            value={goal.target}
                                            onChange={(e) => handleCategoryChange(goal.name, e.target.value)}
                                            className="w-20 p-1.5 rounded border border-slate-200 bg-slate-50 text-right font-bold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 2. Quality Thresholds (New Section) */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                        <h3 className="text-sm font-black flex items-center gap-2 uppercase text-slate-500 tracking-widest">
                            <Calculator className="w-4 h-4 text-emerald-500" /> Métricas de Calidad
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">
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
                                    <span className="col-span-4 text-slate-600 font-bold text-xs uppercase tracking-tight">{metric.label}</span>

                                    <div className="col-span-8 grid grid-cols-2 gap-2">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] text-emerald-600 font-black uppercase tracking-wide">Óptimo {'>'}</label>
                                            <input
                                                type="number"
                                                value={config.thresholds[metric.id as keyof TrafficLightConfig].optimal}
                                                onChange={(e) => handleThresholdChange(metric.id as keyof TrafficLightConfig, 'optimal', e.target.value)}
                                                className="w-full p-1.5 rounded border border-emerald-100 bg-emerald-50/30 text-center font-bold text-emerald-700 text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] text-amber-600 font-black uppercase tracking-wide">Alerta {'>'}</label>
                                            <input
                                                type="number"
                                                value={config.thresholds[metric.id as keyof TrafficLightConfig].alert}
                                                onChange={(e) => handleThresholdChange(metric.id as keyof TrafficLightConfig, 'alert', e.target.value)}
                                                className="w-full p-1.5 rounded border border-amber-100 bg-amber-50/30 text-center font-bold text-amber-700 text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. Plan Prices Section */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 md:col-span-2">
                        <h3 className="text-sm font-black flex items-center gap-2 uppercase text-slate-500 tracking-widest">
                            <DollarSign className="w-4 h-4 text-green-500" /> Catálogo de Precios
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">
                            Ingresa el nombre EXACTO del plan (como aparece en el CRM) y su precio mensual para el cálculo de ARPU.
                        </p>

                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nombre del Plan</label>
                                <input
                                    placeholder="Ej: Plan 200 Megas"
                                    value={newPlanName}
                                    onChange={(e) => setNewPlanName(e.target.value)}
                                    className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                                />
                            </div>
                            <div className="w-32">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Precio ($)</label>
                                <input
                                    type="number"
                                    placeholder="50000"
                                    value={newPlanPrice}
                                    onChange={(e) => setNewPlanPrice(e.target.value)}
                                    className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-right focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-bold"
                                />
                            </div>
                            <button
                                onClick={addPlan}
                                className="p-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 shadow-sm transition-transform active:scale-95"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {plans.map(plan => (
                                <div key={plan.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-sm transition-all text-sm group">
                                    <span className="font-bold text-slate-700 truncate mr-2 w-full text-xs uppercase" title={plan.name}>{plan.name}</span>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-emerald-600 font-black text-xs">
                                            ${plan.price.toLocaleString()}
                                        </span>
                                        <button
                                            onClick={() => removePlan(plan.id)}
                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 4. Installation Checklist (Dynamic) */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 md:col-span-2">
                        <h3 className="text-sm font-black flex items-center gap-2 uppercase text-slate-500 tracking-widest">
                            <Camera className="w-4 h-4 text-pink-500" /> Requisitos Fotográficos (Instalación)
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">
                            Define el checklist de fotos que el personal de cuadrilla debe registrar durante una instalación.
                        </p>
                        <div className="pt-2">
                            <InstallationChecklistManager />
                        </div>
                    </div>

                    {/* 5. Logistics & Maps Section */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 md:col-span-2">
                        <h3 className="text-sm font-black flex items-center gap-2 uppercase text-slate-500 tracking-widest">
                            <MapIcon className="w-4 h-4 text-blue-600" /> Logística y Georeferencia
                        </h3>
                        <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100 gap-6">
                            <div className="flex-1">
                                <h4 className="text-sm font-black text-slate-900 uppercase">Catálogo de Barrios</h4>
                                <p className="text-xs text-slate-400 font-medium mt-1">
                                    Administra las coordenadas centrales de cada barrio para la optimización de rutas del NOC.
                                    Sincroniza nombres reales directamente desde tu base de clientes.
                                </p>
                            </div>
                            <button
                                onClick={() => setIsNeighborhoodManagerOpen(true)}
                                className="bg-white text-blue-900 px-6 py-3 rounded-xl font-bold shadow-sm border border-slate-200 hover:border-blue-300 hover:text-blue-700 transition-all active:scale-95 flex items-center gap-2 text-xs uppercase tracking-widest"
                            >
                                <MapIcon size={16} /> Abrir Gestor de Barrios
                            </button>
                        </div>
                    </div>

                    {/* Modals */}
                    <NeighborhoodManager
                        isOpen={isNeighborhoodManagerOpen}
                        onClose={() => setIsNeighborhoodManagerOpen(false)}
                    />

                    {/* 4. User Management Section (Admin Only) */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 md:col-span-2">
                        <h3 className="text-sm font-black flex items-center gap-2 uppercase text-slate-500 tracking-widest">
                            <UserPlus className="w-4 h-4 text-blue-600" /> Gestión de Usuarios (Agentes)
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">
                            Crea nuevas cuentas de acceso para el personal. Estas cuentas tendrán rol de "Usuario" por defecto.
                        </p>

                        <form onSubmit={handleCreateUser} className="space-y-6">
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nombre Completo</label>
                                        <input
                                            type="text"
                                            value={newUserName}
                                            onChange={(e) => setNewUserName(e.target.value)}
                                            className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                            placeholder="Ej. Ana García"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Correo Electrónico</label>
                                        <input
                                            type="email"
                                            value={newUserEmail}
                                            onChange={(e) => setNewUserEmail(e.target.value)}
                                            className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                            placeholder="agente@rapilink.com"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Correo de Notificaciones</label>
                                        <input
                                            type="email"
                                            value={newUserNotificationEmail}
                                            onChange={(e) => setNewUserNotificationEmail(e.target.value)}
                                            className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                            placeholder="Para alertas del sistema..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Contraseña Provisional</label>
                                        <input
                                            type="text"
                                            value={newUserPassword}
                                            onChange={(e) => setNewUserPassword(e.target.value)}
                                            className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                            placeholder="Mínimo 6 caracteres"
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-blue-600 uppercase mb-1 block">Rol del Sistema</label>
                                        <select
                                            value={newUserRole}
                                            onChange={(e) => setNewUserRole(e.target.value as 'agente' | 'admin')}
                                            className="w-full p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 text-sm font-bold focus:ring-2 focus:ring-blue-200 transition-all outline-none text-blue-900"
                                        >
                                            <option value="agente">Agente (Consulta y CRM)</option>
                                            <option value="admin">Administrador (Control Total)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* WispHub & Level */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Usuario WispHub (Mapping)</label>
                                        <input
                                            type="text"
                                            value={newUserWispHubId}
                                            onChange={(e) => setNewUserWispHubId(e.target.value)}
                                            className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                            placeholder="Ej. admin@rapilink-sas"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nivel Operativo</label>
                                        <select
                                            value={newUserOperationalLevel}
                                            onChange={(e) => setNewUserOperationalLevel(Number(e.target.value))}
                                            className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                        >
                                            <option value={0}>Nivel 0 (Soporte Técnico)</option>
                                            <option value={1}>Nivel 1 (Técnico de Redes)</option>
                                            <option value={2}>Nivel 2 (Supervisor)</option>
                                            <option value={3}>Nivel 3 (Jefe)</option>
                                            <option value={4}>Nivel 4 (Gerencia)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Ubicación Estratégica</label>
                                        <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-inner">
                                            <button
                                                type="button"
                                                onClick={() => setNewUserIsFieldTech(false)}
                                                className={clsx(
                                                    "flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300",
                                                    !newUserIsFieldTech
                                                        ? "bg-white text-blue-600 shadow-md shadow-blue-500/10 border-b-2 border-blue-500 transform scale-[1.02]"
                                                        : "text-slate-400 hover:text-slate-600 hover:bg-white/40"
                                                )}
                                            >
                                                <span className="text-sm">🏢</span> Oficina
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewUserIsFieldTech(true)}
                                                className={clsx(
                                                    "flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300",
                                                    newUserIsFieldTech
                                                        ? "bg-white text-orange-600 shadow-md shadow-orange-500/10 border-b-2 border-orange-500 transform scale-[1.02]"
                                                        : "text-slate-400 hover:text-slate-600 hover:bg-white/40"
                                                )}
                                            >
                                                <span className="text-sm">🚜</span> Campo
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Permissions */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 lg:col-span-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-3 block">Permisos de Menú</label>
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        {NAV_GROUPS.filter(g => !g.adminOnly).map(group => (
                                            <div key={group.title} className="space-y-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <group.icon className="w-3 h-3 text-blue-500" />
                                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">{group.title}</span>
                                                </div>
                                                <div className="pl-4 space-y-1 border-l border-slate-200">
                                                    {group.items.map(item => (
                                                        <label key={item.id} className="flex items-center gap-2 text-xs cursor-pointer group hover:bg-white p-1 rounded transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={newUserAllowedMenus.includes(item.label) || newUserAllowedMenus.includes(group.title)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setNewUserAllowedMenus([...newUserAllowedMenus, item.label]);
                                                                    } else {
                                                                        setNewUserAllowedMenus(newUserAllowedMenus.filter(m => m !== item.label && m !== group.title));
                                                                    }
                                                                }}
                                                                className="w-3 h-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <span className="font-bold text-slate-500 group-hover:text-blue-600 transition-colors uppercase text-[9px] truncate">{item.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    disabled={creatingUser}
                                    className="bg-blue-900 text-white px-8 py-3 rounded-xl font-bold shadow-sm hover:bg-blue-800 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 text-xs uppercase tracking-widest"
                                >
                                    {creatingUser ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                                    {creatingUser ? 'Creando Usuario...' : 'Crear Cuenta Completa'}
                                </button>
                            </div>
                        </form>

                        {/* Users List */}
                        <div className="mt-8 border-t border-slate-200 pt-6">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Usuarios Registrados</h4>
                            <div className="grid gap-3">
                                {users.map((user) => (
                                    <div key={user.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 group hover:border-blue-300 transition-colors">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] text-blue-800 font-extrabold uppercase bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                                                    {user.email || 'SIN EMAIL'}
                                                </span>
                                                <span className={clsx(
                                                    "text-[10px] font-black uppercase px-2 py-0.5 rounded border shadow-sm",
                                                    user.role === 'admin' ? "bg-indigo-600 text-white border-indigo-700" : "bg-white text-slate-500 border-slate-200"
                                                )}>
                                                    {user.role === 'admin' ? '🛡️ Admin' : '👤 Agente'}
                                                </span>
                                                {user.id === currentUser?.id && (
                                                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase border border-emerald-200 shadow-sm">Tú</span>
                                                )}
                                            </div>
                                            {editingUserId === user.id ? (
                                                <div className="mt-4 bg-white p-6 rounded-2xl border border-blue-200 shadow-xl w-full">
                                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                        {/* Basic Info */}
                                                        <div className="space-y-4 text-left">
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block tracking-tight">Nombre Completo</label>
                                                                <input
                                                                    type="text"
                                                                    value={editingUserName}
                                                                    onChange={(e) => setEditingUserName(e.target.value)}
                                                                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                                                    placeholder="Nombre completo..."
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block tracking-tight">Correo de Acceso</label>
                                                                <input
                                                                    type="email"
                                                                    value={editingEmail}
                                                                    onChange={(e) => setEditingEmail(e.target.value)}
                                                                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                                                    placeholder="Correo..."
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block tracking-tight">Correo de Notificaciones</label>
                                                                <input
                                                                    type="email"
                                                                    value={editingNotificationEmail}
                                                                    onChange={(e) => setEditingNotificationEmail(e.target.value)}
                                                                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                                                    placeholder="Para alertas..."
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block tracking-tight">Nueva Clave (Opcional)</label>
                                                                <input
                                                                    type="password"
                                                                    value={editingPassword}
                                                                    onChange={(e) => setEditingPassword(e.target.value)}
                                                                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                                                    placeholder="Dejar vacío para no cambiar"
                                                                    minLength={6}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-blue-600 uppercase mb-1 block tracking-tight">Rol del Sistema</label>
                                                                <select
                                                                    value={editingRole}
                                                                    onChange={(e) => setEditingRole(e.target.value as 'agente' | 'admin')}
                                                                    className="w-full p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 text-sm font-bold focus:ring-2 focus:ring-blue-200 transition-all outline-none text-blue-900 cursor-pointer"
                                                                >
                                                                    <option value="agente">Agente (Consulta y CRM)</option>
                                                                    <option value="admin">Administrador (Control Total)</option>
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {/* Operations & Location */}
                                                        <div className="space-y-4 text-left">
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block tracking-tight">Usuario WispHub (Mapping)</label>
                                                                <input
                                                                    type="text"
                                                                    value={editingWispHubId}
                                                                    onChange={(e) => setEditingWispHubId(e.target.value)}
                                                                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                                                    placeholder="Ej. técnico@isp"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block tracking-tight">Nivel Operativo</label>
                                                                <select
                                                                    value={editingOperationalLevel}
                                                                    onChange={(e) => setEditingOperationalLevel(Number(e.target.value))}
                                                                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none cursor-pointer"
                                                                >
                                                                    <option value={0}>Nivel 0 (Soporte Técnico)</option>
                                                                    <option value={1}>Nivel 1 (Técnico de Redes)</option>
                                                                    <option value={2}>Nivel 2 (Supervisor)</option>
                                                                    <option value={3}>Nivel 3 (Jefe)</option>
                                                                    <option value={4}>Nivel 4 (Gerencia)</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest text-left">Ubicación Estratégica</label>
                                                                <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-inner">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditingIsFieldTech(false)}
                                                                        className={clsx(
                                                                            "flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300",
                                                                            !editingIsFieldTech
                                                                                ? "bg-white text-blue-600 shadow-md shadow-blue-500/10 border-b-2 border-blue-500 transform scale-[1.02]"
                                                                                : "text-slate-400 hover:text-slate-600 hover:bg-white/40"
                                                                        )}
                                                                    >
                                                                        <span className="text-sm">🏢</span> Oficina
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditingIsFieldTech(true)}
                                                                        className={clsx(
                                                                            "flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase transition-all duration-300",
                                                                            editingIsFieldTech
                                                                                ? "bg-white text-orange-600 shadow-md shadow-orange-500/10 border-b-2 border-orange-500 transform scale-[1.02]"
                                                                                : "text-slate-400 hover:text-slate-600 hover:bg-white/40"
                                                                        )}
                                                                    >
                                                                        <span className="text-sm">🚜</span> Campo
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Permissions Sidebar */}
                                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left">
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-3 block tracking-widest">Permisos de Menú</label>
                                                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                                                {NAV_GROUPS.filter(g => !g.adminOnly).map(group => (
                                                                    <div key={group.title} className="space-y-1">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <group.icon className="w-3 h-3 text-blue-500" />
                                                                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">{group.title}</span>
                                                                        </div>
                                                                        <div className="pl-4 space-y-1 border-l border-slate-200">
                                                                            {group.items.map(item => (
                                                                                <label key={item.id} className="flex items-center gap-2 text-xs cursor-pointer group hover:bg-white p-1 rounded transition-colors">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={editingAllowedMenus.includes(item.label) || editingAllowedMenus.includes(group.title)}
                                                                                        onChange={(e) => {
                                                                                            if (e.target.checked) {
                                                                                                setEditingAllowedMenus([...editingAllowedMenus, item.label]);
                                                                                            } else {
                                                                                                setEditingAllowedMenus(editingAllowedMenus.filter(m => m !== item.label && m !== group.title));
                                                                                            }
                                                                                        }}
                                                                                        className="w-3 h-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                                                    />
                                                                                    <span className="font-bold text-slate-500 group-hover:text-blue-600 transition-colors uppercase text-[9px] truncate">{item.label}</span>
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Special Permissions Sidebar */}
                                                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 text-left mt-4">
                                                            <label className="text-[10px] font-bold text-orange-400 uppercase mb-3 block tracking-widest">Permisos Especiales</label>
                                                            <div className="grid grid-cols-1 gap-2">
                                                                <label className="flex items-center gap-3 text-xs cursor-pointer group p-1 hover:bg-white rounded-lg transition-colors">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={editingPermissions?.inventory?.can_manage || false}
                                                                        onChange={(e) => {
                                                                            setEditingPermissions({
                                                                                ...editingPermissions,
                                                                                inventory: {
                                                                                    ...editingPermissions?.inventory,
                                                                                    can_manage: e.target.checked
                                                                                }
                                                                            });
                                                                        }}
                                                                        className="w-3.5 h-3.5 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                                                                    />
                                                                    <span className="font-bold text-slate-700 group-hover:text-orange-600 transition-colors uppercase text-[10px] tracking-wide">Gestionar Inventario (Devoluciones)</span>
                                                                </label>

                                                                {/* Ticket Management Permissions */}
                                                                <label className="flex items-center gap-3 text-xs cursor-pointer group p-1 hover:bg-white rounded-lg transition-colors">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={editingPermissions?.ticket_management?.can_edit || false}
                                                                        onChange={(e) => {
                                                                            setEditingPermissions({
                                                                                ...editingPermissions,
                                                                                ticket_management: {
                                                                                    ...editingPermissions?.ticket_management,
                                                                                    can_edit: e.target.checked
                                                                                }
                                                                            });
                                                                        }}
                                                                        className="w-3.5 h-3.5 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                                                                    />
                                                                    <span className="font-bold text-slate-700 group-hover:text-orange-600 transition-colors uppercase text-[10px] tracking-wide">Gestionar Tickets (Editar)</span>
                                                                </label>

                                                                <label className="flex items-center gap-3 text-xs cursor-pointer group p-1 hover:bg-white rounded-lg transition-colors">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={editingPermissions?.ticket_management?.can_escalate || false}
                                                                        onChange={(e) => {
                                                                            setEditingPermissions({
                                                                                ...editingPermissions,
                                                                                ticket_management: {
                                                                                    ...editingPermissions?.ticket_management,
                                                                                    can_escalate: e.target.checked
                                                                                }
                                                                            });
                                                                        }}
                                                                        className="w-3.5 h-3.5 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                                                                    />
                                                                    <span className="font-bold text-slate-700 group-hover:text-orange-600 transition-colors uppercase text-[10px] tracking-wide">Gestionar Tickets (Escalar)</span>
                                                                </label>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                                                        <button
                                                            onClick={() => setEditingUserId(null)}
                                                            className="px-6 py-2.5 bg-slate-100 text-slate-500 hover:bg-slate-200 text-xs font-black rounded-xl uppercase transition-all"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateUser(user.id)}
                                                            className="px-8 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-black rounded-xl uppercase shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2"
                                                        >
                                                            <Save className="w-4 h-4" /> Guardar Cambios
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black uppercase text-slate-800">{user.full_name || 'Sin Nombre'}</span>
                                                    <div className="flex gap-2 items-center mt-1">
                                                        {user.wisphub_id && (
                                                            <span className="text-[9px] font-bold text-indigo-500 uppercase bg-indigo-50 px-1.5 rounded border border-indigo-100 italic">@{user.wisphub_id}</span>
                                                        )}
                                                        <span className={clsx(
                                                            "text-[9px] font-black px-1.5 rounded border uppercase",
                                                            user.operational_level === 0 ? "bg-blue-50 text-blue-600 border-blue-200" :
                                                                user.operational_level === 1 ? "bg-cyan-50 text-cyan-600 border-cyan-200" :
                                                                    user.operational_level === 2 ? "bg-orange-50 text-orange-600 border-orange-200" :
                                                                        user.operational_level === 3 ? "bg-purple-50 text-purple-600 border-purple-200" :
                                                                            "bg-red-50 text-red-600 border-red-200"
                                                        )}>
                                                            N{user.operational_level !== undefined ? user.operational_level : 0}
                                                        </span>
                                                        {!user.is_field_tech ? (
                                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase flex items-center gap-1">
                                                                🏢 Oficina
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 uppercase flex items-center gap-1">
                                                                🚜 Campo
                                                            </span>
                                                        )}
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {(user.allowed_menus || ["Dashboard"]).map((m: string) => (
                                                                <span key={m} className="text-[8px] bg-white border border-slate-200 px-1 rounded text-slate-400 font-bold uppercase tracking-tight">{m}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {editingUserId !== user.id && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingUserId(user.id);
                                                            setEditingUserName(user.full_name || '');
                                                            setEditingWispHubId(user.wisphub_id || '');
                                                            setEditingOperationalLevel(user.operational_level !== undefined ? user.operational_level : 1);
                                                            setEditingIsFieldTech(user.is_field_tech || false);
                                                            setEditingRole(user.role === 'admin' ? 'admin' : 'agente');
                                                            setEditingEmail(user.email || '');
                                                            setEditingAllowedMenus(user.allowed_menus || ["Dashboard"]);
                                                            setEditingNotificationEmail(user.notification_email || '');
                                                            setEditingPermissions(user.permissions || {});
                                                        }}
                                                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 text-[10px] font-black rounded-lg uppercase transition-all shadow-sm"
                                                    >
                                                        Editar
                                                    </button>
                                                    {user.id !== currentUser?.id && (
                                                        <button
                                                            onClick={() => handleDeleteUser(user.id, user.full_name || 'Agente')}
                                                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-300 text-[10px] font-black rounded-lg uppercase transition-all shadow-sm"
                                                            title="Eliminar Usuario"
                                                        >
                                                            Eliminar
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
