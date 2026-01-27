import { useState, useEffect } from 'react';
import {
    Activity,
    ClipboardList,
    ShieldAlert,
    CheckCircle2,
    Clock,
    ChevronRight,
    Search,
    BarChart3,
    RefreshCw
} from 'lucide-react';
import { TechnicianAnalytics } from './TechnicianAnalytics';
import { WorkflowService } from '../lib/workflowService';
import { supabase } from '../lib/supabase';
import type { WorkflowProcess } from '../lib/types/workflow';
import clsx from 'clsx';

export function OperationsHub() {
    const [activeTab, setActiveTab] = useState<'productivity' | 'tasks' | 'supervision'>('productivity');
    const [loading, setLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [myTasks, setMyTasks] = useState<any[]>([]);
    const [allProcesses, setAllProcesses] = useState<WorkflowProcess[]>([]);
    const [platformUsers, setPlatformUsers] = useState<any[]>([]);

    useEffect(() => {
        WorkflowService.getPlatformUsers().then(setPlatformUsers);
    }, []);

    useEffect(() => {
        handleAutoSync();
    }, []);

    const handleAutoSync = async (forceFull = false) => {
        setIsSyncing(true);
        await WorkflowService.syncWithWispHub(forceFull);
        setIsSyncing(false);
        loadCurrentTabData();
    };

    const loadCurrentTabData = () => {
        if (activeTab === 'tasks') loadMyTasks();
        if (activeTab === 'supervision') loadSupervision();
    };

    useEffect(() => {
        loadCurrentTabData();
    }, [activeTab]);

    const loadMyTasks = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Obtener el perfil completo para tener el nombre
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            // Buscamos tareas asignadas al email, al ID o al nombre completo
            const identifiers = [user.email, user.id];
            if (profile?.full_name) identifiers.push(profile.full_name);
            if (user.user_metadata?.full_name) identifiers.push(user.user_metadata.full_name);

            const { data, error } = await supabase
                .from('workflow_workitems')
                .select('*, workflow_activities(name, process_id, workflow_processes(title, priority, process_type))')
                .in('participant_id', identifiers.filter(Boolean))
                .eq('status', 'PE');

            if (!error) setMyTasks(data || []);
        } finally {
            setLoading(false);
        }
    };

    const loadSupervision = async () => {
        setLoading(true);
        try {
            // Traemos procesos con sus actividades y el workitem activo para ver quién lo tiene
            const { data, error } = await supabase
                .from('workflow_processes')
                .select(`
                    *,
                    workflow_activities(
                        name,
                        workflow_workitems(participant_id, status)
                    )
                `)
                .order('created_at', { ascending: false });

            if (!error) setAllProcesses(data || []);
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteTask = async (wiId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        await WorkflowService.completeWorkItem(wiId, user?.email || 'unknown');
        loadMyTasks();
    };

    const handleReassign = async (workItemId: string, newUserId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const success = await WorkflowService.reassignWorkItem(workItemId, newUserId, user.email || user.id);
        if (success) {
            alert('Responsable actualizado correctamente');
            loadSupervision();
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                        <Activity className="text-primary" size={32} />
                        Gestión & Operaciones
                    </h1>
                    <p className="text-muted-foreground font-medium">Panel centralizado de productividad y escalamiento operativo.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleAutoSync(false)}
                        disabled={isSyncing}
                        className={clsx(
                            "px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all",
                            isSyncing ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary hover:bg-primary/20 hover:shadow-lg active:scale-95"
                        )}
                        title="Sincronización rápida (últimos 7 días)"
                    >
                        <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                        {isSyncing ? "Sincronizando..." : "Rápida (7d)"}
                    </button>
                    <button
                        onClick={() => handleAutoSync(true)}
                        disabled={isSyncing}
                        className={clsx(
                            "px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all",
                            isSyncing ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:shadow-lg hover:shadow-primary/20 active:scale-95"
                        )}
                        title="Sincronización TOTAL (Sin límite de fecha - Trae TODO el historial)"
                    >
                        <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                        {isSyncing ? "Descargando..." : "Total (∞)"}
                    </button>
                </div>
            </header>

            {/* TABS NAVEGACIÓN */}
            <div className="flex p-1 bg-muted/50 rounded-2xl w-fit border border-border">
                <button
                    onClick={() => setActiveTab('productivity')}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
                        activeTab === 'productivity' ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <BarChart3 size={18} />
                    Productividad
                </button>
                <button
                    onClick={() => setActiveTab('tasks')}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
                        activeTab === 'tasks' ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <ClipboardList size={18} />
                    Mis Tareas
                </button>
                <button
                    onClick={() => setActiveTab('supervision')}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
                        activeTab === 'supervision' ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <ShieldAlert size={18} />
                    Supervisión
                </button>
            </div>

            <div className="animate-in fade-in duration-500">
                {activeTab === 'productivity' && (
                    <TechnicianAnalytics />
                )}

                {activeTab === 'tasks' && (
                    <div className="space-y-4">
                        <div className="bg-card border border-border rounded-3xl p-8">
                            <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                                <CheckCircle2 className="text-green-500" /> Tareas de Aprobación Pendientes
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
                                    {myTasks.map((wi) => (
                                        <div key={wi.id} className="group p-6 bg-muted/10 border border-border rounded-2xl flex items-center justify-between hover:bg-muted/20 transition-all">
                                            <div className="flex gap-4 items-center">
                                                <div className={clsx(
                                                    "w-12 h-12 rounded-xl flex items-center justify-center font-black",
                                                    wi.workflow_activities.workflow_processes.priority > 2 ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"
                                                )}>
                                                    P{wi.workflow_activities.workflow_processes.priority}
                                                </div>
                                                <div>
                                                    <h4 className="font-black uppercase text-sm">{wi.workflow_activities.workflow_processes.title}</h4>
                                                    <p className="text-xs text-muted-foreground font-bold">{wi.workflow_activities.name}</p>
                                                    <div className="flex items-center gap-3 mt-2">
                                                        <span className={clsx(
                                                            "text-[9px] font-black px-2 py-0.5 rounded-md uppercase",
                                                            wi.participant_type === 'U' ? "bg-blue-500/10 text-blue-500" :
                                                                wi.participant_type === 'SU' ? "bg-orange-500/10 text-orange-500" :
                                                                    "bg-purple-500/10 text-purple-500"
                                                        )}>
                                                            NIVEL {wi.workflow_activities?.workflow_processes?.metadata?.current_level || (wi.participant_type === 'U' ? '1' : wi.participant_type === 'SU' ? '2' : '3+')}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 text-orange-500">
                                                            <Clock size={12} />
                                                            <span className="text-[10px] font-black uppercase">
                                                                Vence: {new Date(wi.deadline).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleCompleteTask(wi.id)}
                                                className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-black shadow-lg shadow-green-500/20 flex items-center gap-2"
                                            >
                                                Finalizar Tarea <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'supervision' && (
                    <div className="space-y-4">
                        <div className="bg-card border border-border rounded-3xl overflow-hidden">
                            <div className="p-6 border-b border-border flex justify-between items-center">
                                <h2 className="text-xl font-black flex items-center gap-2 uppercase tracking-tight">
                                    <ShieldAlert className="text-primary" /> Consola de Administración Operativa
                                </h2>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Filtrar procesos..."
                                        className="bg-muted/50 border border-border rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:ring-1 focus:ring-primary transition-all"
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-muted/30 border-b border-border">
                                        <tr>
                                            <th className="p-4 text-left text-[10px] uppercase font-black tracking-widest text-muted-foreground">ID / Título</th>
                                            <th className="p-4 text-center text-[10px] uppercase font-black tracking-widest text-muted-foreground">Tipo</th>
                                            <th className="p-4 text-center text-[10px] uppercase font-black tracking-widest text-muted-foreground">Fase / Nivel</th>
                                            <th className="p-4 text-center text-[10px] uppercase font-black tracking-widest text-muted-foreground">Responsable</th>
                                            <th className="p-4 text-center text-[10px] uppercase font-black tracking-widest text-muted-foreground">Estado</th>
                                            <th className="p-4 text-center text-[10px] uppercase font-black tracking-widest text-muted-foreground">Prioridad</th>
                                            <th className="p-4 text-center text-[10px] uppercase font-black tracking-widest text-muted-foreground">Actualización</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {allProcesses.map((p) => (
                                            <tr key={p.id} className="hover:bg-muted/5 transition-colors group cursor-pointer">
                                                <td className="p-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black uppercase text-foreground">
                                                            {p.metadata?.client_name || p.title.split(' - ')[1] || p.title}
                                                        </span>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] font-bold text-primary font-mono bg-primary/5 px-1.5 py-0.5 rounded border border-primary/20">
                                                                ID: {p.reference_id || p.id.split('-')[0]}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="max-w-[150px] mx-auto text-[9px] font-black uppercase text-muted-foreground bg-muted/30 px-2 py-1.5 rounded-lg border border-border/50 truncate" title={p.metadata?.ticket_subject || p.title.split(' - ')[0]}>
                                                        {p.metadata?.ticket_subject || p.title.split(' - ')[0] || p.process_type}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className={clsx(
                                                            "text-[9px] font-black px-2 py-0.5 rounded-md uppercase",
                                                            (p.metadata?.current_level || 1) <= 2 ? "bg-blue-500/10 text-blue-500" :
                                                                (p.metadata?.current_level || 1) <= 4 ? "bg-orange-500/10 text-orange-500" :
                                                                    "bg-red-500/10 text-red-500"
                                                        )}>
                                                            NIVEL {p.metadata?.current_level || 1}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground font-bold mt-1">
                                                            {(p.metadata?.current_level || 1) === 1 ? 'OPERACIÓN' : 'ESCALAMIENTO'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <select
                                                            disabled={loading}
                                                            className="text-[10px] font-black bg-muted border border-border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary w-full max-w-[120px] mb-1"
                                                            value={(p as any).activities?.[0]?.workitems?.[0]?.participant_id || ''}
                                                            onChange={(e) => {
                                                                const wiId = (p as any).activities?.[0]?.workitems?.[0]?.id;
                                                                if (wiId) handleReassign(wiId, e.target.value);
                                                            }}
                                                        >
                                                            <option value="">Sin Asignar</option>
                                                            {platformUsers.map(u => (
                                                                <option key={u.id} value={u.email || u.id}>{u.display_name}</option>
                                                            ))}
                                                            {/* Fallback for external users not in platformUsers but assigned */}
                                                            {((p as any).activities?.[0]?.workitems?.[0]?.participant_id) && !platformUsers.find(u => (u.email || u.id) === (p as any).activities?.[0]?.workitems?.[0]?.participant_id) && (
                                                                <option value={(p as any).activities?.[0]?.workitems?.[0]?.participant_id}>{(p as any).activities?.[0]?.workitems?.[0]?.participant_id}</option>
                                                            )}
                                                        </select>
                                                        <span className="text-[8px] font-bold text-muted-foreground uppercase">Asignado Actual</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={clsx(
                                                        "px-3 py-1 rounded-full text-[9px] font-black uppercase inline-flex items-center gap-1.5",
                                                        p.status === 'SS' ? "bg-green-500/10 text-green-600" :
                                                            p.status === 'ES' ? "bg-red-500/10 text-red-600" :
                                                                p.status === 'ST' ? "bg-orange-500/10 text-orange-600" :
                                                                    "bg-primary/10 text-primary"
                                                    )}>
                                                        <div className={clsx(
                                                            "w-1.5 h-1.5 rounded-full",
                                                            p.status === 'SS' ? "bg-green-600" :
                                                                p.status === 'ES' ? "bg-red-600" :
                                                                    p.status === 'ST' ? "bg-orange-600" :
                                                                        "bg-primary"
                                                        )} />
                                                        {p.status === 'PE' ? 'Pendiente' :
                                                            p.status === 'SS' ? 'Exitoso' :
                                                                p.status === 'ST' ? 'Timeout' : 'Escalado'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex justify-center gap-0.5">
                                                        {[...Array(5)].map((_, i) => (
                                                            <div key={i} className={clsx(
                                                                "w-1.5 h-3 rounded-full",
                                                                i < p.priority ? "bg-primary" : "bg-muted"
                                                            )} />
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center text-[10px] font-bold text-muted-foreground">
                                                    {new Date(p.updated_at).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
