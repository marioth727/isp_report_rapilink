import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Calendar, Search } from 'lucide-react';
import clsx from 'clsx';

interface DailySummary {
    date: string; // YYYY-MM-DD
    totalInteractions: number;
    sales: number;
    conversion: number;
}

export function DailyReportsList() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [summaries, setSummaries] = useState<DailySummary[]>([]);
    const [filterDate, setFilterDate] = useState('');

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch necessary fields to group by date
            const { data, error } = await supabase
                .from('crm_interactions')
                .select('created_at, result')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                // Group by date
                const grouped = data.reduce((acc, curr) => {
                    const date = curr.created_at ? curr.created_at.split('T')[0] : 'Desconocido';
                    if (!acc[date]) {
                        acc[date] = {
                            date,
                            totalInteractions: 0,
                            sales: 0,
                            conversion: 0
                        };
                    }
                    acc[date].totalInteractions++;
                    if (curr.result === 'Aceptó Migración') {
                        acc[date].sales++;
                    }
                    return acc;
                }, {} as Record<string, DailySummary>);

                // Calculate conversions and turn to array
                const summaryArray = Object.values(grouped).map(day => {
                    // Simple conversion rate: Sales / Total
                    // Note: This differs slightly from "Effective" logic but is good enough for a list view
                    const conversion = day.totalInteractions > 0
                        ? Math.round((day.sales / day.totalInteractions) * 100)
                        : 0;
                    return { ...day, conversion };
                }).sort((a, b) => b.date.localeCompare(a.date)); // Newest first

                setSummaries(summaryArray);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewReport = (dateStr: string) => {
        // Navigate to the generator with the selected date in state
        navigate('/reportes/diario/view', { state: { date: dateStr } });
    };

    const filteredSummaries = summaries.filter(s =>
        filterDate ? s.date === filterDate : true
    );

    if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando historial...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Historial de Reportes</h2>
                    <p className="text-muted-foreground">Consulta tus cierres diarios anteriores y descarga sus comprobantes.</p>
                </div>
                <div className="flex items-center gap-2 bg-card border border-input rounded-lg p-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="bg-transparent border-none focus:outline-none text-sm w-32"
                    />
                    {filterDate && (
                        <button
                            onClick={() => setFilterDate('')}
                            className="text-xs text-primary hover:underline px-2"
                        >
                            Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* Tabla con scroll horizontal */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 dark:bg-muted text-gray-700 dark:text-muted-foreground border-b border-border">
                            <tr>
                                <th className="p-4 font-medium whitespace-nowrap">Fecha</th>
                                <th className="p-4 font-medium text-center whitespace-nowrap">Gestiones</th>
                                <th className="p-4 font-medium text-center text-green-600 whitespace-nowrap">Ventas</th>
                                <th className="p-4 font-medium text-center whitespace-nowrap">Conversión</th>
                                <th className="p-4 font-medium text-right whitespace-nowrap">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {filteredSummaries.length > 0 ? (
                                filteredSummaries.map((day) => (
                                    <tr key={day.date} className="hover:bg-muted/50 transition-colors">
                                        <td className="p-4 font-medium flex items-center gap-2 whitespace-nowrap">
                                            <Calendar className="w-4 h-4 text-muted-foreground" />
                                            <span className="capitalize">{format(parseISO(day.date), "EEEE, d 'de' MMMM", { locale: es })}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs font-bold">
                                                {day.totalInteractions}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md text-xs font-bold">
                                                {day.sales}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <span className={clsx(
                                                    "font-bold",
                                                    day.conversion >= 20 ? "text-green-600" :
                                                        day.conversion >= 10 ? "text-yellow-600" : "text-red-600"
                                                )}>
                                                    {day.conversion.toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleViewReport(day.date)}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-md text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                            >
                                                <FileText className="w-3 h-3" />
                                                Ver
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                        No se encontraron reportes para esta fecha.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
