import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, ChevronRight, X, MessageSquare, AlertTriangle, RefreshCw, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WorkflowService } from '../lib/workflowService';
import { OperationsHeader } from '../components/operations/OperationsHeader';
import clsx from 'clsx';

export function OperationsMyTasks() {
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [myTasks, setMyTasks] = useState<any[]>([]);
    const [selectedTask, setSelectedTask] = useState<any | null>(null);
    const [actionType, setActionType] = useState<'complete' | 'escalate' | null>(null);
    const [comment, setComment] = useState('');
    const [targetTechnician, setTargetTechnician] = useState('');
    const [processing, setProcessing] = useState(false);
    const [platformUsers, setPlatformUsers] = useState<any[]>([]);
    const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
    const [priority, setPriority] = useState<number>(2);

    // Función principal: Cargar tareas desde Supabase
    const loadMyTasks = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            console.info('[MyTasks] 📥 Cargando tareas pendientes desde Supabase...');
            console.log(`[DEBUG] Current Auth User ID: ${user.id}`);
            console.log(`[DEBUG] Current Auth User Email: ${user.email}`);

            // Resolvemos el perfil (mismo fallback que el servicio)
            let { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
            if (!profile && user.email) {
                const { data: emailProfile } = await supabase.from('profiles').select('id').eq('email', user.email).maybeSingle();
                profile = emailProfile;
                if (profile) console.log(`[DEBUG] Identity linked via email. Using Profile ID: ${profile.id}`);
            }

            const targetParticipantId = profile?.id || user.id;

            // Query simple con joins necesarios
            const { data, error } = await supabase
                .from('workflow_workitems')
                .select(`
                    id,
                    status,
                    participant_id,
                    created_at,
                    workflow_activities (
                        name,
                        workflow_processes (
                            title,
                            reference_id,
                            priority,
                            metadata
                        )
                    )
                `)
                .eq('participant_id', targetParticipantId)
                .eq('status', 'PE')
                .order('created_at', { ascending: false });

            if (error) throw error;

            setMyTasks(data || []);
            // console.info(`[MyTasks] ✅ ${data?.length || 0} tareas visualizadas.`); // Reducir ruido
        } catch (error) {
            console.error('[MyTasks] ❌ Error cargando tareas:', error);
        } finally {
            setLoading(false);
        }
    };

    // Función para completar o escalar
    const handleAction = async () => {
        if (!selectedTask || !actionType || !comment.trim()) return;
        setProcessing(true);
        try {
            let success = false;
            // Preparamos opciones (Prioridad y Archivo)
            const options = {
                priority: priority,
                file: evidenceFile || undefined
            };

            if (actionType === 'complete') {
                success = await WorkflowService.completeAndSyncWorkItem(selectedTask.id, comment, options);
            } else {
                // Pasamos options directamente: ahora escalateWorkItem maneja la sincronización FULL PUT internamente
                success = await WorkflowService.escalateWorkItem(selectedTask.id, comment, targetTechnician || undefined, options);
            }

            if (success) {
                console.info('[MyTasks] ✅ Acción completada con éxito.');
                setSelectedTask(null);
                setComment('');
                setTargetTechnician('');
                setEvidenceFile(null);
                setPriority(2);
                await loadMyTasks();
            }
        } catch (error) {
            console.error('[MyTasks] ❌ Error en acción:', error);
        } finally {
            setProcessing(false);
        }
    };

    // Función para sincronización profunda (60 días)
    const handleDeepSync = async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            console.log('[MyTasks] 🚀 Iniciando Sincronización Profunda (60 días)...');
            await WorkflowService.syncMyTickets(true);
            await loadMyTasks();
            console.log('[MyTasks] ✅ Sincronización Profunda completada.');
        } catch (error) {
            console.error('[MyTasks] ❌ Error en Deep Sync:', error);
        } finally {
            setSyncing(false);
        }
    };

    const loadPlatformData = async () => {
        console.log('[DEBUG] Iniciando carga de usuarios de la plataforma...');
        const users = await WorkflowService.getPlatformUsers();
        console.log('[DEBUG] Usuarios cargados:', users.length);
        console.log('[DEBUG] Muestra de usuarios:', users.slice(0, 3));
        setPlatformUsers(users);
    };

    // CICLO DE VIDA (Patrón SWR)
    useEffect(() => {
        const init = async () => {
            // 1. Carga INMEDIATA de datos locales (SWR)
            await loadPlatformData();
            await loadMyTasks();

            // 2. Sincronización en SEGUNDO PLANO (Background)
            setSyncing(true);
            try {
                console.log('[OperationsMyTasks] 🔄 Ejecutando Sincronización Espejo (Background)...');
                await WorkflowService.syncMyTickets(); // Default (15 días)
                // 3. Refrescar datos silenciosamente tras sync
                await loadMyTasks();
            } finally {
                setSyncing(false);
            }
        };
        init();
    }, []);

    return (
        <div className="space-y-6">
            <OperationsHeader
                title="Mis Tareas"
                description="Gestión centralizada de tickets y órdenes de servicio."
                onSyncComplete={loadMyTasks}
                customAction={
                    <div className="flex items-center gap-2">
                        {/* Indicador de Sincronización */}
                        {syncing && (
                            <div className="flex items-center gap-2 bg-zinc-50 text-zinc-600 px-3 py-1.5 rounded-full border border-zinc-200 animate-in fade-in shadow-sm">
                                <RefreshCw size={12} className="animate-spin text-zinc-400" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Sincronizando...</span>
                            </div>
                        )}

                        {/* Botón de Deep Sync */}
                        <button
                            onClick={handleDeepSync}
                            disabled={syncing}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            title="Buscar tickets de hasta 60 días de antigüedad"
                        >
                            <Layers size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Deep Sync</span>
                        </button>
                    </div>
                }
            />

            <div className="bg-white border border-zinc-200 rounded-3xl p-8 animate-in fade-in duration-500 shadow-sm">
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-zinc-900 tracking-tight">
                    <CheckCircle2 className="text-zinc-900" size={20} /> Tareas Pendientes
                </h2>

                {loading ? (
                    <div className="p-12 text-center text-zinc-400 animate-pulse font-bold uppercase tracking-widest text-xs">
                        Sincronizando con la nube...
                    </div>
                ) : myTasks.length === 0 ? (
                    <div className="p-12 text-center bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 group hover:border-zinc-300 transition-colors">
                        <p className="text-zinc-500 font-medium group-hover:text-zinc-700 transition-colors text-sm">
                            Sin tareas pendientes. ¡Todo al día!
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {myTasks.map((wi) => {
                            const proc = wi.workflow_activities?.workflow_processes;
                            const ticketId = proc?.reference_id || '---';

                            return (
                                <div key={wi.id} className="group p-5 bg-white border border-zinc-200 rounded-2xl flex items-center justify-between hover:shadow-md hover:border-zinc-300 transition-all">
                                    <div className="flex gap-5 items-center flex-1">
                                        <div className={clsx(
                                            "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border",
                                            (proc?.metadata?.current_level ?? 1) > 2
                                                ? "bg-red-50 text-red-600 border-red-100"
                                                : "bg-zinc-50 text-zinc-700 border-zinc-100"
                                        )}>
                                            {proc?.metadata?.current_level ?? 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold uppercase text-sm truncate pr-4 text-zinc-900">
                                                {proc?.title || 'Sin Título'}
                                            </h4>

                                            <p className="text-xs text-zinc-500 mt-1 truncate">
                                                <span className="font-bold text-zinc-800">Ticket: </span> #{ticketId}
                                                <span className="mx-2 text-zinc-300">|</span>
                                                <span className="font-bold text-zinc-800">Cliente: </span>
                                                <span className="text-zinc-600 font-bold uppercase">{proc?.metadata?.nombre_cliente || 'Desconocido'}</span>
                                            </p>

                                            <p className="text-[10px] text-muted-foreground mt-1 truncate">
                                                <span className="font-bold">Asunto: </span>
                                                {proc?.metadata?.asunto || 'No especificado'}
                                            </p>

                                            <div className="flex items-center gap-3 mt-2.5">
                                                <span className="text-[9px] font-bold px-2 py-1 rounded-md uppercase bg-zinc-100 text-zinc-600 border border-zinc-200 tracking-wide">
                                                    {wi.workflow_activities?.name || 'SOPORTE'}
                                                </span>

                                                {/* Badge de Prioridad */}
                                                <span className={clsx(
                                                    "text-[9px] font-bold px-2 py-1 rounded-md uppercase border tracking-wide",
                                                    proc?.metadata?.prioridad === 'Muy Alta' && "bg-red-50 text-red-700 border-red-100",
                                                    proc?.metadata?.prioridad === 'Alta' && "bg-orange-50 text-orange-700 border-orange-100",
                                                    proc?.metadata?.prioridad === 'Normal' && "bg-blue-50 text-blue-700 border-blue-100",
                                                    (proc?.metadata?.prioridad === 'Baja' || proc?.metadata?.prioridad === 'Media') && "bg-emerald-50 text-emerald-700 border-emerald-100",
                                                    !proc?.metadata?.prioridad && "bg-zinc-50 text-zinc-500 border-zinc-100"
                                                )}>
                                                    {proc?.metadata?.prioridad || 'Sin prioridad'}
                                                </span>

                                                {/* Badge de Estado */}
                                                {(() => {
                                                    const estadoId = proc?.metadata?.id_estado || proc?.metadata?.estado_id;
                                                    const estadoMap: Record<number, string> = {
                                                        1: 'Abierto',
                                                        2: 'En Progreso',
                                                        3: 'Resuelto',
                                                        4: 'Cerrado'
                                                    };
                                                    const estadoTexto = estadoId ? estadoMap[Number(estadoId)] || proc?.metadata?.estado || 'Desconocido' : (proc?.metadata?.estado || 'Sin estado');

                                                    return (
                                                        <span className={clsx(
                                                            "text-[9px] font-bold px-2 py-1 rounded-md uppercase border tracking-wide",
                                                            estadoTexto === 'Abierto' && "bg-yellow-50 text-yellow-700 border-yellow-100",
                                                            estadoTexto === 'En Progreso' && "bg-blue-50 text-blue-700 border-blue-100",
                                                            (estadoTexto === 'Cerrado' || estadoTexto === 'Resuelto') && "bg-emerald-50 text-emerald-700 border-emerald-100",
                                                            !estadoTexto && "bg-zinc-50 text-zinc-500 border-zinc-100"
                                                        )}>
                                                            {estadoTexto}
                                                        </span>
                                                    );
                                                })()}

                                                <div className="flex items-center gap-1.5 text-zinc-400">
                                                    <Clock size={10} />
                                                    <span className="text-[9px] font-bold uppercase">
                                                        {proc?.metadata?.fecha_creacion ? new Date(proc.metadata.fecha_creacion).toLocaleDateString() : new Date(wi.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                const currentPriorityStr = wi.workflow_activities?.workflow_processes?.priority || 'Media';
                                                const pMap: Record<string, number> = { "Baja": 1, "Normal": 2, "Media": 2, "Alta": 3, "Muy Alta": 4 };
                                                setPriority(pMap[currentPriorityStr] || 2);
                                                setSelectedTask(wi);
                                                setActionType('escalate');
                                            }}
                                            className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300 rounded-xl text-[10px] font-bold uppercase transition-all shadow-sm"
                                        >
                                            Escalar
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedTask(wi);
                                                setActionType('complete');
                                            }}
                                            className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white rounded-xl text-[10px] font-bold shadow-sm hover:shadow-lg hover:shadow-zinc-900/10 flex items-center gap-2 active:scale-95 transition-all uppercase tracking-wide"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white border border-zinc-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-white">
                            <div>
                                <h3 className="text-base font-bold uppercase flex items-center gap-2 text-zinc-900 tracking-tight">
                                    {actionType === 'complete' ? <CheckCircle2 className="text-emerald-600" size={18} /> : <AlertTriangle className="text-orange-500" size={18} />}
                                    {actionType === 'complete' ? 'Finalizar Tarea' : 'Escalar Proceso'}
                                </h3>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                                    Ticket #{selectedTask.workflow_activities?.workflow_processes?.reference_id}
                                </p>
                            </div>
                            <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-zinc-50 rounded-full transition-colors text-zinc-400 hover:text-zinc-600">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 bg-white">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-2 tracking-wide">
                                    <MessageSquare size={12} />
                                    {actionType === 'complete' ? 'Detalle de la solución' : 'Motivo del escalamiento'}
                                </label>
                                <textarea
                                    className="w-full h-32 bg-white border border-zinc-200 rounded-xl p-3 text-xs font-medium outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-50 transition-all resize-none placeholder:text-zinc-300 text-zinc-700"
                                    placeholder={actionType === 'complete' ? 'Describe qué se hizo para solucionar el caso...' : 'Explica por qué estás escalando este caso...'}
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {/* Campo de evidencia (imagen) - COMÚN para ambos modales */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase">Evidencia (Foto opcional)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                                    className="w-full text-[10px] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                                />
                                {evidenceFile && (
                                    <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                                        <CheckCircle2 size={10} className="text-primary" />
                                        Archivo seleccionado: {evidenceFile.name}
                                    </p>
                                )}
                            </div>

                            {actionType === 'escalate' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase">Nueva Prioridad</label>
                                        <select
                                            value={priority}
                                            onChange={(e) => setPriority(Number(e.target.value))}
                                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary"
                                        >
                                            <option value={1}>BAJA</option>
                                            <option value={2}>NORMAL</option>
                                            <option value={3}>ALTA</option>
                                            <option value={4}>MUY ALTA</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-2">
                                            <AlertTriangle size={14} className="text-orange-500" />
                                            Reasignar a
                                        </label>
                                        <select
                                            value={targetTechnician}
                                            onChange={(e) => setTargetTechnician(e.target.value)}
                                            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none appearance-none font-bold"
                                        >
                                            <option value="">Seleccionar responsable...</option>
                                            {(() => {
                                                const currentLevel = selectedTask?.workflow_activities?.workflow_processes?.metadata?.current_level ?? 1;
                                                let targetLevel = currentLevel + 1;
                                                if (currentLevel === 0 || currentLevel === 1) targetLevel = 2;

                                                console.log('[DEBUG FILTRO] Level actual:', currentLevel, '-> Level destino:', targetLevel);
                                                console.log('[DEBUG FILTRO] Total usuarios antes de filtrar:', platformUsers.length);

                                                const filtered = platformUsers.filter(u => {
                                                    const match = Number(u.operational_level) === targetLevel;
                                                    if (!match) {
                                                        console.log('[DEBUG FILTRO] Descartado:', u.full_name, 'nivel:', u.operational_level, 'esperado:', targetLevel);
                                                    }
                                                    return match;
                                                });

                                                console.log('[DEBUG FILTRO] Usuarios filtrados:', filtered.length, filtered.map(u => u.full_name));

                                                return filtered.map(u => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.full_name} ({u.wisphub_id || 'Sin ID'})
                                                    </option>
                                                ));
                                            })()}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <button
                                disabled={!comment.trim() || processing}
                                onClick={handleAction}
                                className={clsx(
                                    "w-full py-3.5 rounded-xl font-bold uppercase text-xs flex items-center justify-center gap-2 transition-all shadow-sm",
                                    actionType === 'complete'
                                        ? "bg-zinc-900 text-white hover:bg-black hover:shadow-lg hover:shadow-zinc-900/10"
                                        : "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/20",
                                    (!comment.trim() || processing) && "opacity-50 cursor-not-allowed scale-95"
                                )}
                            >
                                {processing ? 'Procesando...' : 'Confirmar Acción'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
