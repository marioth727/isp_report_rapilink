
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CRMInteraction } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Phone, CheckCircle, TrendingUp, PhoneOff } from 'lucide-react';
import { format, subDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

import { GoalProgress } from '../components/crm/GoalProgress';
import { PerformanceTrafficLight } from '../components/crm/PerformanceTrafficLight';
import { AgentLevelBadge } from '../components/crm/AgentLevelBadge';
import { MedalCase } from '../components/gamification/MedalCase';
import { calculateAchievements } from '../lib/achievements';

export function Dashboard() {
    const [interactions, setInteractions] = useState<CRMInteraction[]>([]);
    const [loading, setLoading] = useState(true);
    const [dailyGoal, setDailyGoal] = useState(5);
    const [thresholds, setThresholds] = useState<any>(undefined);
    const [planPrices, setPlanPrices] = useState<any[]>([]);

    // --- DATE FILTERING STATE (Moved up to fix Hook Error) ---
    const [selectedDateFilter, setSelectedDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Fetch Config
            const { data: configData } = await supabase
                .from('crm_config')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (configData) {
                if (configData.daily_goal) setDailyGoal(configData.daily_goal);
                if (configData.thresholds) setThresholds(configData.thresholds);
                if (configData.plan_prices) setPlanPrices(configData.plan_prices);
            }

            fetchDashboardData(user.id); // Trigger interactions fetch
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    const fetchDashboardData = async (userId: string) => {
        try {
            // Fetch last 7 days of interactions
            const sevenDaysAgo = subDays(new Date(), 7);

            const { data, error } = await supabase
                .from('crm_interactions')
                .select('*')
                .eq('user_id', userId)
                .gte('created_at', format(sevenDaysAgo, "yyyy-MM-dd'T'00:00:00"));

            if (error) throw error;
            setInteractions(data || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando tablero...</div>;

    // The "Today" for the dashboard is now the selected date (at noon to avoid timezone issues with start of day)
    const currentViewDate = new Date(`${selectedDateFilter}T12:00:00`);

    // 1. Metrics Calculation for Selected Date
    const todayInteractions = interactions.filter(i => {
        if (!i.created_at) return false;
        // Compare purely on date string YYYY-MM-DD
        return format(new Date(i.created_at), 'yyyy-MM-dd') === selectedDateFilter;
    });

    const isViewToday = selectedDateFilter === new Date().toISOString().split('T')[0];

    // --- LIVE METRICS CALCULATION ---

    const todayKpis = {
        calls: todayInteractions.length,
        sales: todayInteractions.filter(i => i.result === 'Aceptó Migración').length,
        rejected: todayInteractions.filter(i => i.result.includes('Rechazó') || i.result === 'Lo pensará').length,
        hung_up: todayInteractions.filter(i => i.result === 'Cuelgan' || i.result === 'No contesta').length,

        // Advanced Metrics for Semaphor
        churn: todayInteractions.filter(i => i.result === 'Rechazó (Cancelación)').length,

        recoveryAttempts: todayInteractions.filter(i => i.migration_category === 'Suspendidos').length,
        recoverySales: todayInteractions.filter(i => i.migration_category === 'Suspendidos' && i.result === 'Aceptó Migración').length,

        npsScores: todayInteractions
            .map(i => i.nps)
            .filter((n): n is number => typeof n === 'number')
    };

    // OPTION 2: Effective Conversion (Sales / (Sales + Rejections + Thinking))
    // Excludes: No Answer, Hung Up, Wrong Number
    const effectiveInteractions = todayInteractions.filter(i =>
        ['Aceptó Migración', 'Rechazó (Mantiene)', 'Rechazó (Cancelación)', 'Lo pensará'].includes(i.result)
    ).length;

    const conversionRate = effectiveInteractions > 0
        ? Math.round((todayKpis.sales / effectiveInteractions) * 100)
        : 0;

    // NPS Calculation reused from traffic light logic setup (moved up if needed, or re-accessed from todayKpis)
    const todayNpsScore = todayKpis.npsScores.length > 0
        ? ((todayKpis.npsScores.filter(s => s >= 9).length - todayKpis.npsScores.filter(s => s <= 6).length) / todayKpis.npsScores.length) * 100
        : 0;

    // ... (Chart Data logic remains same)
    // 2. Chart Data (Last 7 Days)
    const chartData = Array.from({ length: 7 }).map((_, i) => {
        const d = subDays(currentViewDate, 6 - i); // From 6 days ago to current view date
        const dayInts = interactions.filter(interaction =>
            interaction.created_at && isSameDay(new Date(interaction.created_at), d)
        );

        return {
            date: format(d, 'dd MMM', { locale: es }),
            fullDate: d,
            llamadas: dayInts.length,
            ventas: dayInts.filter(i => i.result === 'Aceptó Migración').length,
            isToday: isSameDay(d, currentViewDate)
        };
    });


    // --- ARPU CALCULATION ---
    // Fetch plan prices for calculation

    // Calculate Total Revenue from today's sales
    const totalRevenue = todayInteractions
        .filter(i => i.result === 'Aceptó Migración' && i.suggested_plan)
        .reduce((sum, sale) => {
            // Find price in catalog
            const plan = planPrices.find((p: any) => p.name === sale.suggested_plan);
            return sum + (plan ? plan.price : 0);
        }, 0);

    const arpu = todayKpis.sales > 0 ? Math.round(totalRevenue / todayKpis.sales) : 0;

    // --- ACHIEVEMENTS ---
    const unlockedAchievements = calculateAchievements(todayInteractions, dailyGoal);

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="flex flex-col justify-center gap-6 bg-card p-6 rounded-xl border border-border shadow-sm relative overflow-hidden">
                    {/* Background pattern */}
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <CheckCircle className="w-48 h-48" />
                    </div>

                    <div className="z-10 relative">
                        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 mb-4">
                            <div className="space-y-1">
                                <h2 className="text-3xl font-bold tracking-tight text-foreground bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">
                                    {isViewToday ? "Hola, Agente" : "Análisis Histórico"}
                                </h2>
                                <div className="flex items-center gap-2 text-muted-foreground mt-1 text-base">
                                    <span>Viendo datos del:</span>
                                    <input
                                        type="date"
                                        value={selectedDateFilter}
                                        onChange={(e) => setSelectedDateFilter(e.target.value)}
                                        className="bg-transparent border-b border-primary/20 text-foreground font-semibold focus:outline-none focus:border-primary text-sm"
                                    />
                                </div>
                            </div>
                            <AgentLevelBadge sales={todayKpis.sales} nps={todayNpsScore} />
                        </div>

                    </div>
                </div>

                {/* Gamification Goal Bar */}
                <GoalProgress currentSales={todayKpis.sales} targetSales={dailyGoal} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Traffic Light Panel (New) takes 1 column on large screens */}
                <div className="lg:col-span-1 h-full space-y-6">
                    <PerformanceTrafficLight
                        dailyCount={todayKpis.calls}
                        salesCount={todayKpis.sales}
                        churnCount={todayKpis.churn}
                        recoverySales={todayKpis.recoverySales}
                        recoveryAttempts={todayKpis.recoveryAttempts}
                        npsScores={todayKpis.npsScores}
                        arpu={arpu}
                        effectiveCount={effectiveInteractions}
                        thresholds={thresholds}
                    />

                    {/* Medal Case (New Position) */}
                    <div className="block lg:hidden">
                        <MedalCase unlockedIds={unlockedAchievements} />
                    </div>
                </div>

                {/* KPI Cards & Chart take 2 columns */}
                <div className="lg:col-span-2 space-y-6">
                    {/* KPI Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <KpiCard
                            title="Gestiones Hoy"
                            value={todayKpis.calls}
                            icon={Phone}
                            sub="Total contactados"
                            color="text-blue-500"
                            bg="bg-blue-500/10"
                        />
                        <KpiCard
                            title="Ventas Hoy"
                            value={todayKpis.sales}
                            icon={CheckCircle}
                            sub="Cierres exitosos"
                            color="text-green-500"
                            bg="bg-green-500/10"
                        />
                        <KpiCard
                            title="Conversión"
                            value={`${conversionRate}%`}
                            icon={TrendingUp}
                            sub="Efectividad Real"
                            color={conversionRate >= 10 ? "text-indigo-500" : "text-yellow-500"}
                            bg={conversionRate >= 10 ? "bg-indigo-500/10" : "bg-yellow-500/10"}
                        />
                        <KpiCard
                            title="Sin Contacto"
                            value={todayKpis.hung_up}
                            icon={PhoneOff}
                            sub="Cuelgan / No contesta"
                            color="text-red-400"
                            bg="bg-red-500/10"
                        />
                    </div>

                    {/* Medal Case (Desktop Position) */}
                    <div className="hidden lg:block">
                        <MedalCase unlockedIds={unlockedAchievements} />
                    </div>

                    {/* Main Chart */}
                    <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-muted-foreground" />
                            Tendencia últimos 7 días
                        </h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        stroke="hsl(var(--muted-foreground))"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        stroke="hsl(var(--muted-foreground))"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Bar dataKey="llamadas" name="Gestiones" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                    <Bar dataKey="ventas" name="Ventas" fill="hsl(var(--chart-sales))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function KpiCard({ title, value, icon: Icon, sub, color, bg }: any) {
    return (
        <div className="p-6 bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-300 group">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{title}</p>
                    <h4 className="text-4xl font-bold mt-2 text-foreground tracking-tight">{value}</h4>
                </div>
                <div className={`p-3 rounded-xl ${bg} ${color} transition-transform group-hover:scale-110`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-muted-foreground/80">
                {sub}
            </div>
        </div>
    );
}
