import { useState, useEffect } from 'react';
import { ShieldAlert, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WorkflowService } from '../lib/workflowService';
import { OperationsHeader } from '../components/operations/OperationsHeader';
import type { WorkflowProcess } from '../lib/types/workflow';
import clsx from 'clsx';

export function OperationsSupervision() {
    const [allProcesses, setAllProcesses] = useState<WorkflowProcess[]>([]);
    const [platformUsers, setPlatformUsers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadSupervision();
    }, []);

    const loadSupervision = async () => {
        try {
            // Reload Users to ensure levels are fresh
            WorkflowService.getPlatformUsers().then(setPlatformUsers);

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
        } catch (err) {
            console.error(err);
        }
    };


    return (
        <div className="space-y-6">
            <OperationsHeader
                title="Supervisión"
                description="Consola de administración y seguimiento de procesos operativos."
                onSyncComplete={loadSupervision}
            />

            <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden animate-in fade-in duration-500 shadow-sm">
                <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold flex items-center gap-2 uppercase tracking-tight text-zinc-900">
                        <ShieldAlert className="text-zinc-900" size={20} /> Consola de Administración Operativa
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar ID o Cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white border border-zinc-200 rounded-xl py-2 pl-9 pr-4 text-xs font-medium outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-50 transition-all w-64 placeholder:text-zinc-300 text-zinc-700"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white border-b border-zinc-200">
                            <tr>
                                <th className="p-4 text-left text-[10px] uppercase font-bold tracking-widest text-zinc-400">ID / Cliente</th>
                                <th className="p-4 text-center text-[10px] uppercase font-bold tracking-widest text-zinc-400">Creación</th>
                                <th className="p-4 text-center text-[10px] uppercase font-bold tracking-widest text-zinc-400">Asunto / Categoría</th>
                                <th className="p-4 text-center text-[10px] uppercase font-bold tracking-widest text-zinc-400">Creado por</th>
                                <th className="p-4 text-center text-[10px] uppercase font-bold tracking-widest text-zinc-400">Nivel</th>
                                <th className="p-4 text-center text-[10px] uppercase font-bold tracking-widest text-zinc-400">Escalado</th>
                                <th className="p-4 text-center text-[10px] uppercase font-bold tracking-widest text-zinc-400">Responsable Actual</th>
                                <th className="p-4 text-center text-[10px] uppercase font-bold tracking-widest text-zinc-400">Estado</th>
                                <th className="p-4 text-center text-[10px] uppercase font-bold tracking-widest text-zinc-400">SLA</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {allProcesses.filter(p => {
                                if (!searchTerm) return true;
                                const id = p.reference_id || p.id.split('-')[0];
                                const cliente = (p.metadata?.nombre_cliente || p.title || '').toLowerCase();
                                return id.includes(searchTerm) || cliente.includes(searchTerm.toLowerCase());
                            }).map((p) => {
                                // Resolver Usuario Mapeado (Técnico Original / Asignado Inicialmente)
                                const workItem = (p as any).workflow_activities?.[0]?.workflow_workitems?.[0];
                                const participantId = workItem?.participant_id || '';
                                let matchedUser = platformUsers.find(u =>
                                    u.id === participantId ||
                                    u.email === participantId ||
                                    u.display_name?.toLowerCase() === participantId.toLowerCase() ||
                                    u.wisphub_id?.toLowerCase() === participantId.toLowerCase() ||
                                    (u as any).wisphub_user_id === participantId
                                );

                                if (!matchedUser) {
                                    const techId = p.metadata?.technician_id || p.metadata?.technician_name;
                                    if (techId) {
                                        matchedUser = platformUsers.find(u =>
                                            u.wisphub_id === techId ||
                                            u.wisphub_id === String(techId) ||
                                            u.display_name === techId ||
                                            u.display_name?.toLowerCase().includes(String(techId).toLowerCase())
                                        );
                                    }
                                }

                                // 3. Resolver Perfil del Creador (Para nivel base si es nuevo)
                                const creadoPorRaw = p.metadata?.creado_por || p.metadata?.nombre_tecnico || '';
                                let creadoPorNombre = creadoPorRaw.split(' - ')[0] || creadoPorRaw;
                                if (creadoPorNombre.includes('@')) {
                                    creadoPorNombre = creadoPorNombre.split('@')[0];
                                }
                                const creatorProfile = platformUsers.find(u =>
                                    creadoPorRaw.toLowerCase().includes(u.email?.toLowerCase() || '___') ||
                                    creadoPorRaw.toLowerCase().includes(u.wisphub_id?.toLowerCase() || '___') ||
                                    (u.full_name && creadoPorRaw.toLowerCase().includes(u.full_name.toLowerCase()))
                                );

                                // Lógica de Responsable Actual (Última actividad activa)
                                const currentWorkItems = ((p as any).workflow_activities || [])
                                    .filter((a: any) => a.status === 'Active')
                                    .flatMap((a: any) => a.workflow_workitems)
                                    .filter((wi: any) => wi.status === 'Active' || wi.status === 'PE') || [];

                                const currentResponsibleName = currentWorkItems.map((wi: any) => {
                                    const u = platformUsers.find(user =>
                                        user.id === wi.participant_id ||
                                        user.email === wi.participant_id ||
                                        user.wisphub_id === wi.participant_id ||
                                        (user.full_name && user.full_name === wi.participant_id)
                                    );
                                    return u ? u.display_name : wi.participant_id;
                                }).join(', ');

                                // Lógica de Escalado (Usuario Reasignado o SLA Vencido)
                                const originalTechId = p.metadata?.technician_id || p.metadata?.technician_name;
                                const activeActivity = ((p as any).workflow_activities || []).find((a: any) => a.status === 'Active');
                                const activeWorkItem = activeActivity?.workflow_workitems?.find((wi: any) => wi.status === 'Active' || wi.status === 'PE');
                                const currentResponsibleId = activeWorkItem?.participant_id;

                                // SI el responsable actual es distinto al técnico original de WispHub -> ESCALADO MANUAL
                                const isReassigned = currentResponsibleId && originalTechId &&
                                    String(currentResponsibleId) !== String(originalTechId);

                                // SI el SLA está en amarillo o rojo -> ESCALADO POR TIEMPO
                                const isSlaBreached = p.metadata?.sla_status === 'critico' || p.metadata?.sla_status === 'amarillo' || (p.metadata?.hours_open || 0) > 24;

                                const isEscalated = isReassigned || isSlaBreached || (p.escalation_level || 0) >= 2;

                                return (
                                    <tr key={p.id} className="hover:bg-zinc-50 transition-colors group cursor-pointer border-b border-zinc-100 last:border-0">
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold uppercase text-zinc-900 leading-tight">
                                                    {p.metadata?.nombre_cliente || (p.title.includes(' - ') ? p.title.split(' - ')[1] : p.title)}
                                                </span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold text-zinc-500 font-mono bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                                                        ID: {p.reference_id || p.id.split('-')[0]}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* COLUMNA: FECHA CREACIÓN */}
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-bold text-zinc-500 font-mono">
                                                    {new Date(p.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                                </span>
                                                <span className="text-[8px] text-zinc-400 font-mono">
                                                    {new Date(p.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="p-4 text-center">
                                            <div className="max-w-[150px] mx-auto text-[9px] font-bold uppercase text-zinc-600 bg-zinc-50 px-2 py-1.5 rounded-lg border border-zinc-200 truncate" title={p.metadata?.asunto || p.title.split(' - ')[0]}>
                                                {p.metadata?.asunto || p.title.split(' - ')[0] || p.process_type}
                                            </div>
                                        </td>

                                        {/* COLUMNA: CREADO POR */}
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-bold text-zinc-700 uppercase truncate max-w-[120px]" title={creadoPorRaw}>
                                                    {creatorProfile?.display_name || creatorProfile?.full_name || creadoPorNombre || 'Desconocido'}
                                                </span>
                                                <span className="text-[8px] font-bold text-zinc-400 font-mono">ORIGEN: {p.metadata?.origen_reporte || 'WispHub'}</span>
                                            </div>
                                        </td>

                                        {/* COLUMNA: NIVEL TÉCNICO (DINÁMICO) */}
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center">
                                                {/* mostramos current_level o nivel del creador si no hay current_level */}
                                                <span className={clsx(
                                                    "text-[9px] font-bold px-2 py-1 rounded-md uppercase border tracking-wide",
                                                    (p.metadata?.current_level ?? creatorProfile?.operational_level ?? matchedUser?.operational_level ?? 1) === 0 ? "bg-blue-50 text-blue-700 border-blue-100" :
                                                        (p.metadata?.current_level ?? creatorProfile?.operational_level ?? matchedUser?.operational_level ?? 1) === 1 ? "bg-cyan-50 text-cyan-700 border-cyan-100" :
                                                            (p.metadata?.current_level ?? creatorProfile?.operational_level ?? matchedUser?.operational_level ?? 1) === 2 ? "bg-orange-50 text-orange-700 border-orange-100" :
                                                                (p.metadata?.current_level ?? creatorProfile?.operational_level ?? matchedUser?.operational_level ?? 1) === 3 ? "bg-purple-50 text-purple-700 border-purple-100" :
                                                                    "bg-red-50 text-red-700 border-red-100"
                                                )}>
                                                    NIVEL {p.metadata?.current_level ?? creatorProfile?.operational_level ?? matchedUser?.operational_level ?? 1}
                                                </span>
                                            </div>
                                        </td>

                                        {/* COLUMNA: ESCALADO (DINÁMICO CRM) */}
                                        <td className="p-4 text-center">
                                            {(p.metadata?.current_level || 0) > 1 || isEscalated ? (
                                                <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100">
                                                    SI
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-zinc-300 px-2 py-1">
                                                    NO
                                                </span>
                                            )}
                                        </td>

                                        {/* COLUMNA: RESPONSABLE ACTUAL */}
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-bold text-zinc-600 uppercase truncate max-w-[120px] bg-zinc-50 px-2 py-1 rounded border border-zinc-200">
                                                    {currentResponsibleName || p.metadata?.nombre_tecnico || 'POR ASIGNAR'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* COLUMNA: ESTADO REAL WISPHUB */}
                                        <td className="p-4 text-center">
                                            <span className={clsx(
                                                "px-3 py-1 rounded-full text-[9px] font-bold uppercase inline-flex items-center gap-1.5 border tracking-wide",
                                                p.metadata?.nombre_estado === 'Cerrado' || p.status === 'SS' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                                    p.metadata?.nombre_estado === 'Resuelto' ? "bg-cyan-50 text-cyan-700 border-cyan-100" :
                                                        p.metadata?.nombre_estado === 'En Progreso' ? "bg-blue-50 text-blue-700 border-blue-100" :
                                                            "bg-zinc-50 text-zinc-500 border-zinc-100"
                                            )}>
                                                <div className={clsx(
                                                    "w-1.5 h-1.5 rounded-full",
                                                    p.metadata?.nombre_estado === 'Cerrado' || p.status === 'SS' ? "bg-emerald-500" :
                                                        p.metadata?.nombre_estado === 'Resuelto' ? "bg-cyan-500" :
                                                            p.metadata?.nombre_estado === 'En Progreso' ? "bg-blue-500" :
                                                                "bg-zinc-400"
                                                )} />
                                                {p.metadata?.nombre_estado || 'Abierto'}
                                            </span>
                                        </td>

                                        {/* COLUMNA: SLA (TIME CIRCLES) */}
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="flex justify-center gap-0.5">
                                                    {[...Array(5)].map((_, i) => (
                                                        <div key={i} className={clsx(
                                                            "w-1.5 h-1.5 rounded-full",
                                                            // Lógica de SLA visual (5 círculos = Crítico)
                                                            (p.metadata?.horas_abierto || 0) > (48 * (i + 1) / 5) ? "bg-red-400" :
                                                                (p.metadata?.horas_abierto || 0) > (24 * (i + 1) / 5) ? "bg-orange-300" :
                                                                    "bg-emerald-200"
                                                        )} />
                                                    ))}
                                                </div>
                                                <span className="text-[8px] font-bold text-zinc-400 font-mono">
                                                    {p.metadata?.horas_abierto || 0}H
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div >
    );
}
