
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { CRMInteraction } from '../types';
import { startOfWeek, endOfWeek, eachDayOfInterval, format, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, Phone, CheckCircle, AlertTriangle, TrendingUp, PhoneOff } from 'lucide-react';

export function WeeklyReport() {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [interactions, setInteractions] = useState<CRMInteraction[]>([]);
    const [loading, setLoading] = useState(false);

    // Calculate week range based on selected date (Monday start)
    const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const endDate = endOfWeek(selectedDate, { weekStartsOn: 1 });

    // Generate days for table headers (Mon-Sat usually)
    const weekDays = eachDayOfInterval({ start: startDate, end: endDate });

    const [weeklyCallGoal, setWeeklyCallGoal] = useState(300);
    const [weeklySalesGoal, setWeeklySalesGoal] = useState(30);

    useEffect(() => {
        fetchWeeklyData();
        const savedConfig = localStorage.getItem('crm_config');
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            // Weekly Sales Goal = Daily Goal * 6 (Mon-Sat standard)
            if (parsed.dailyGoal) setWeeklySalesGoal(parsed.dailyGoal * 6);

            // Weekly Calls Goal = Daily Contact Threshold (Optimal) * 6
            // If explicit weekly goals per category exist, we could sum them, but "Total Calls" maps better to daily activity * days
            if (parsed.thresholds?.dailyContacts?.optimal) {
                setWeeklyCallGoal(parsed.thresholds.dailyContacts.optimal * 6);
            }
        }
    }, [selectedDate]);

    const fetchWeeklyData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch live interactions
            // We fetch a slightly wider range (UTC buffer) to ensure we catch everything
            const { data, error } = await supabase
                .from('crm_interactions')
                .select('*')
                .eq('user_id', user.id)
                .gte('created_at', format(startDate, "yyyy-MM-dd'T'00:00:00"))
                .lte('created_at', format(endDate, "yyyy-MM-dd'T'23:59:59"));

            if (error) throw error;
            setInteractions(data || []);
        } catch (error) {
            console.error('Error fetching weekly data:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- LIVE AGGREGATION LOGIC ---

    // 1. Group interactions by day for the chart using LOCAL TIME comparison
    const dailyStats = weekDays.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');

        // Filter interactions checking if interaction date (converted to local) is same as 'day'
        const dayInteractions = interactions.filter(i => {
            if (!i.created_at) return false;
            return isSameDay(new Date(i.created_at), day);
        });

        return {
            name: format(day, 'EEE', { locale: es }),
            date: dateStr,
            fullDate: day,
            llamadas: dayInteractions.length,
            ventas: dayInteractions.filter(i => i.result === 'Aceptó Migración').length,
            interactions: dayInteractions
        };
    });

    // 2. Calculate Totals

    const totalSales = interactions.filter(i => i.result === 'Aceptó Migración').length;
    const totalRejected = interactions.filter(i => i.result.includes('Rechazó') || i.result === 'Lo pensará').length;
    const totalHungUp = interactions.filter(i => i.result === 'Cuelgan' || i.result === 'No contesta').length;

    // Effective Calls excludes "No Answer/Hung Up"
    const effectiveCalls = interactions.filter(i =>
        ['Aceptó Migración', 'Rechazó (Mantiene)', 'Rechazó (Cancelación)', 'Lo pensará'].includes(i.result)
    ).length;

    const conversionRate = effectiveCalls > 0 ? Math.round((totalSales / effectiveCalls) * 100) : 0;

    // 3. Aggregate Categories
    const categoryStats = new Map<string, { contacted: number, accepted: number }>();
    interactions.forEach(i => {
        if (!i.migration_category) return;
        const current = categoryStats.get(i.migration_category) || { contacted: 0, accepted: 0 };
        categoryStats.set(i.migration_category, {
            contacted: current.contacted + 1,
            accepted: current.accepted + (i.result === 'Aceptó Migración' ? 1 : 0)
        });
    });

    // 4. Aggregate Objections (Only for rejections/pending)
    const objectionStats = new Map<string, number>();
    interactions.filter(i => i.result !== 'Aceptó Migración').forEach(i => {
        const obj = i.objection;
        if (obj) {
            const current = objectionStats.get(obj) || 0;
            objectionStats.set(obj, current + 1);
        }
    });

    const topObjections = Array.from(objectionStats.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // 5. Special Cases
    const specialCases = interactions.filter(i => i.is_special_case);

    return (
        <div className="space-y-8 pb-12">
            {/* Header & Date Picker */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-xl border border-border shadow-sm">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Reporte Semanal en Vivo</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Semana del <span className="font-bold text-foreground">{format(startDate, "d 'de' MMMM", { locale: es })}</span> al <span className="font-bold text-foreground">{format(endDate, "d 'de' MMMM", { locale: es })}</span>
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-background border border-border rounded-lg p-2 shadow-sm">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <input
                        type="date"
                        value={format(selectedDate, 'yyyy-MM-dd')}
                        onChange={(e) => setSelectedDate(new Date(e.target.value))}
                        className="bg-transparent border-none focus:outline-none text-foreground font-medium"
                    />
                </div>
            </div>

            {/* Weekly Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <SummaryCard title="Contactos Efectivos" value={effectiveCalls} sub={`Meta Semanal: ${weeklyCallGoal}`} icon={Phone} color="text-blue-500" bg="bg-blue-500/10" />
                <SummaryCard title="Total Ventas" value={totalSales} sub={`Meta Semanal: ${weeklySalesGoal}`} icon={CheckCircle} color="text-green-500" bg="bg-green-500/10" />
                <SummaryCard title="Conversión" value={`${conversionRate}%`} sub="Promedio real" icon={TrendingUp} color="text-indigo-500" bg="bg-indigo-500/10" />
                <SummaryCard title="Rechazos/Pend" value={totalRejected} sub="Oportunidades perdidas" icon={AlertTriangle} color="text-red-500" bg="bg-red-500/10" />
                <SummaryCard title="Sin Contacto" value={totalHungUp} sub="Cuelgan / No contesta" icon={PhoneOff} color="text-orange-500" bg="bg-orange-500/10" />
            </div>

            {/* Chart & Detailed Table */}
            <div className="grid gap-8 md:grid-cols-3">

                {/* Chart */}
                <div className="col-span-3 lg:col-span-2 bg-card p-6 rounded-xl border border-border">
                    <h3 className="text-lg font-semibold mb-6">Tendencia Diaria</h3>
                    {!loading ? (
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dailyStats}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Bar dataKey="llamadas" name="Llamadas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                    <Bar dataKey="ventas" name="Ventas" fill="hsl(var(--chart-sales))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <div className="h-[300px] flex items-center justify-center text-muted-foreground">Cargando datos...</div>}
                </div>

                {/* Status List (Replacing "Missing Reports" with "Daily Activity") */}
                <div className="col-span-3 lg:col-span-1 space-y-4">
                    <h3 className="text-lg font-semibold px-1">Actividad Diaria</h3>
                    <div className="space-y-2">
                        {dailyStats.slice(0, 6).map(stat => {
                            // Showing all days Mon-Sat regardless of date
                            const hasActivity = stat.llamadas > 0;

                            return (
                                <div key={stat.date} className={`flex items-center justify-between p-3 rounded-lg border ${hasActivity ? 'bg-secondary/40 border-secondary' : 'bg-muted/20 border-border/50'}`}>
                                    <span className="capitalize text-sm font-medium">{format(stat.fullDate, 'EEEE d', { locale: es })}</span>
                                    {hasActivity ? (
                                        <span className="text-xs font-mono font-medium text-foreground">
                                            {stat.llamadas} gestiones / <span className="text-green-500">{stat.ventas} ventas</span>
                                        </span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground italic">Sin actividad</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Category Performance */}
                <div className="bg-card p-6 rounded-xl border border-border">
                    <h3 className="text-lg font-semibold mb-4">Rendimiento por Categoría</h3>
                    <div className="space-y-3">
                        {Array.from(categoryStats.entries()).map(([name, stats]) => (
                            <div key={name} className="flex justify-between items-center text-sm p-2 hover:bg-muted/30 rounded transition-colors">
                                <span className="font-medium">{name}</span>
                                <div className="text-right">
                                    <span className="block font-bold text-green-600">{stats.accepted} Ventas</span>
                                    <span className="text-xs text-muted-foreground">{stats.contacted} Contactos</span>
                                </div>
                            </div>
                        ))}
                        {categoryStats.size === 0 && <p className="text-muted-foreground text-sm">Sin datos de categorías.</p>}
                    </div>
                </div>

                {/* Top Objections */}
                <div className="bg-card p-6 rounded-xl border border-border">
                    <h3 className="text-lg font-semibold mb-4">Top 5 Objeciones</h3>
                    <div className="space-y-3">
                        {topObjections.map((obj, i) => (
                            <div key={obj.name} className="flex items-center justify-between text-sm p-2 bg-red-500/5 border border-red-500/10 rounded">
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-background border text-xs font-bold text-muted-foreground">{i + 1}</span>
                                    <span>{obj.name}</span>
                                </div>
                                <span className="font-bold text-red-600">{obj.count}</span>
                            </div>
                        ))}
                        {topObjections.length === 0 && <p className="text-muted-foreground text-sm">Sin objeciones registradas.</p>}
                    </div>
                </div>
            </div>

            {/* Special Cases Aggregation */}
            <div className="bg-card p-6 rounded-xl border border-border">
                <h3 className="text-lg font-semibold mb-4">Resumen de Casos Especiales</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {specialCases.length > 0 ? (
                        specialCases.map((sc, idx) => (
                            <div key={idx} className="p-3 bg-muted/20 border border-border/50 rounded-lg text-sm">
                                <div className="text-xs text-muted-foreground mb-1 font-mono">
                                    {sc.created_at && format(parseISO(sc.created_at), 'dd/MM HH:mm')}
                                </div>
                                <div className="font-bold text-indigo-400 mb-1">{sc.client_reference}</div>
                                <div className="font-medium text-foreground">{sc.special_case_description}</div>
                                {sc.special_case_number && <div className="text-xs text-muted-foreground mt-1">Ref: {sc.special_case_number}</div>}
                            </div>
                        ))
                    ) : (
                        <p className="text-muted-foreground text-sm italic col-span-full text-center py-4">No se reportaron casos especiales esta semana.</p>
                    )}
                </div>
            </div>

        </div>
    );
}

function SummaryCard({ title, value, sub, icon: Icon, color, bg }: any) {
    return (
        <div className="p-6 bg-card rounded-xl border border-border shadow-sm">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <h4 className="text-3xl font-bold mt-2 text-foreground">{value}</h4>
                </div>
                <div className={`p-3 rounded-xl ${bg} ${color}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4 font-medium">{sub}</p>
        </div>
    )
}
