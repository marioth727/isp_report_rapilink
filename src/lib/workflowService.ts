import { supabase } from './supabase';
import { WisphubService } from './wisphub';
import type { WorkflowProcess, WorkflowLog, ParticipantType } from './types/workflow';

export const WorkflowService = {
    // --- PROCESOS ---
    async createProcess(data: {
        process_type: string;
        title: string;
        priority?: number;
        reference_id?: string;
        metadata?: any;
    }): Promise<WorkflowProcess | null> {
        const { data: process, error } = await supabase
            .from('workflow_processes')
            .insert([{
                process_type: data.process_type,
                title: data.title,
                priority: data.priority || 1,
                reference_id: data.reference_id,
                metadata: data.metadata || {},
                status: 'PE'
            }])
            .select()
            .single();

        if (error) {
            console.error('[WorkflowService] Error creando proceso:', error);
            return null;
        }

        await this.logEvent(process.id, 'Creation', `Proceso iniciado: ${data.title}`);
        return process;
    },

    async getProcessById(id: string): Promise<WorkflowProcess | null> {
        const { data, error } = await supabase
            .from('workflow_processes')
            .select('*')
            .eq('id', id)
            .single();
        return error ? null : data;
    },

    // --- ACTIVIDADES Y WORKITEMS ---
    async createStep(processId: string, name: string, participantId: string, type: ParticipantType, durationMinutes: number = 60) {
        // 1. Crear Actividad
        const { data: activity, error: actErr } = await supabase
            .from('workflow_activities')
            .insert([{ process_id: processId, name, status: 'Active' }])
            .select()
            .single();

        if (actErr) return null;

        // 2. Crear WorkItem con Deadline
        const deadline = new Date();
        deadline.setMinutes(deadline.getMinutes() + durationMinutes);

        const { data: workItem, error: wiErr } = await supabase
            .from('workflow_workitems')
            .insert([{
                activity_id: activity.id,
                participant_id: participantId,
                participant_type: type,
                deadline: deadline.toISOString(),
                status: 'Pending'
            }])
            .select()
            .single();

        return wiErr ? null : { activity, workItem };
    },

    async completeWorkItem(workItemId: string, actorId: string, note?: string) {
        const now = new Date().toISOString();

        // 1. Marcar WorkItem como completado
        const { data: wi, error: wiErr } = await supabase
            .from('workflow_workitems')
            .update({ status: 'Completed', completed_at: now })
            .eq('id', workItemId)
            .select()
            .single();

        if (wiErr) return false;

        // 2. Marcar Actividad como completada
        await supabase
            .from('workflow_activities')
            .update({ status: 'Completed', completed_at: now })
            .eq('id', wi.activity_id);

        // 3. Log
        const { data: activity } = await supabase.from('workflow_activities').select('process_id').eq('id', wi.activity_id).single();
        if (activity) {
            await this.logEvent(activity.process_id, 'Approval', note || `Tarea completada por ${actorId}`);
        }

        return true;
    },

    async reassignWorkItem(workItemId: string, newParticipantId: string, actorId: string) {
        const { data, error } = await supabase
            .from('workflow_workitems')
            .update({ participant_id: newParticipantId })
            .eq('id', workItemId)
            .select('activity_id')
            .single();

        if (error) return false;

        const { data: activity } = await supabase
            .from('workflow_activities')
            .select('process_id')
            .eq('id', data.activity_id)
            .single();

        if (activity) {
            await this.logEvent(activity.process_id, 'Reassignment', `Reasignado a: ${newParticipantId}`, actorId);
        }
        return true;
    },

    async getPlatformUsers() {
        // 1. Obtener perfiles reales con ID de WispHub
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, email, role, wisphub_id');

        // 2. Obtener IDs técnicos de interacciones (Ghost Users)
        const { data: interactions } = await supabase.from('crm_interactions').select('user_id');
        const uniqueIds = Array.from(new Set((interactions || []).map(i => i.user_id)));

        const finalUsers = (profiles || []).map(p => ({
            id: p.id,
            display_name: p.full_name || p.email || `ID: ${p.id.substring(0, 8)}`,
            email: p.email,
            wisphub_id: p.wisphub_id,
            is_profile: true
        }));

        const profileIds = new Set(finalUsers.map(u => u.id));

        for (const id of uniqueIds) {
            if (!profileIds.has(id)) {
                finalUsers.push({
                    id,
                    display_name: `Técnico: ${id.substring(0, 8)}`,
                    email: null,
                    wisphub_id: id,
                    is_profile: false
                });
            }
        }

        return finalUsers;
    },

    async updateTicketStatus(ticketId: string, statusId: number, comment?: string) {
        try {
            const body: any = { estado: statusId.toString() };
            // Cambiado safeFetch por WisphubService methods o fetch directo si es necesario
            // Pero como estamos dentro de WorkflowService, debemos usar WisphubService
            const response = await fetch(`/api/wisphub/tickets/${ticketId}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (comment) {
                await WisphubService.addTicketComment(ticketId, comment);
            }

            return response.ok;
        } catch (e) {
            console.error('[WispHub] Error updating status:', e);
            return false;
        }
    },

    async completeAndSyncWorkItem(workItemId: string, resolution: string) {
        try {
            // 1. Obtener detalles del item para saber el ticket_id
            const { data: item } = await supabase
                .from('workflow_workitems')
                .select('*, workflow_activities(workflow_processes(reference_id))')
                .eq('id', workItemId)
                .single();

            if (!item) return false;

            const ticketId = item.workflow_activities?.workflow_processes?.reference_id;

            // 2. Marcar TODOS los workitems de esta actividad como completados
            const { error: localError } = await supabase
                .from('workflow_workitems')
                .update({ status: 'SS', completed_at: new Date().toISOString() })
                .eq('activity_id', item.activity_id);

            if (localError) throw localError;

            // 3. Sincronizar con WispHub si hay ticket_id
            if (ticketId) {
                // Estado 3 = Cerrado en WispHub (según mapeo previo)
                await this.updateTicketStatus(ticketId, 3, `SOLUCIÓN CRM: ${resolution}`);
            }

            return true;
        } catch (e) {
            console.error('Error in completeAndSync:', e);
            return false;
        }
    },

    async escalateWorkItem(workItemId: string, reason: string) {
        try {
            // 1. Obtener item y proceso actual
            const { data: item } = await supabase
                .from('workflow_workitems')
                .select('*, workflow_activities(*, workflow_processes(*))')
                .eq('id', workItemId)
                .single();

            if (!item) return false;

            const currentLevel = item.workflow_activities?.workflow_processes?.metadata?.current_level || 1;
            const nextLevel = currentLevel + 1;
            const processId = item.workflow_activities?.workflow_processes?.id;
            const ticketId = item.workflow_activities?.workflow_processes?.reference_id;

            if (nextLevel > 4) {
                alert('No hay más niveles de escalamiento operativos configurados.');
                return false;
            }

            // 2. Marcar actual como completado (Escalado)
            await supabase
                .from('workflow_workitems')
                .update({ status: 'SS', completed_at: new Date().toISOString() })
                .eq('id', workItemId);

            // 3. Actualizar nivel en proceso
            await supabase
                .from('workflow_processes')
                .update({
                    metadata: {
                        ...item.workflow_activities.workflow_processes.metadata,
                        current_level: nextLevel
                    }
                })
                .eq('id', processId);

            // 4. Crear nueva actividad
            const { data: nextActivity } = await supabase
                .from('workflow_activities')
                .insert({
                    process_id: processId,
                    name: `ESCALAMIENTO NIVEL ${nextLevel}`,
                    type: 'HS',
                    status: 'PE'
                })
                .select()
                .single();

            if (nextActivity) {
                // 5. ENRUTAMIENTO INTELIGENTE: Buscar técnicos del siguiente nivel
                const { data: nextLevelUsers } = await supabase
                    .from('profiles')
                    .select('id, email, wisphub_id')
                    .eq('operational_level', nextLevel);

                if (nextLevelUsers && nextLevelUsers.length > 0) {
                    // Crear un WorkItem para cada usuario de ese nivel
                    const workItems = nextLevelUsers.map(u => ({
                        activity_id: nextActivity.id,
                        participant_id: u.wisphub_id || u.email || u.id,
                        status: 'PE'
                    }));
                    await supabase.from('workflow_workitems').insert(workItems);
                } else {
                    // Fallback a placeholder si no hay usuarios definidos
                    await supabase.from('workflow_workitems').insert({
                        activity_id: nextActivity.id,
                        participant_id: `SOPORTE NIVEL ${nextLevel}`,
                        status: 'PE'
                    });
                }
            }

            // 6. Comentar en WispHub
            if (ticketId) {
                await WisphubService.addTicketComment(ticketId, `ESCALADO A NIVEL ${nextLevel}. MOTIVO: ${reason}`);
            }

            return true;
        } catch (e) {
            console.error('Error in escalateWorkItem:', e);
            return false;
        }
    },
    async logEvent(processId: string, type: string, description: string, actorId?: string) {
        await supabase
            .from('workflow_logs')
            .insert([{
                process_id: processId,
                event_type: type,
                description,
                actor_id: actorId
            }]);
    },

    async getFullLogs(processId: string): Promise<WorkflowLog[]> {
        const { data, error } = await supabase
            .from('workflow_logs')
            .select('*')
            .eq('process_id', processId)
            .order('created_at', { ascending: true });
        return error ? [] : data;
    },

    // --- ESCALAMIENTO AXCES ---
    async checkTimeouts() {
        const now = new Date().toISOString();

        // 1. Cierre Automático: Resuelto -> Cerrado tras 24h
        const { data: resolvedProcesses } = await supabase
            .from('workflow_processes')
            .select('id, updated_at')
            .eq('status', 'SS');

        if (resolvedProcesses) {
            for (const p of resolvedProcesses) {
                const diff = (new Date().getTime() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60);
                if (diff >= 24) {
                    await supabase.from('workflow_processes').update({ status: 'Cerrado' }).eq('id', p.id);
                    await this.logEvent(p.id, 'Auto-Close', 'Caso cerrado automáticamente tras 24h sin respuesta.');
                }
            }
        }

        // 2. Escalamiento por SLA
        const { data: expiredItems, error } = await supabase
            .from('workflow_workitems')
            .select('*, workflow_activities(process_id, name)')
            .eq('status', 'Pending')
            .lt('deadline', now);

        if (error || !expiredItems) return;

        const AXCES_LEVELS: Record<string, { label: string, contact: string, type: ParticipantType }> = {
            'N1': { label: 'Soporte Técnico', contact: 'SOPORTE NIVEL 1', type: 'U' },
            'N2': { label: 'Supervisor de Operaciones', contact: 'SOPORTE NIVEL 2', type: 'SU' },
            'N3': { label: 'Jefe de Operaciones', contact: 'SOPORTE NIVEL 3', type: 'DA' },
            'N4': { label: 'Gerencia', contact: 'GERENCIA', type: 'DA' }
        };

        for (const item of expiredItems) {
            const processId = item.workflow_activities?.process_id;
            if (!processId) continue;

            const { data: proc } = await supabase.from('workflow_processes')
                .select('metadata')
                .eq('id', processId)
                .single();

            const currentLevel = proc?.metadata?.current_level || 1;
            const nextLevel = Math.min(currentLevel + 1, 4);
            const levelKey = `N${nextLevel}`;
            const levelInfo = AXCES_LEVELS[levelKey];

            if (!levelInfo) continue;

            await supabase.from('workflow_workitems').update({ status: 'Expired' }).eq('id', item.id);
            await supabase.from('workflow_processes').update({
                status: 'ES',
                updated_at: now,
                metadata: { ...proc?.metadata, current_level: nextLevel }
            }).eq('id', processId);

            await this.logEvent(processId, 'Escalation', `SLA Excedido. Escalado a Nivel ${nextLevel}: ${levelInfo.contact}`);

            await this.createStep(
                processId,
                `Escalamiento N${nextLevel}: ${levelInfo.label}`,
                levelInfo.contact,
                levelInfo.type,
                120 // 2h para pasos de escalamiento
            );
        }
    },

    // --- SINCRONIZACIÓN AXCES ---
    async syncWithWispHub() {
        try {
            const tickets = await WisphubService.getAllRecentTickets(100);
            const profiles = await this.getPlatformUsers();

            for (const ticket of tickets) {
                if (ticket.id_estado !== 1 && ticket.id_estado !== 2) continue;

                const { data: existing } = await supabase
                    .from('workflow_processes')
                    .select('id')
                    .eq('reference_id', ticket.id.toString())
                    .maybeSingle();

                if (existing) continue;

                // Mapear SLA AXCES por Prioridad
                const priority = ticket.id_prioridad || 2;
                let slaMinutes = 480;

                if (priority >= 5) slaMinutes = 120; // Crítico (2h)
                else if (priority === 4) slaMinutes = 240; // Significativo (4h)
                else if (priority === 3) slaMinutes = 480; // Algún Impacto (8h)
                else if (priority === 2) slaMinutes = 4320; // Mínimo (3 días)
                else if (priority === 1) slaMinutes = 7200; // Programado (5 días)

                const process = await this.createProcess({
                    process_type: 'Ticket AXCES',
                    title: `${ticket.asunto} - ${ticket.nombre_cliente}`,
                    reference_id: ticket.id.toString(),
                    priority,
                    metadata: {
                        service_id: ticket.servicio,
                        current_level: 1,
                        client_nit: ticket.cedula,
                        client_name: ticket.nombre_cliente,
                        ticket_subject: ticket.asunto,
                        category: 'Facturación Electrónica'
                    }
                });

                if (process) {
                    // Mapeo de técnico a usuario de plataforma
                    const assignedName = ticket.nombre_tecnico || 'Esteban Vázquez';
                    const matchedUser = profiles.find(p =>
                        (p.wisphub_id && p.wisphub_id.toLowerCase() === assignedName.toLowerCase()) ||
                        p.display_name?.toLowerCase() === assignedName.toLowerCase() ||
                        p.email?.toLowerCase() === assignedName.toLowerCase() ||
                        p.id?.toLowerCase() === assignedName.toLowerCase()
                    );

                    await this.createStep(
                        process.id,
                        'Atención Nivel 1: Soporte Técnico',
                        matchedUser ? (matchedUser.email || matchedUser.id) : assignedName,
                        'U',
                        slaMinutes
                    );
                }
            }
            return true;
        } catch (error) {
            console.error('[WorkflowService] Sync Error:', error);
            return false;
        }
    }
};
