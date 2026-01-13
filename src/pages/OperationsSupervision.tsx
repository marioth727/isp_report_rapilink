import { useState, useEffect } from 'react';
import { ShieldAlert, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WorkflowService } from '../lib/workflowService';
import { OperationsHeader } from '../components/operations/OperationsHeader';
import type { WorkflowProcess } from '../lib/types/workflow';
import clsx from 'clsx';

export function OperationsSupervision() {
    const [loading, setLoading] = useState(false);
    const [allProcesses, setAllProcesses] = useState<WorkflowProcess[]>([]);
    const [platformUsers, setPlatformUsers] = useState<any[]>([]);

    useEffect(() => {
        WorkflowService.getPlatformUsers().then(setPlatformUsers);
        loadSupervision();
    }, []);

    const loadSupervision = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('workflow_processes')
                .select(`
                    *,
                    workflow_activities(
                        name,
                        workflow_workitems(id, participant_id, status)
                    )
                `)
                .order('created_at', { ascending: false });

            if (!error) setAllProcesses(data || []);
        } finally {
            setLoading(false);
        }
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
            <OperationsHeader
                title="Supervisión"
                description="Consola de administración y seguimiento de procesos operativos."
                onSyncComplete={loadSupervision}
            />

            <div className="bg-card border border-border rounded-3xl overflow-hidden animate-in fade-in duration-500">
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
                                                (p.metadata?.current_level || 1) === 1 ? "bg-blue-500/10 text-blue-500" :
                                                    (p.metadata?.current_level || 1) === 2 ? "bg-orange-500/10 text-orange-500" :
                                                        (p.metadata?.current_level || 1) === 3 ? "bg-purple-500/10 text-purple-500" :
                                                            "bg-red-500/10 text-red-500"
                                            )}>
                                                NIVEL {p.metadata?.current_level || 1}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground font-bold mt-1 text-center">
                                                {(p.metadata?.current_level || 1) === 1 ? 'SOPORTE TÉCNICO' :
                                                    (p.metadata?.current_level || 1) === 2 ? 'SUPERVISOR' :
                                                        (p.metadata?.current_level || 1) === 3 ? 'JEFE DE OP.' : 'GERENCIA'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center">
                                            {(() => {
                                                const workItem = (p as any).workflow_activities?.[0]?.workflow_workitems?.[0];
                                                const participantId = workItem?.participant_id || '';

                                                // Buscar el usuario en la lista para obtener su nombre real
                                                const matchedUser = platformUsers.find(u =>
                                                    u.id === participantId ||
                                                    u.email === participantId ||
                                                    u.display_name?.toLowerCase() === participantId.toLowerCase()
                                                );

                                                return (
                                                    <select
                                                        disabled={loading}
                                                        className="text-[10px] font-black bg-muted border border-border rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-primary w-full max-w-[140px] mb-1 truncate"
                                                        value={matchedUser ? matchedUser.id : participantId}
                                                        onChange={(e) => {
                                                            const wiId = workItem?.id;
                                                            if (wiId) handleReassign(wiId, e.target.value);
                                                        }}
                                                    >
                                                        <option value="">Sin Asignar</option>
                                                        {platformUsers.map(u => (
                                                            <option key={u.id} value={u.id}>
                                                                {u.display_name}
                                                            </option>
                                                        ))}
                                                        {participantId && !matchedUser && (
                                                            <option value={participantId}>{participantId}</option>
                                                        )}
                                                    </select>
                                                );
                                            })()}
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
    );
}
