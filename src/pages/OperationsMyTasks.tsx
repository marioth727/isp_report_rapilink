import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, ChevronRight, X, MessageSquare, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WorkflowService } from '../lib/workflowService';
import { OperationsHeader } from '../components/operations/OperationsHeader';
import clsx from 'clsx';

export function OperationsMyTasks() {
    const [loading, setLoading] = useState(false);
    const [myTasks, setMyTasks] = useState<any[]>([]);
    const [selectedTask, setSelectedTask] = useState<any | null>(null);
    const [actionType, setActionType] = useState<'complete' | 'escalate' | null>(null);
    const [comment, setComment] = useState('');
    const [processing, setProcessing] = useState(false);

    const loadMyTasks = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            const identifiers = [user.email, user.id];
            if (profile?.full_name) identifiers.push(profile.full_name);
            if (user.user_metadata?.full_name) identifiers.push(user.user_metadata.full_name);
            if (profile?.wisphub_id) identifiers.push(profile.wisphub_id);

            const { data, error } = await supabase
                .from('workflow_workitems')
                .select('*, workflow_activities(name, id, process_id, workflow_processes(title, priority, process_type, metadata, reference_id))')
                .in('participant_id', identifiers.filter(Boolean))
                .eq('status', 'PE');

            if (!error) setMyTasks(data || []);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async () => {
        if (!selectedTask || !actionType || !comment.trim()) return;
        setProcessing(true);
        try {
            let success = false;
            if (actionType === 'complete') {
                success = await WorkflowService.completeAndSyncWorkItem(selectedTask.id, comment);
            } else {
                success = await WorkflowService.escalateWorkItem(selectedTask.id, comment);
            }

            if (success) {
                setSelectedTask(null);
                setComment('');
                loadMyTasks();
            }
        } finally {
            setProcessing(false);
        }
    };

    useEffect(() => {
        loadMyTasks();
    }, []);

    return (
        <div className="space-y-6">
            <OperationsHeader
                title="Mis Tareas"
                description="Tareas de aprobación y gestión asignadas a tu cuenta."
                onSyncComplete={loadMyTasks}
            />

            <div className="bg-card border border-border rounded-3xl p-8 animate-in fade-in duration-500">
                <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                    <CheckCircle2 className="text-green-500" /> Tareas Pendientes
                </h2>

                {loading ? (
                    <div className="p-12 text-center text-muted-foreground animate-pulse font-black uppercase tracking-widest">
                        Cargando asignaciones...
                    </div>
                ) : myTasks.length === 0 ? (
                    <div className="p-12 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-border">
                        <p className="text-muted-foreground font-bold">Sin tareas pendientes. ¡Todo al día!</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {myTasks.map((wi) => {
                            const currentLevel = wi.workflow_activities?.workflow_processes?.metadata?.current_level || 1;
                            return (
                                <div key={wi.id} className="group p-6 bg-muted/10 border border-border rounded-2xl flex items-center justify-between hover:bg-muted/20 transition-all">
                                    <div className="flex gap-4 items-center">
                                        <div className={clsx(
                                            "w-12 h-12 rounded-xl flex items-center justify-center font-black",
                                            wi.workflow_activities.workflow_processes.priority > 2 ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"
                                        )}>
                                            P{wi.workflow_activities.workflow_processes.priority}
                                        </div>
                                        <div>
                                            <h4 className="font-black uppercase text-sm">{wi.workflow_activities.workflow_processes.metadata?.ticket_subject || wi.workflow_activities.workflow_processes.title}</h4>
                                            <p className="text-xs text-muted-foreground font-bold">{wi.workflow_activities.name}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className={clsx(
                                                    "text-[9px] font-black px-2 py-0.5 rounded-md uppercase",
                                                    currentLevel === 1 ? "bg-blue-500/10 text-blue-500" :
                                                        currentLevel === 2 ? "bg-orange-500/10 text-orange-500" :
                                                            currentLevel === 3 ? "bg-purple-500/10 text-purple-500" :
                                                                "bg-red-500/10 text-red-500"
                                                )}>
                                                    NIVEL {currentLevel}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-orange-500">
                                                    <Clock size={12} />
                                                    <span className="text-[10px] font-black uppercase">
                                                        ID: {wi.workflow_activities.workflow_processes.reference_id || 'TICKET'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setSelectedTask(wi);
                                                setActionType('escalate');
                                            }}
                                            className="px-4 py-2 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 rounded-xl text-[10px] font-black uppercase transition-colors"
                                        >
                                            Escalar
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedTask(wi);
                                                setActionType('complete');
                                            }}
                                            className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-black shadow-lg shadow-green-500/20 flex items-center gap-2"
                                        >
                                            Finalizar <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal de Gestión */}
            {selectedTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border border-border w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <div>
                                <h3 className="text-lg font-black uppercase flex items-center gap-2">
                                    {actionType === 'complete' ? <CheckCircle2 className="text-green-500" /> : <AlertTriangle className="text-orange-500" />}
                                    {actionType === 'complete' ? 'Finalizar Tarea' : 'Escalar Proceso'}
                                </h3>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    {selectedTask.workflow_activities.workflow_processes.title}
                                </p>
                            </div>
                            <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-muted rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-2">
                                    <MessageSquare size={14} />
                                    {actionType === 'complete' ? 'Detalle de la solución / Pruebas' : 'Motivo del escalamiento'}
                                </label>
                                <textarea
                                    className="w-full h-32 bg-muted/50 border border-border rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                                    placeholder={actionType === 'complete' ? 'Describe qué se hizo para solucionar el caso...' : 'Explica por qué no se pudo solucionar en este nivel...'}
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <button
                                disabled={!comment.trim() || processing}
                                onClick={handleAction}
                                className={clsx(
                                    "w-full py-4 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2 transition-all shadow-xl",
                                    actionType === 'complete'
                                        ? "bg-green-500 hover:bg-green-600 text-white shadow-green-500/20"
                                        : "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20",
                                    (!comment.trim() || processing) && "opacity-50 cursor-not-allowed scale-95"
                                )}
                            >
                                {processing ? 'Procesando...' : (actionType === 'complete' ? 'Confirmar Solución' : 'Confirmar Escalamiento')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
