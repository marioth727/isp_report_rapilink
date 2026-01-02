
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { DailyReport } from '../types';
import clsx from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function ReportsList() {
    const [reports, setReports] = useState<DailyReport[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('daily_reports')
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: false });

            if (error) throw error;
            if (data) setReports(data);
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Historial de Reportes</h2>
                    <p className="text-muted-foreground mt-1">Revisa y gestiona tus registros anteriores.</p>
                </div>
                <Link
                    to="/reportes/nuevo"
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Reporte
                </Link>
            </div>

            {/* List Content */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-8 text-center text-muted-foreground">Cargando historial...</div>
                ) : reports.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                            <Calendar className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">No hay reportes aún</h3>
                        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                            Comienza a registrar tu actividad diaria para ver métricas y avances aquí.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b border-border">
                                <tr className="text-left text-muted-foreground">
                                    <th className="px-6 py-4 font-medium">Fecha</th>
                                    <th className="px-6 py-4 font-medium">Score</th>
                                    <th className="px-6 py-4 font-medium text-center">Llamadas</th>
                                    <th className="px-6 py-4 font-medium text-center">Ventas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {reports.map((report) => (
                                    <tr key={report.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-6 py-4 font-medium">
                                            {format(new Date(report.date + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: es })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={clsx(
                                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                                report.performance_score === 'VERDE' ? "bg-green-500/10 text-green-600 border-green-500/20" :
                                                    report.performance_score === 'AMARILLO' ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
                                                        "bg-red-500/10 text-red-600 border-red-500/20"
                                            )}>
                                                {report.performance_score || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">{report.metrics.contacts.made}</td>
                                        <td className="px-6 py-4 text-center">{report.metrics.conversion.accepted}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
