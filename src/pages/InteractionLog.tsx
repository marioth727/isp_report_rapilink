
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { InteractionForm } from '../components/crm/InteractionForm';
import type { CRMInteraction } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, LayoutList, ArrowRight, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import clsx from 'clsx';
import { Link } from 'react-router-dom';

import { Trash2, Pencil } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { WispHubClient } from '../lib/wisphub';

export function InteractionLog() {
    const [interactions, setInteractions] = useState<CRMInteraction[]>([]);
    const [editingInteraction, setEditingInteraction] = useState<CRMInteraction | null>(null);
    const [selectedDateFilter, setSelectedDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);

    const location = useLocation();
    const navigate = useNavigate(); // Add hook
    const preSelectedClient = location.state?.selectedClient as WispHubClient | undefined;
    const previousInteraction = location.state?.previousInteraction as CRMInteraction | undefined;
    const returnPage = location.state?.returnPage as number | undefined; // Capture page

    useEffect(() => {
        fetchInteractions();
    }, [selectedDateFilter]);

    const fetchInteractions = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Correctly calculate start and end of SELECTED DAY in Local Time converted to UTC for DB Query
        // OR simpler: Fetch created_at >= SelectedDay 00:00 (Local) and < NextDay 00:00 (Local)

        // Let's rely on date string comparison in JS after fetching more data OR use ISO strings carefully.
        // The safest way without complex libs on frontend->db is to filter locally if data volume is small,
        // BUT for a log, we should query somewhat correctly.

        // Note: 'selectedDateFilter' is 'YYYY-MM-DD' from the input which is LOCAL time representation.
        // We want records where Local(created_at).to_date_string() === selectedDateFilter.

        // Since Supabase generic filtering on computed local time is hard without RPC, 
        // we can fetch a range that definitely covers the local day (e.g. UTC day -1 to UTC day +1) and filter in JS.
        // Or simply: 

        const { data } = await supabase
            .from('crm_interactions')
            .select('*')
            .eq('user_id', user.id)
            // Fetching a broad range to be safe (previous day UTC to next day UTC) is an easy hack
            // A more precise way:
            // 00:00 Local -> UTC ISO ?

            .order('created_at', { ascending: false });

        if (data) {
            // Client-side filtering to ensure exact local date match
            const filtered = data.filter(i => {
                if (!i.created_at) return false;
                // parsed local date
                const localDateStr = format(new Date(i.created_at), 'yyyy-MM-dd');
                return localDateStr === selectedDateFilter;
            });
            setInteractions(filtered);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este registro?')) return;

        const { error } = await supabase
            .from('crm_interactions')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Error eliminando: ' + error.message);
        } else {
            fetchInteractions();
            // If we deleted the item being edited, clear the form
            if (editingInteraction?.id === id) {
                setEditingInteraction(null);
            }
        }
    };

    const handleEdit = (interaction: CRMInteraction) => {
        setEditingInteraction(interaction);
        // Scroll to top to see form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSuccess = () => {
        if (preSelectedClient) {
            // Return to Campaign Manager preserving state
            navigate('/campanas', { state: { page: returnPage || 1 } });
        } else {
            fetchInteractions();
            setEditingInteraction(null);
        }
    };

    const handleExport = () => {
        if (interactions.length === 0) {
            alert('No hay datos para exportar en esta fecha.');
            return;
        }

        // Prepare data for Excel
        const dataToExport = interactions.map(i => ({
            Fecha: i.created_at ? format(new Date(i.created_at), 'dd/MM/yyyy') : '',
            Hora: i.created_at ? format(new Date(i.created_at), 'HH:mm:ss') : '',
            Cliente: i.client_reference,
            'Plan Actual': i.current_plan,
            Resultado: i.result,
            'Plan Sugerido': i.suggested_plan || '',
            Categoria: i.migration_category || '',
            Objecion: i.objection || '',
            'Es Caso Especial': i.is_special_case ? 'SI' : 'NO',
            'Descripcion Caso': i.special_case_description || '',
            'Numero Caso': i.special_case_number || ''
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        XLSX.utils.book_append_sheet(wb, ws, "Gestiones");

        const fileName = `reporte_gestiones_${selectedDateFilter}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="flex flex-col gap-8 pb-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Registro de Gestión Diaria</h2>
                    <p className="text-muted-foreground text-sm">
                        {editingInteraction
                            ? "Editando registro seleccionado..."
                            : "Registra cada interacción. Usa los guiones inteligentes para guiarte."}
                    </p>
                    {editingInteraction && (
                        <button
                            onClick={() => setEditingInteraction(null)}
                            className="text-xs text-red-500 hover:underline mt-1"
                        >
                            Cancelar edición
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {/* Stats Summary - Compact Horizontal */}
                    <div className="hidden md:flex items-center gap-4 bg-muted/20 px-4 py-2 rounded-lg border border-border/50 text-sm">
                        <div className="flex items-center gap-2">
                            <LayoutList className="w-4 h-4 text-muted-foreground" />
                            <span className="font-semibold">{interactions.length}</span> <span className="text-muted-foreground">Gestiones</span>
                        </div>
                        <div className="w-px h-4 bg-border"></div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-green-600">{interactions.filter(i => i.result === 'Aceptó Migración').length}</span> <span className="text-green-700/70 text-xs">Ventas</span>
                        </div>
                    </div>

                    <Link
                        to="/gestion/cerrar"
                        state={{ date: selectedDateFilter }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow-md transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
                    >
                        Cerrar Día <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>

            {/* Top Section: Input Form (Full Width) */}
            <div className="w-full">
                <InteractionForm onSuccess={handleSuccess} initialValues={editingInteraction} preSelectedClient={preSelectedClient} previousInteraction={previousInteraction} />
            </div>

        </div>
    );
}
