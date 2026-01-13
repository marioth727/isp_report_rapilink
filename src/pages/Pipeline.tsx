import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { supabase } from '../lib/supabase';
import type { PipelineStage, PipelineDeal } from '../types';
import {
    Plus,
    Phone,
    Clock,
    ArrowRight,
    AlertCircle,
    AlertTriangle,
    Settings2,
    Trash2,
    Kanban
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export function Pipeline() {
    const navigate = useNavigate();
    const [stages, setStages] = useState<PipelineStage[]>([]);
    const [deals, setDeals] = useState<PipelineDeal[]>([]);
    const [loading, setLoading] = useState(true);
    const [isConfiguring, setIsConfiguring] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch Stages
            const { data: stagesData, error: stagesError } = await supabase
                .from('pipeline_stages')
                .select('*')
                .eq('user_id', user.id)
                .order('order_index', { ascending: true });

            if (stagesError) throw stagesError;

            // If no stages, create defaults using upsert to prevent duplicates
            if (!stagesData || stagesData.length === 0) {
                const defaults = [
                    { name: '📍 Pendiente', order_index: 0, color: '#94a3b8', user_id: user.id },
                    { name: '🔄 Seguimiento', order_index: 1, color: '#fbbf24', user_id: user.id },
                    { name: '✅ Cierre Ganado', order_index: 2, color: '#10b981', user_id: user.id },
                    { name: '❌ Perdido', order_index: 3, color: '#f43f5e', user_id: user.id }
                ];
                const { data: newStages, error: insertError } = await supabase
                    .from('pipeline_stages')
                    .upsert(defaults, { onConflict: 'user_id,name' })
                    .select();

                if (insertError) throw insertError;
                setStages(newStages);
            } else {
                setStages(stagesData);
            }

            // Fetch Deals
            const { data: dealsData, error: dealsError } = await supabase
                .from('sales_pipeline')
                .select('*')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });

            if (dealsError) throw dealsError;
            setDeals(dealsData || []);

        } catch (error) {
            console.error('Error fetching pipeline data:', error);
        } finally {
            setLoading(false);
        }
    };

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        // 1. Update UI state optimistically
        const updatedDeals = Array.from(deals);
        const dealIndex = updatedDeals.findIndex(d => d.id === draggableId);
        if (dealIndex === -1) return;

        const [movedDeal] = updatedDeals.splice(dealIndex, 1);
        movedDeal.stage_id = destination.droppableId;
        updatedDeals.splice(destination.index, 0, movedDeal);

        setDeals(updatedDeals);

        // 2. Persist to DB
        try {
            const { error } = await supabase
                .from('sales_pipeline')
                .update({ stage_id: destination.droppableId, updated_at: new Date().toISOString() })
                .eq('id', draggableId);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating deal stage:', error);
            fetchData(); // Revert on error
        }
    };

    const handleAddDeal = () => {
        navigate('/campanas'); // Redirect to campaign manager to pick a client
    };

    const handleQuickAction = (deal: PipelineDeal) => {
        // Redirigir a la gestión de este cliente
        // El InteractionLog espera un 'WispHubClient' completo o al menos los campos clave
        navigate('/gestion', {
            state: {
                selectedClient: {
                    id_servicio: deal.client_id,
                    nombre: deal.client_name,
                    cedula: deal.cedula,
                    telefono: deal.phone,
                    plan_internet: { nombre: deal.suggested_plan || deal.current_plan || '' },
                    last_result: deal.last_result
                }
            }
        });
    };

    const handleAddStage = async () => {
        const name = prompt('Nombre del nuevo estado:');
        if (!name) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase
                .from('pipeline_stages')
                .insert([{
                    name,
                    order_index: stages.length,
                    user_id: user?.id,
                    color: '#3b82f6'
                }])
                .select()
                .single();

            if (error) throw error;
            setStages([...stages, data]);
        } catch (error) {
            console.error('Error adding stage:', error);
        }
    };

    const handleDeleteDeal = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('¿Estás seguro de eliminar este lead del pipeline?')) return;

        try {
            const { error } = await supabase
                .from('sales_pipeline')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setDeals(deals.filter(d => d.id !== id));
        } catch (error) {
            console.error('Error deleting deal:', error);
        }
    };

    const handleDeleteStage = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este estado? Las tarjetas asociadas se borrarán.')) return;

        try {
            const { error } = await supabase
                .from('pipeline_stages')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setStages(stages.filter(s => s.id !== id));
            setDeals(deals.filter(d => d.stage_id !== id));
        } catch (error) {
            console.error('Error deleting stage:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-muted-foreground animate-pulse">Cargando tu tubería de ventas...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Pipeline de Ventas</h2>
                    <p className="text-muted-foreground">Gestiona tus prospectos y cierres visualmente.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsConfiguring(!isConfiguring)}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                            isConfiguring ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
                        )}
                    >
                        <Settings2 className="w-4 h-4" />
                        Ajustes
                    </button>
                    <button
                        onClick={handleAddDeal}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Lead
                    </button>
                </div>
            </div>

            {/* Kanban Board */}
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar min-h-[70vh]">
                    {stages.map((stage) => (
                        <div key={stage.id} className="flex-shrink-0 w-80 flex flex-col gap-4">
                            {/* Column Header */}
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-2 h-6 rounded-full"
                                        style={{ backgroundColor: stage.color }}
                                    />
                                    <h3 className="font-bold text-sm uppercase tracking-wider">
                                        {stage.name}
                                    </h3>
                                    <span className="bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        {deals.filter(d => d.stage_id === stage.id).length}
                                    </span>
                                </div>
                                {isConfiguring && (
                                    <button
                                        onClick={() => handleDeleteStage(stage.id)}
                                        className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Droppable Area */}
                            <Droppable droppableId={stage.id}>
                                {(provided, snapshot) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className={clsx(
                                            "flex-1 flex flex-col gap-3 p-3 rounded-2xl transition-colors min-h-[150px]",
                                            snapshot.isDraggingOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-secondary/20"
                                        )}
                                    >
                                        {deals
                                            .filter(deal => deal.stage_id === stage.id)
                                            .map((deal, index) => (
                                                <Draggable
                                                    key={deal.id}
                                                    draggableId={deal.id}
                                                    index={index}
                                                >
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={clsx(
                                                                "bg-card p-4 rounded-xl border border-border shadow-sm hover:shadow-md transition-all group",
                                                                snapshot.isDragging && "rotate-2 scale-105 shadow-xl ring-2 ring-primary"
                                                            )}
                                                        >
                                                            <div className="flex flex-col gap-3">
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">
                                                                            {deal.client_name}
                                                                        </span>
                                                                        {deal.updated_at && (new Date().getTime() - new Date(deal.updated_at).getTime()) > (48 * 60 * 60 * 1000) && (
                                                                            <span className="inline-flex items-center gap-1 text-[8px] font-black text-white bg-orange-600 px-1.5 py-0.5 rounded-full uppercase tracking-tighter w-fit animate-pulse">
                                                                                <AlertTriangle className="w-2 h-2" /> Seguimiento Urgente
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-all">
                                                                        <button
                                                                            onClick={(e) => handleDeleteDeal(e, deal.id)}
                                                                            className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                                                                            title="Eliminar Lead"
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleQuickAction(deal)}
                                                                            className="p-1 bg-primary/10 text-primary rounded-lg transition-all hover:bg-primary hover:text-white"
                                                                            title="Gestionar"
                                                                        >
                                                                            <ArrowRight className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {deal.suggested_plan && (
                                                                    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-primary/5 text-primary text-[10px] font-bold rounded-lg uppercase">
                                                                        <Kanban className="w-3 h-3" />
                                                                        {deal.suggested_plan}
                                                                    </div>
                                                                )}

                                                                {deal.last_result && (
                                                                    <div className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                                                                        <AlertCircle className="w-3 h-3" />
                                                                        Resultado: {deal.last_result}
                                                                    </div>
                                                                )}

                                                                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                        <Clock className="w-3 h-3" />
                                                                        {deal.updated_at && formatDistanceToNow(new Date(deal.updated_at), { addSuffix: true, locale: es })}
                                                                    </div>
                                                                    {deal.phone && (
                                                                        <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                                                                            <Phone className="w-3 h-3" />
                                                                            {deal.phone}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                        {provided.placeholder}

                                        {deals.filter(d => d.stage_id === stage.id).length === 0 && !snapshot.isDraggingOver && (
                                            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/40 border-2 border-dashed border-border/50 rounded-xl">
                                                <Kanban className="w-8 h-8 mb-2" />
                                                <span className="text-xs font-medium">Vacío</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}

                    {isConfiguring && (
                        <button
                            onClick={handleAddStage}
                            className="flex-shrink-0 w-80 h-16 border-2 border-dashed border-border rounded-2xl flex items-center justify-center gap-2 text-muted-foreground hover:bg-secondary/50 transition-all border-spacing-4"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="font-bold text-sm uppercase tracking-widest">Añadir Estado</span>
                        </button>
                    )}
                </div>
            </DragDropContext>

            {/* Empty State when no stages at all (shouldn't happen with defaults) */}
            {stages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center">
                        <AlertCircle className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">No hay estados configurados</h3>
                        <p className="text-muted-foreground">Crea tu primer estado para empezar a gestionar leads.</p>
                    </div>
                    <button
                        onClick={handleAddStage}
                        className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all"
                    >
                        Configurar Pipeline
                    </button>
                </div>
            )}
        </div>
    );
}
