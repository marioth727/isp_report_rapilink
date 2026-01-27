
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
import { Users, AlertTriangle, Zap } from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

export function Dashboard() {
    const [interactions, setInteractions] = useState<CRMInteraction[]>([]);
    const [loading, setLoading] = useState(true);
    const [dailyGoal, setDailyGoal] = useState(5);
    const [thresholds, setThresholds] = useState<any>(undefined);
    const [planPrices, setPlanPrices] = useState<any[]>([]);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [staleLeads, setStaleLeads] = useState<any[]>([]);
    const [userName, setUserName] = useState<string>('Agente');

    // --- DATE FILTERING STATE (Corregido para zona horaria local Colombia UTC-5) ---
    const getLocalDateString = () => {
        const now = new Date();
        const offset = now.getTimezoneOffset(); // minutos
        const localDate = new Date(now.getTime() - offset * 60000);
        return localDate.toISOString().split('T')[0];
    };
    const [selectedDateFilter, setSelectedDateFilter] = useState<string>(getLocalDateString());

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

            // 2. Fetch User Name from profiles
            const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single();

            if (profileData?.full_name) {
                setUserName(profileData.full_name);
            }

            fetchDashboardData(user.id);
            fetchLeaderboard();
            fetchStaleLeads(user.id);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    const fetchLeaderboard = async () => {
        try {
            // Fetch interactions for everyone today
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('crm_interactions')
                .select('user_id, result')
                .gte('created_at', `${today}T00:00:00`);

            if (error) throw error;

            // Group by user (In a real app, we'd join with profiles table for names)
            // For now, we'll use the user_id or a mock name if available
            const counts = data.reduce((acc: any, curr) => {
                const uid = curr.user_id;
                if (!acc[uid]) acc[uid] = { id: uid, sales: 0, interactions: 0 };
                acc[uid].interactions++;
                if (curr.result === 'Aceptó Migración') acc[uid].sales++;
                return acc;
            }, {});

            const sorted = Object.values(counts)
                .sort((a: any, b: any) => b.sales - a.sales || b.interactions - a.interactions)
                .slice(0, 5);

            setLeaderboard(sorted);
        } catch (err) {
            console.error('Error fetching leaderboard:', err);
        }
    };

    const fetchStaleLeads = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('sales_pipeline')
                .select('*')
                .eq('user_id', userId)
                .neq('stage_id', 'ganado') // Assuming ID or just filter out closed
                .order('updated_at', { ascending: true });

            if (error) throw error;

            // Filter leads with more than 48 hours without update
            const fortyEightHoursAgo = subDays(new Date(), 2);
            const stale = (data || []).filter(deal =>
                new Date(deal.updated_at) < fortyEightHoursAgo &&
                !deal.stage_id.toLowerCase().includes('ganado') &&
                !deal.stage_id.toLowerCase().includes('perdido')
            );

            setStaleLeads(stale);
        } catch (err) {
            console.error('Error fetching stale leads:', err);
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

    const currentViewDate = new Date(`${selectedDateFilter}T12:00:00`);

    // 1. Metrics Calculation for Selected Date
    const todayInteractions = interactions.filter(i => {
        if (!i.created_at) return false;
        return format(new Date(i.created_at), 'yyyy-MM-dd') === selectedDateFilter;
    });

    const isViewToday = selectedDateFilter === getLocalDateString();

    const todayKpis = {
        calls: todayInteractions.length,
        sales: todayInteractions.filter(i => i.result === 'Aceptó Migración').length,
        rejected: todayInteractions.filter(i => i.result.includes('Rechazó') || i.result === 'Lo pensará').length,
        hung_up: todayInteractions.filter(i => i.result === 'Cuelgan' || i.result === 'No contesta').length,
        churn: todayInteractions.filter(i => i.result === 'Rechazó (Cancelación)').length,
        recoveryAttempts: todayInteractions.filter(i => i.migration_category === 'Suspendidos').length,
        recoverySales: todayInteractions.filter(i => i.migration_category === 'Suspendidos' && i.result === 'Aceptó Migración').length,
        npsScores: todayInteractions.map(i => i.nps).filter((n): n is number => typeof n === 'number')
    };

    const effectiveInteractions = todayInteractions.filter(i =>
        ['Aceptó Migración', 'Rechazó (Mantiene)', 'Rechazó (Cancelación)', 'Lo pensará'].includes(i.result)
    ).length;

    const conversionRate = effectiveInteractions > 0
        ? Math.round((todayKpis.sales / effectiveInteractions) * 100)
        : 0;

    const todayNpsScore = todayKpis.npsScores.length > 0
        ? ((todayKpis.npsScores.filter(s => s >= 9).length - todayKpis.npsScores.filter(s => s <= 6).length) / todayKpis.npsScores.length) * 100
        : 0;

    const chartData = Array.from({ length: 7 }).map((_, i) => {
        const d = subDays(currentViewDate, 6 - i);
        const dayInts = interactions.filter(interaction =>
            interaction.created_at && isSameDay(new Date(interaction.created_at), d)
        );

        return {
            date: format(d, 'dd MMM', { locale: es }),
            llamadas: dayInts.length,
            ventas: dayInts.filter(i => i.result === 'Aceptó Migración').length,
        };
    });

    const totalRevenue = todayInteractions
        .filter(i => i.result === 'Aceptó Migración' && i.suggested_plan)
        .reduce((sum, sale) => {
            const plan = planPrices.find((p: any) => p.name === sale.suggested_plan);
            return sum + (plan ? plan.price : 0);
        }, 0);

    const arpu = todayKpis.sales > 0 ? Math.round(totalRevenue / todayKpis.sales) : 0;
    const unlockedAchievements = calculateAchievements(todayInteractions, dailyGoal);

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="flex flex-col justify-center gap-6 bg-card p-6 rounded-xl border border-border shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <CheckCircle className="w-48 h-48" />
                    </div>
                    <div className="z-10 relative">
                        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 mb-4">
                            <div className="space-y-1">
                                <h2 className="text-3xl font-bold tracking-tight text-foreground bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">
                                    {isViewToday ? `Hola, ${userName}` : "Análisis Histórico"}
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
                <GoalProgress currentSales={todayKpis.sales} targetSales={dailyGoal} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1 h-full space-y-6">
                    {/* Leaderboard Section */}
                    <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                            <Users className="w-4 h-4" /> Top Agentes Hoy
                        </h3>
                        <div className="space-y-3">
                            {leaderboard.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-4 text-center">Iniciando competencia...</p>
                            ) : leaderboard.map((agent, idx) => (
                                <div key={agent.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                                    <div className="flex items-center gap-2">
                                        <span className={clsx(
                                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                                            idx === 0 ? "bg-yellow-500 text-white" :
                                                idx === 1 ? "bg-slate-300 text-slate-700" :
                                                    idx === 2 ? "bg-orange-400 text-white" : "bg-muted text-muted-foreground"
                                        )}>
                                            {idx + 1}
                                        </span>
                                        <span className="text-xs font-semibold truncate w-24">
                                            {agent.id === interactions[0]?.user_id ? "Tú" : `Agente ${agent.id.slice(0, 4)}`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-green-600">{agent.sales} Ventas</p>
                                            <p className="text-[9px] text-muted-foreground">{agent.interactions} Gestiones</p>
                                        </div>
                                        {idx === 0 && <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

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

                    {/* Stale Leads / Follow-up Alerts */}
                    {staleLeads.length > 0 && (
                        <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-xl space-y-4">
                            <h3 className="text-sm font-bold text-orange-700 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Seguimientos Pendientes
                            </h3>
                            <div className="space-y-2">
                                {staleLeads.slice(0, 3).map(lead => (
                                    <div key={lead.id} className="bg-background p-2 rounded-lg border border-orange-200/50 shadow-sm">
                                        <p className="text-xs font-bold truncate">{lead.client_name}</p>
                                        <p className="text-[9px] text-orange-600 font-medium">Hace {formatDistanceToNow(new Date(lead.updated_at), { locale: es })}</p>
                                    </div>
                                ))}
                                {staleLeads.length > 3 && (
                                    <p className="text-[10px] text-center text-orange-800 font-bold uppercase">
                                        + {staleLeads.length - 3} más por contactar
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="block lg:hidden">
                        <MedalCase unlockedIds={unlockedAchievements} />
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <KpiCard title="Gestiones Hoy" value={todayKpis.calls} icon={Phone} sub="Total contactados" color="text-blue-500" bg="bg-blue-500/10" />
                        <KpiCard title="Ventas Hoy" value={todayKpis.sales} icon={CheckCircle} sub="Cierres exitosos" color="text-green-500" bg="bg-green-500/10" />
                        <KpiCard title="Conversión" value={`${conversionRate}%`} icon={TrendingUp} sub="Efectividad Real" color={conversionRate >= 10 ? "text-indigo-500" : "text-yellow-500"} bg={conversionRate >= 10 ? "bg-indigo-500/10" : "bg-yellow-500/10"} />
                        <KpiCard title="Sin Contacto" value={todayKpis.hung_up} icon={PhoneOff} sub="Cuelgan / No contesta" color="text-red-400" bg="bg-red-500/10" />
                    </div>

                    <div className="hidden lg:block">
                        <MedalCase unlockedIds={unlockedAchievements} />
                    </div>

                    <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-muted-foreground" />
                            Tendencia últimos 7 días
                        </h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip cursor={{ fill: 'hsl(var(--muted)/0.2)' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} itemStyle={{ color: 'hsl(var(--foreground))' }} />
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
