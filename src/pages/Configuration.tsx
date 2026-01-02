
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Save, Plus, Trash2, DollarSign, Target, Calculator, UserPlus } from 'lucide-react';

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
    const [creatingUser, setCreatingUser] = useState(false);

    const [newPlanName, setNewPlanName] = useState('');
    const [newPlanPrice, setNewPlanPrice] = useState('');
    const [loading, setLoading] = useState(true);

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

            alert(`Usuario ${newUserName} creado exitosamente. Se ha enviado un correo de confirmación (si aplica).`);
            setNewUserEmail('');
            setNewUserPassword('');
            setNewUserName('');
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
        } catch (err) {
            console.error('Error loading config:', err);
        } finally {
            setLoading(false);
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

                <form onSubmit={handleCreateUser} className="grid md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="text-xs font-medium mb-1 block">Nombre Completo</label>
                        <input
                            type="text"
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            className="w-full p-2 rounded-md border border-input bg-background text-sm"
                            placeholder="Ej. Ana García"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium mb-1 block">Correo Electrónico</label>
                        <input
                            type="email"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            className="w-full p-2 rounded-md border border-input bg-background text-sm"
                            placeholder="agente@rapilink.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium mb-1 block">Contraseña Provisional</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newUserPassword}
                                onChange={(e) => setNewUserPassword(e.target.value)}
                                className="w-full p-2 rounded-md border border-input bg-background text-sm"
                                placeholder="Mínimo 6 caracteres"
                                required
                                minLength={6}
                            />
                            <button
                                disabled={creatingUser}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                                {creatingUser ? '...' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

    );
}
