
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { CRMInteraction } from '../types';
import { format } from 'date-fns';
import { History, Download, Trash2, Pencil, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import clsx from 'clsx';
import { InteractionForm } from '../components/crm/InteractionForm';

export function InteractionHistory() {
    const [interactions, setInteractions] = useState<CRMInteraction[]>([]);
    const [selectedDateFilter, setSelectedDateFilter] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [editingInteraction, setEditingInteraction] = useState<CRMInteraction | null>(null);

    useEffect(() => {
        fetchInteractions();
    }, [selectedDateFilter]);

    const fetchInteractions = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('crm_interactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (data) {
            const filtered = data.filter(i => {
                if (!i.created_at) return false;
                // Forzar interpretación de la fecha UTC a local antes de formatear
                const interactionDate = new Date(i.created_at);
                const localDateStr = format(interactionDate, 'yyyy-MM-dd');
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
        }
    };

    const handleEdit = (interaction: CRMInteraction) => {
        setEditingInteraction(interaction);
    };

    const handleEditSuccess = () => {
        setEditingInteraction(null);
        fetchInteractions();
    };

    const handleExport = () => {
        if (interactions.length === 0) {
            alert('No hay datos para exportar en esta fecha.');
            return;
        }

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
        <div className="flex flex-col gap-8 pb-12 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Historial de Gestión</h2>
                    <p className="text-muted-foreground text-sm">
                        Consulta y administra todas las interacciones realizadas.
                    </p>
                </div>
            </div>

            <div className="w-full">
                <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col">
                    <div className="p-6 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <History className="w-5 h-5" /> Registros del {format(new Date(selectedDateFilter + 'T12:00:00'), 'dd/MM/yyyy')}
                        </h3>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded transition-colors"
                            >
                                <Download className="w-4 h-4" /> Excel
                            </button>
                            <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded">
                                <span className="text-xs text-muted-foreground ml-1">Fecha:</span>
                                <input
                                    type="date"
                                    value={selectedDateFilter}
                                    onChange={(e) => setSelectedDateFilter(e.target.value)}
                                    className="bg-transparent border-none text-sm focus:outline-none w-[110px]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto min-h-[300px]">
                        {interactions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-muted-foreground p-12 h-64">
                                <History className="w-12 h-12 mb-4 opacity-20" />
                                <p>No hay gestiones registradas para esta fecha.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 text-muted-foreground sticky top-0 backdrop-blur-sm z-10">
                                    <tr>
                                        <th className="p-3 font-medium">Hora</th>
                                        <th className="p-3 font-medium">Cliente</th>
                                        <th className="p-3 font-medium">Plan</th>
                                        <th className="p-3 font-medium">Resultado</th>
                                        <th className="p-3 font-medium">Detalle</th>
                                        <th className="p-3 font-medium text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {interactions.map((i) => (
                                        <tr key={i.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="p-3 font-mono text-xs text-muted-foreground">
                                                {i.created_at ? format(new Date(i.created_at), 'HH:mm') : '-'}
                                            </td>
                                            <td className="p-3 font-medium">{i.client_reference}</td>
                                            <td className="p-3 text-muted-foreground text-xs">{i.current_plan || '-'}</td>
                                            <td className="p-3">
                                                <span className={clsx(
                                                    "px-2 py-1 rounded-full text-xs font-bold",
                                                    i.result === 'Aceptó Migración' ? "bg-green-500/20 text-green-600" :
                                                        i.result.includes('Rechazó') ? "bg-red-500/20 text-red-600" :
                                                            "bg-secondary text-secondary-foreground"
                                                )}>
                                                    {i.result}
                                                </span>
                                            </td>
                                            <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate" title={i.objection || i.suggested_plan || ''}>
                                                {i.objection || i.suggested_plan || '-'}
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleEdit(i)}
                                                        className="p-1.5 hover:bg-blue-100 text-blue-600 rounded transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(i.id!)}
                                                        className="p-1.5 hover:bg-red-100 text-red-600 rounded transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Modal Overlay */}
            {editingInteraction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-card w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-border shadow-2xl relative">
                        <button
                            onClick={() => setEditingInteraction(null)}
                            className="absolute top-4 right-4 p-2 bg-secondary/80 hover:bg-secondary rounded-full text-foreground transition-colors z-10"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="p-6">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <Pencil className="w-5 h-5 text-blue-500" /> Editar Gestión
                            </h3>
                            <InteractionForm
                                onSuccess={handleEditSuccess}
                                initialValues={editingInteraction}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
