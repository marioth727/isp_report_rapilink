import { supabase } from './supabase';
import { WisphubService, stripHtml } from './wisphub';
import type { WorkflowProcess, WorkflowLog, ParticipantType, PlatformUser } from './types/workflow';

/**
 * Normaliza un texto para comparaciones (minúsculas, sin espacios extras)
 */
const normalize = (text: string | null | undefined): string => {
    if (!text) return '';
    return text.toString().toLowerCase().trim()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Quitar acentos opcionalmente
};

// Helper to check for valid UUIDs
const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);


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
            .select('activity_id, workflow_activities(process_id, workflow_processes(reference_id))')
            .single();

        if (error) {
            console.error('[INTERNAL] Error en reassignWorkItem:', error);
            return false;
        }

        const processId = (data.workflow_activities as any)?.process_id;
        const ticketId = (data.workflow_activities as any)?.workflow_processes?.reference_id;

        if (processId) {
            await this.logEvent(processId, 'Reassignment', `Reasignado a: ${newParticipantId}`, actorId);
        }

        // SINCRONIZACIÓN WispHub
        if (ticketId && isUUID(newParticipantId)) {
            console.log(`[WispHub] Sincronizando reasignación manual para ticket ${ticketId}`);
            await this.changeWispHubTechnician(ticketId, newParticipantId);
        }

        return true;
    },

    async getPlatformUsers(): Promise<PlatformUser[]> {
        try {
            console.log('[getPlatformUsers] 🔍 Iniciando carga de perfiles...');

            // 1. Obtener perfiles reales con ID de WispHub
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, wisphub_id, operational_level, is_field_tech');

            if (profilesError) {
                console.error('[getPlatformUsers] ❌ Error obteniendo profiles:', profilesError);
                // Si hay error, intentar retornar al menos un array vacío
                return [];
            }

            if (!profiles || profiles.length === 0) {
                console.warn('[getPlatformUsers] ⚠️ No se encontraron perfiles en la base de datos');
                return [];
            }

            console.log(`[getPlatformUsers] ✅ ${profiles.length} perfiles cargados`);

            // 2. Obtener IDs técnicos de interacciones (Ghost Users)
            const { data: interactions } = await supabase.from('crm_interactions').select('user_id');
            const uniqueIds = Array.from(new Set((interactions || []).map(i => i.user_id)));

            const finalUsers = (profiles || []).map(p => ({
                id: p.id,
                full_name: p.full_name, // Mantener para el select
                display_name: p.full_name || p.email || `ID: ${p.id.substring(0, 8)}`,
                email: p.email,
                role: p.role,
                wisphub_id: p.wisphub_id,
                operational_level: p.operational_level, // CRÍTICO para el filtro de escalado
                is_field_tech: p.is_field_tech,
                is_profile: true
            }));

            const profileIds = new Set(finalUsers.map(u => u.id));

            for (const id of uniqueIds) {
                if (!profileIds.has(id)) {
                    finalUsers.push({
                        id,
                        full_name: `Técnico: ${id.substring(0, 8)}`,
                        display_name: `Técnico: ${id.substring(0, 8)}`,
                        email: null,
                        role: 'agente',
                        wisphub_id: id,
                        operational_level: null,
                        is_field_tech: false,
                        is_profile: false
                    });
                }
            }

            console.log(`[getPlatformUsers] 🎯 Total usuarios finales: ${finalUsers.length}`);
            console.log('[getPlatformUsers] 📊 Distribución por nivel:',
                finalUsers.reduce((acc, u) => {
                    const level = u.operational_level ?? 'null';
                    acc[level] = (acc[level] || 0) + 1;
                    return acc;
                }, {} as Record<string | number, number>)
            );

            return finalUsers;
        } catch (error) {
            console.error('[getPlatformUsers] 💥 Error crítico:', error);
            console.error('[getPlatformUsers] Stack:', error instanceof Error ? error.stack : 'No stack');
            // En caso de error crítico, retornar array vacío en lugar de fallar
            return [];
        }
    },

    async updateTicketStatus(ticketId: string, statusId: number, comment?: string, options: { file?: File | Blob } = {}) {
        try {
            // 1. Obtener Datos Actuales para PUT limpio
            const rawTicket = await WisphubService.getTicketRaw(ticketId);
            if (!rawTicket) return false;

            // 2. Mapeo de IDs (PUT Estricto sin tocar descripción)
            const priorityMap: Record<string, number> = { "Baja": 1, "Normal": 2, "Media": 2, "Alta": 3, "Muy Alta": 4 };
            const validSubjects = (WisphubService as any).TICKET_SUBJECTS || [];
            const currentAsunto = rawTicket.asunto || "Otro Asunto";
            const isAsuntoValid = validSubjects.some((s: string) => s.toLowerCase() === currentAsunto.toLowerCase());
            const safeAsunto = isAsuntoValid ? currentAsunto : (validSubjects[0] || "Otro Asunto");

            // 3. Resolver ID Numérico del Técnico Actual (requerido por WispHub)
            let finalTechId = rawTicket.tecnico_id;
            if (!finalTechId || isNaN(Number(finalTechId))) {
                try {
                    const staff = await WisphubService.getStaff();
                    const techName = rawTicket.tecnico || rawTicket.nombre_tecnico || '';
                    const foundInStaff = staff.find(s =>
                        normalize(s.nombre) === normalize(techName) ||
                        normalize(s.usuario) === normalize(techName) ||
                        s.email === techName
                    );
                    if (foundInStaff) {
                        finalTechId = foundInStaff.id;
                        console.log(`[updateTicketStatus] ✅ Técnico resuelto: "${techName}" -> ID: ${finalTechId}`);
                    } else {
                        console.warn(`[updateTicketStatus] ⚠️ No se encontró ID para técnico: "${techName}", usando ID por defecto`);
                        // Usar primer técnico disponible como fallback
                        finalTechId = staff[0]?.id || 1;
                    }
                } catch (e) {
                    console.error('[updateTicketStatus] Error resolviendo técnico, usando fallback:', e);
                    finalTechId = 1; // ID por defecto
                }
            }

            const payload = {
                servicio: rawTicket.servicio?.id_servicio || rawTicket.servicio?.id || rawTicket.servicio,
                asunto: currentAsunto,
                asuntos_default: safeAsunto,
                descripcion: rawTicket.descripcion || ".",
                prioridad: priorityMap[rawTicket.prioridad] || 2,
                estado: statusId,
                tecnico: Number(finalTechId),
                departamento: rawTicket.departamento || "Soporte Técnico",
                departamentos_default: rawTicket.departamento || "Soporte Técnico"
            };

            // 4. Registrar Trazabilidad en la Descripción (WispHub no tiene endpoint de comentarios)
            if (comment) {
                const { data: { user } } = await supabase.auth.getUser();
                let actorName = 'Sistema';
                if (user) {
                    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
                    actorName = profile?.full_name || user.email || 'Sistema';
                }

                const timestamp = new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }).replace(',', '');
                const statusLabel = statusId === 3 ? "FINALIZADO" : "ACTUALIZADO";

                const fancyComment = `==== TICKET ${statusLabel} | ${actorName.toUpperCase()} | Fecha: ${timestamp} | REPORTE: ${comment} ====`;

                // Actualizar con nueva descripcion que incluye el bloque de trazabilidad
                const cleanBase = stripHtml(rawTicket.descripcion || "");
                const newDescription = `${cleanBase}\n\n${fancyComment}`.trim();

                const payloadWithComment = {
                    ...payload,
                    descripcion: newDescription,
                    archivo_ticket: options.file
                };

                return await WisphubService.updateTicket(ticketId, payloadWithComment, 'PUT');
            }

            // Si no hay comentario, solo actualizar el estado sin modificar descripción
            return await WisphubService.updateTicket(ticketId, payload, 'PUT');
        } catch (e) {
            console.error('[WispHub] Error in updateTicketStatus via Comments:', e);
            return false;
        }
    },

    async completeAndSyncWorkItem(workItemId: string, resolution: string, options: { file?: File | Blob } = {}) {
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
                .update({ status: 'SS' })
                .eq('activity_id', item.activity_id);

            if (localError) throw localError;

            // 3. Sincronizar con WispHub si hay ticket_id
            if (ticketId) {
                // Estado 3 = Cerrado/Resuelto en WispHub
                await this.updateTicketStatus(ticketId, 3, resolution, options);
            }

            return true;
        } catch (e) {
            console.error('Error in completeAndSync:', e);
            return false;
        }
    },

    async escalateWorkItem(workItemId: string, reason: string, targetTechnicianId?: string, options: { priority?: number, file?: File | Blob } = {}) {
        try {
            // 1. Obtener item y proceso actual
            const { data: item } = await supabase
                .from('workflow_workitems')
                .select('*, workflow_activities(*, workflow_processes(*))')
                .eq('id', workItemId)
                .single();

            if (!item) return false;

            const currentLevel = item.workflow_activities?.workflow_processes?.metadata?.current_level ?? 1;

            // LÓGICA DE SALTO: 0 o 1 saltan a 2 (Supervisor). El resto sube de 1 en 1.
            let nextLevel = currentLevel + 1;
            if (currentLevel === 0) nextLevel = 2;
            else if (currentLevel === 1) nextLevel = 2;

            const processId = item.workflow_activities?.workflow_processes?.id;
            const ticketId = item.workflow_activities?.workflow_processes?.reference_id;

            if (nextLevel > 4 || currentLevel >= 4) {
                alert('No hay más niveles de escalamiento operativos configurados (Nivel Máximo: 4).');
                return false;
            }

            // 2. Marcar actual como completado (Escalado)
            await supabase
                .from('workflow_workitems')
                .update({
                    status: 'SS'
                    // Se omitió completed_at porque no existe en el esquema
                })
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

            // 4. Crear o recuperar la actividad
            let nextActivity;
            const { data: existingActivity } = await supabase
                .from('workflow_activities')
                .select('*')
                .eq('process_id', processId)
                .eq('name', `ESCALAMIENTO NIVEL ${nextLevel}`)
                .single();

            if (existingActivity) {
                nextActivity = existingActivity;
            } else {
                const { data: newActivity, error: activityError } = await supabase
                    .from('workflow_activities')
                    .insert({
                        process_id: processId,
                        name: `ESCALAMIENTO NIVEL ${nextLevel}`,
                        activity_type: 'HS',
                        status: 'Active'
                    })
                    .select()
                    .single();

                if (activityError && activityError.code !== '23505') throw activityError;
                nextActivity = newActivity;
            }

            if (nextActivity) {
                // 5. RESOLVER IDENTIDADES (Local UUID vs WispHub Mapping)
                let targetUuid: string | undefined;
                let targetWhId: string | undefined;

                if (targetTechnicianId) {
                    console.log(`[ANALYSIS] Resolviendo técnico para ID: ${targetTechnicianId}`);

                    // Búsqueda inteligente: intentamos encontrar el perfil por UUID o por el Mapping directamente
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id, wisphub_id')
                        .or(`id.eq.${isUUID(targetTechnicianId) ? targetTechnicianId : '00000000-0000-0000-0000-000000000000'},wisphub_id.eq.${targetTechnicianId}`)
                        .maybeSingle();

                    if (profile) {
                        targetUuid = profile.id;
                        targetWhId = profile.wisphub_id;
                        console.log(`[INTERNAL] ID Usuario Local: ${targetUuid}`);
                        console.log(`[MAPPING] Valor EXACTO wisphub_id: ${targetWhId}`);
                    } else {
                        // Si no hay perfil, tratamos el input como ID directo según su formato
                        if (isUUID(targetTechnicianId)) {
                            targetUuid = targetTechnicianId;
                        } else {
                            targetWhId = targetTechnicianId;
                        }
                        console.log(`[INTERNAL] ID Usuario Local (Inferred): ${targetUuid || 'n/a'}`);
                        console.log(`[MAPPING] Valor EXACTO wisphub_id (Inferred): ${targetWhId || 'n/a'}`);
                    }
                }

                // ABORTAR si no hay mapeo válido para WispHub (Rule 2.2)
                if (ticketId && !targetWhId) {
                    console.error(`[MAPPING] 🛑 ERROR: No se encontró un mapeo de técnico válido para WispHub. Abortando proceso de red.`);
                }

                // A. Inserción Local (Supabase) - USAR SIEMPRE UUID para evitar Error 400
                const pType = nextLevel <= 1 ? 'U' : nextLevel === 2 ? 'SU' : 'SO';
                const deadline = new Date();
                deadline.setMinutes(deadline.getMinutes() + 120); // 2 horas de plazo
                const deadlineStr = deadline.toISOString();

                if (targetUuid) {
                    console.log(`[INTERNAL] Intentando asignar WorkItem local para UUID: ${targetUuid}, Tipo: ${pType}`);
                    const { error: insertError } = await supabase.from('workflow_workitems').upsert({
                        activity_id: nextActivity.id,
                        participant_id: targetUuid,
                        participant_type: pType,
                        deadline: deadlineStr,
                        status: 'PE'
                    }, {
                        onConflict: 'activity_id,participant_id'
                    });

                    if (insertError) {
                        console.error(`[INTERNAL] ❌ Error en UPSERT de WorkItem:`, insertError);
                    }
                } else {
                    // Enrutamiento automático si no hay técnico específico
                    const { data: nextLevelUsers } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('operational_level', nextLevel);

                    if (nextLevelUsers && nextLevelUsers.length > 0) {
                        const workItems = nextLevelUsers.map(u => ({
                            activity_id: nextActivity.id,
                            participant_id: u.id, // Siempre UUID
                            participant_type: pType,
                            deadline: deadlineStr,
                            status: 'PE'
                        }));
                        const { error: multiError } = await supabase.from('workflow_workitems').upsert(workItems, {
                            onConflict: 'activity_id,participant_id'
                        });
                        if (multiError) console.error(`[INTERNAL] ❌ Error en UPSERT múltiple:`, multiError);
                    } else {
                        const { error: fallbackError } = await supabase.from('workflow_workitems').upsert({
                            activity_id: nextActivity.id,
                            participant_id: `SOPORTE NIVEL ${nextLevel}`,
                            participant_type: pType,
                            deadline: deadlineStr,
                            status: 'PE'
                        }, {
                            onConflict: 'activity_id,participant_id'
                        });
                        if (fallbackError) console.error(`[INTERNAL] ❌ Error en UPSERT fallback:`, fallbackError);
                    }
                }

                // 6. Sincronizar con WispHub (Reasignación y descripción)
                if (ticketId) {
                    try {
                        // Obtener nombre del actor actual para la trazabilidad
                        const { data: { user } } = await supabase.auth.getUser();
                        let actorName = 'Sistema';
                        if (user) {
                            const { data: actorProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
                            actorName = actorProfile?.full_name || user.email || 'Sistema';
                        }

                        const timestamp = new Date().toLocaleString('es-CO', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                        }).replace(',', '');

                        // Bloque profesional para agregar a la descripción
                        const fancyComment = `==== ESCALAMIENTO A NIVEL ${nextLevel} | ${actorName.toUpperCase()} | Fecha: ${timestamp} | MOTIVO: ${reason} ====`;

                        // Delegar cambio de técnico con descripción actualizada
                        if (targetUuid) {
                            await this.changeWispHubTechnician(ticketId, targetUuid, {
                                priority: options.priority,
                                file: options.file,
                                description: fancyComment
                            });
                        }
                    } catch (whError) {
                        console.error('[RESPONSE] ❌ Error en sincronización WispHub:', whError);
                    }
                }
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

    // --- SINCRONIZACIÓN AXCES (STRICT MIRROR) ---
    async syncMyTickets(forceFull: boolean = false) {
        try {
            console.log(`[Sync] 🔄 START: Strict Mirror Sync (ForceFull=${forceFull})...`);

            // 1. Authenticate context
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No authenticated user.");

            console.log(`[Sync] 👤 Session User: ${user.email} (UID: ${user.id})`);

            // 1.1 Intentar resolver perfil por ID o por Email (Fallback)
            let { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

            if (!profile && user.email) {
                console.log(`[Sync] 🔍 Profile not found by UID. Trying by email: ${user.email}`);
                const { data: emailProfile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('email', user.email)
                    .maybeSingle();

                if (emailProfile) {
                    profile = emailProfile;
                    console.log(`[Sync] ✅ Profile recovered via email match: ${profile.id}`);
                }
            }

            // Validamos que exista perfil y al menos un campo de mapeo
            if (!profile || (!profile.wisphub_id && !profile.wisphub_mapping)) {
                console.error("[Sync] 🛑 No profile or mapping found for this session.");
                return false;
            }

            // [INTERNAL] ID del usuario local que usaremos para los WorkItems
            const effectiveParticipantId = profile.id;
            console.log(`[INTERNAL] Mapping to Profile ID: ${effectiveParticipantId} (${profile.full_name})`);

            // PRIORIDAD: Mapping Manual > ID Automático
            const targetUsername = profile.wisphub_mapping || profile.wisphub_id;

            // [MAPPING] Valor exacto que usará la API
            console.log(`[MAPPING] WispHub ID/Mapping: "${targetUsername}"`);

            if (!targetUsername) {
                console.error("[MAPPING] 🛑 ABORT: targetUsername is null/undefined. Cannot sync.");
                return false;
            }

            // 2. Resolve Tech Name via /api/staff/ 
            // (The "Indirect Mapping": Local Email -> Staff Object -> Real Name -> Ticket Match)
            let techNameStr = '';
            let staffMember: any = null;

            try {
                const staffRes = await WisphubService.getStaff();
                const staffList = staffRes || [];

                staffMember = staffList.find((s: any) =>
                    normalize(s.usuario) === normalize(targetUsername) ||
                    normalize(s.username) === normalize(targetUsername) ||
                    s.email === targetUsername
                );

                // Fallback de coincidencia parcial solo si e mapeo parece ser un email corto
                if (!staffMember && targetUsername.includes('@')) {
                    const shortName = targetUsername.split('@')[0];
                    staffMember = staffList.find((s: any) =>
                        (s.usuario && s.usuario.startsWith(shortName)) ||
                        (s.username && s.username.startsWith(shortName))
                    );
                }

                if (staffMember) {
                    techNameStr = staffMember.nombre;
                    // [MAPPING] Confirmación de resolución de staff
                    console.log(`[MAPPING] Resolved Staff: "${techNameStr}" (ID: ${staffMember.id})`);
                } else {
                    console.error(`[MAPPING] ❌ Could not find WispHub Staff for mapping: ${targetUsername}`);
                    return false;
                }

                // FAIL-SAFE SECURITY CHECK
                if (!techNameStr || techNameStr.trim() === '') {
                    console.error(`[MAPPING] 🛑 SECURITY ALERT: Resolved Name is EMPTY for ${targetUsername}. Aborting sync.`);
                    return false;
                }

            } catch (err) {
                console.error("[Sync] ❌ Error resolving staff:", err);
                return false;
            }

            // 3. Recursive Ticket Fetching & Local Filter (Deep 60 days vs Quick 10 days)
            const daysBack = forceFull ? 60 : 30;
            let allApiTickets: any[] = [];
            let page = 1;
            let hasMore = true;

            const now = new Date();
            const pastDate = new Date();
            pastDate.setDate(now.getDate() - daysBack);
            const startDateStr = pastDate.toISOString().split('T')[0];
            const endDateStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

            console.log(`[Sync] 📥 Fetching tickets from ${startDateStr} to ${endDateStr} (Depth: ${daysBack}d) FILTERED by Tech ID: ${staffMember.id} ("${techNameStr}")`);


            while (hasMore && page <= (forceFull ? 50 : 20)) {
                // [REQUEST] URL y Parámetros
                const fetchFilters = {
                    startDate: startDateStr,
                    endDate: endDateStr,
                    // tecnico: techIdForApi // REMOVIDO: WispHub omite tickets sin ID técnico en este filtro.
                };
                console.log(`[REQUEST] Page: ${page} | Filters:`, fetchFilters);

                const { results, count } = await WisphubService.getAllTicketsPage(page, fetchFilters);

                // [RESPONSE] Resultado de la API
                console.log(`[RESPONSE] Page: ${page} | Results: ${results?.length || 0} | Total Count: ${count}`);

                const ticketsPage = results || [];

                if (ticketsPage.length > 0) {
                    allApiTickets = [...allApiTickets, ...ticketsPage];

                    // Si ya tenemos todos los que reporta el count total, paramos.
                    if (allApiTickets.length >= count || ticketsPage.length < 50) {
                        hasMore = false;
                    }
                    page++;
                } else {
                    hasMore = false;
                }
                await new Promise(r => setTimeout(r, 100)); // Pequeña pausa de cortesía para el proxy
            }

            console.log(`[Sync] 📦 Total Active Tickets in API for this Tech: ${allApiTickets.length}`);
            if (allApiTickets.length === 0) {
                console.log("[Sync] ⚠️ No tickets found in API. User queue is empty.");
            }

            const myApiTicketIds: string[] = [];

            // 4. PROCESS: Throttled Upsert (Status 'PE')
            const allProfiles = await this.getPlatformUsers();

            for (const ticket of allApiTickets) {
                try {
                    // FILTRADO ESTRICTO POR NOMBRE (Sugerencia Usuario): 
                    // Comparamos el campo 'tecnico' del ticket con el nombre oficial resuelto (Mario Vasquez)
                    const incomingTechName = normalize(ticket.tecnico || ticket.nombre_tecnico || '');

                    const isStrictlyMine = incomingTechName === normalize(techNameStr);

                    if (isStrictlyMine) {
                        myApiTicketIds.push((ticket.id || ticket.id_ticket).toString());
                        await this.syncSingleTicketMirror(ticket, allProfiles, profile);
                        await new Promise(r => setTimeout(r, 50));
                    }
                } catch (e) {
                    console.error(`[Sync] ❌ Failed to upsert ticket ${ticket?.id}:`, e);
                }
            }

            // 5. SPLIT CLEANUP STRATEGY (Identity Purge vs History Check)

            // 5.1 Fetch Local 'PE' candidates
            const { data: localItems } = await supabase
                .from('workflow_workitems')
                .select(`
                    id,
                    activity_id,
                    workflow_activities!inner(
                        workflow_processes!inner(reference_id, metadata)
                    )
                `)
                .eq('participant_id', profile.id)
                .eq('status', 'PE');

            const itemsToPurge: string[] = [];
            const idsToPurgeLog: string[] = [];

            console.log(`[Sync] 🧹 Starting Cleanup Check on ${localItems?.length || 0} local items...`);

            for (const item of localItems || []) {
                const proc = (item.workflow_activities as any)?.workflow_processes;
                const refId = proc?.reference_id;

                if (!refId) continue;

                if (myApiTicketIds.includes(refId.toString())) {
                    continue;
                }

                // [STRICT PURGE] Barrido Total: Verificamos propiedad contra WispHub sin importar la fecha
                // Esto elimina "fantasmas" antiguos que cambiaron de dueño o estado fuera de la ventana de 10 días.
                try {
                    console.log(`[StrictPurge] 🔍 Verifying ticket #${refId} ownership...`);
                    const ticketDetail = await WisphubService.getTicketDetail(refId);

                    if (ticketDetail) {
                        // Comprobación estricta por nombre dinámico
                        const isStrictlyMine = normalize(ticketDetail.tecnico) === normalize(techNameStr);
                        const isClosed = ['Cerrado', 'Resuelto', 'Cancelado', 'Finalizado'].includes(ticketDetail.estado);

                        if (isStrictlyMine && !isClosed) {
                            console.log(`[StrictPurge] ✅ Ticket #${refId} is still mine and active. KEEPING.`);
                            continue;
                        } else {
                            console.log(`[StrictPurge] 🗑️ Ticket #${refId} ownership changed (${ticketDetail.tecnico}) or closed. PURGING.`);
                        }
                    } else {
                        console.log(`[StrictPurge] 🗑️ Ticket #${refId} NOT FOUND in WispHub. PURGING.`);
                    }
                } catch (err) {
                    console.error(`[StrictPurge] ❌ Error verifying ticket #${refId}:`, err);
                    continue;
                }

                itemsToPurge.push(item.id);
                console.log(`[PURGE] Ticket #${refId} marked as CO. Reason: Confirmed missing/closed.`);
                idsToPurgeLog.push(`${refId} (Stale/Closed/Reassigned)`);
            }

            if (itemsToPurge.length > 0) {
                console.log(`[Sync] 🗑️ PURGING ${itemsToPurge.length} items (Batch Processing)...`);
                const BATCH_SIZE = 50;
                for (let i = 0; i < itemsToPurge.length; i += BATCH_SIZE) {
                    const batch = itemsToPurge.slice(i, i + BATCH_SIZE);
                    await supabase.from('workflow_workitems').update({ status: 'CO' }).in('id', batch);
                }
            } else {
                console.log("[Sync] ✨ Cleanup: No items to purge.");
            }

            console.log("[Sync] ✅ Strict Mirror Sync COMPLETE.");
            return true;
        } catch (error) {
            console.error("[Sync] 🚨 Fatal Error in syncMyTickets:", error);
            return false;
        }
    },

    /**
     * Procesa un solo ticket usando UPSERT para sincronización espejo
     */
    async syncSingleTicketMirror(ticket: any, profiles: any[], syncOwnerProfile?: any): Promise<void> {
        try {
            const ticketIdStr = ticket.id.toString();
            const techName = ticket.tecnico || ticket.nombre_tecnico || 'Sin asignar';

            // PRIORIDAD 1: Si lo bajamos nosotros en un sync personal, es nuestro.
            let profile = syncOwnerProfile;

            // PRIORIDAD 2: Búsqueda Inteligente Multi-Criterio
            if (!profile) {
                profile = profiles.find(p => {
                    const localWhId = normalize(p.wisphub_id);
                    const incomingTech = normalize(techName);
                    const incomingTechId = ticket.tecnico_id ? String(ticket.tecnico_id) : null;
                    const incomingUser = ticket.tecnico_usuario ? normalize(ticket.tecnico_usuario) : null;

                    return (
                        // A. Coincidencia por ID Numérico (El más seguro)
                        (incomingTechId && localWhId === incomingTechId) ||
                        // B. Coincidencia Exacta de Usuario o Email
                        (localWhId === incomingUser) ||
                        (localWhId === incomingTech) ||
                        // C. El ID local está contenido en la cadena de WispHub (ej: "Nombre - usuario")
                        (localWhId !== "" && incomingTech.includes(localWhId)) ||
                        // D. Coincidencia por Nombre Completo
                        (normalize(p.full_name) !== "" && incomingTech.includes(normalize(p.full_name)))
                    );
                });
            }

            // 2. Cálculo de Status Robusto (Consistencia de Estados)
            let finalStatus: 'PE' | 'CO' = 'PE';
            const whStatusId = Number(ticket.id_estado);
            const whStatusName = (ticket.nombre_estado || ticket.estado || '').toLowerCase();

            if ([3, 4].includes(whStatusId) || whStatusName.includes('resuelto') || whStatusName.includes('cerrado')) {
                finalStatus = 'CO';
            } else {
                finalStatus = 'PE';
            }

            // 2.1 Consultar estado previo para Fusión de Metadatos (Integridad de Datos)
            const { data: existingProcess } = await supabase
                .from('workflow_processes')
                .select('metadata')
                .eq('reference_id', ticketIdStr)
                .maybeSingle();

            const mergedMetadata = { ...ticket };
            if (existingProcess?.metadata) {
                // Preservar datos críticos si el nuevo ticket viene incompleto
                const old = existingProcess.metadata;

                if ((!mergedMetadata.nombre_cliente || mergedMetadata.nombre_cliente === 'Cliente Desconocido') && old.nombre_cliente) {
                    mergedMetadata.nombre_cliente = old.nombre_cliente;
                }

                if (!mergedMetadata.creado_por && old.creado_por) {
                    mergedMetadata.creado_por = old.creado_por;
                }

                if (!mergedMetadata.asunto && old.asunto) {
                    mergedMetadata.asunto = old.asunto;
                }

                // Preservar trazabilidad o niveles de escalamiento internos si existen
                if (old.current_level !== undefined) mergedMetadata.current_level = old.current_level;
                if (old.last_escalation_at) mergedMetadata.last_escalation_at = old.last_escalation_at;
            }

            const { data: process, error: pErr } = await supabase
                .from('workflow_processes')
                .upsert({
                    reference_id: ticketIdStr,
                    title: `${mergedMetadata.asunto || 'Ticket'} - ${mergedMetadata.nombre_cliente || 'Cliente'}`,
                    status: finalStatus,
                    process_type: 'Ticket AXCES',
                    metadata: mergedMetadata,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'reference_id' })
                .select()
                .single();

            if (pErr) throw pErr;

            // AHORA validamos perfil. Si no existe, al menos ya actualizamos la metadata del proceso
            // para que "Limpieza de Identidad" lo borre del usuario anterior.
            if (!profile || !isUUID(profile.id)) {
                return;
            }

            // 4. Actualizar nivel en metadata si es nuevo o el perfil tiene un nivel definido
            // Si el ticket ya tiene un nivel (porque fue escalado), lo respetamos.
            // Si no tiene, o es el primer sync, tomamos el nivel del técnico (0 o 1).
            const currentMetadataLevel = process?.metadata?.current_level;
            const profileLevel = profile.operational_level;

            // Si el ticket no tiene nivel O está en fase inicial (0 o 1) y el perfil es diferente
            const isInitialPhase = currentMetadataLevel === undefined || [0, 1].includes(currentMetadataLevel);
            const needsUpdate = isInitialPhase && profileLevel !== undefined && currentMetadataLevel !== profileLevel;

            if (needsUpdate) {
                await supabase
                    .from('workflow_processes')
                    .update({
                        metadata: {
                            ...process.metadata,
                            current_level: profileLevel
                        }
                    })
                    .eq('id', process.id);
            }

            // 5. Upsert Actividad (Paso Actual)
            const { data: activity, error: aErr } = await supabase
                .from('workflow_activities')
                .upsert({
                    process_id: process.id,
                    name: 'Gestión de Ticket',
                    status: finalStatus === 'PE' ? 'Active' : 'Completed',
                    activity_type: 'task',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'process_id,activity_type' })
                .select()
                .single();

            if (aErr) throw aErr;

            // 5. Upsert Workitem
            const { error: wErr } = await supabase
                .from('workflow_workitems')
                .upsert({
                    activity_id: activity.id,
                    participant_id: profile.id,
                    participant_type: 'user',
                    status: finalStatus,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'activity_id,participant_id' });

            if (wErr) throw wErr;

            // 6. LIMPIEZA AGRESIVA: Si el ticket cambió de dueño, reasignamos las otras tareas PE
            if (finalStatus === 'PE') {
                await supabase
                    .from('workflow_workitems')
                    .update({
                        status: 'RE', // Reasignado
                        updated_at: new Date().toISOString()
                    })
                    .eq('activity_id', activity.id)
                    .neq('participant_id', profile.id)
                    .eq('status', 'PE');
            }
        } catch (error) {
            /* console.error(`[Sync-Ticket] ❌ Error en ticket ${ticket.id}:`, error); */
        }
    },

    async syncGlobalTickets(daysBack: number = 30, onProgress?: (current: number, total: number) => void) {
        try {
            console.log(`[GlobalSync] 🌍 Iniciando sincronización global de ${daysBack} días...`);

            const now = new Date();
            const pastDate = new Date();
            pastDate.setDate(now.getDate() - daysBack);
            const startDateStr = pastDate.toISOString().split('T')[0];

            // 1. Obtener todos los tickets del periodo sin filtro de técnico
            const allApiTickets = await WisphubService.getAllTickets({
                startDate: startDateStr
            }, onProgress);

            console.log(`[GlobalSync] 📦 Recibidos ${allApiTickets.length} tickets de WispHub.`);

            // 2. Upsert Masivo (Espejo)
            const allProfiles = await this.getPlatformUsers();

            for (const ticket of allApiTickets) {
                await this.syncSingleTicketMirror(ticket, allProfiles);
                // No hay pausa aquí para procesar rápido las métricas globales
            }

            console.log("[GlobalSync] ✅ Sincronización Global COMPLETADA.");
            return true;
        } catch (error) {
            console.error("[GlobalSync] 🚨 Error en syncGlobalTickets:", error);
            return false;
        }
    },

    async syncWithWispHub(forceFull: boolean = false) {
        return this.syncMyTickets(forceFull);
    },

    async changeWispHubTechnician(ticketId: string, supabaseUserId: string, options: { priority?: number, file?: File | Blob, description?: string } = {}) {
        try {
            console.log(`[WispHub] 🔄 Iniciando sincronización FULL PUT para Ticket ${ticketId}...`);

            // 1. Obtener perfil
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', supabaseUserId)
                .single();

            if (!profile) {
                console.error(`[WispHub] 🛑 Error: No se encontró perfil para el usuario ${supabaseUserId}`);
                return false;
            }

            let finalWhId: string | number | undefined = profile.wisphub_id;

            // 2. Resolver ID Numérico (Necesario para persistencia efectiva en WispHub)
            try {
                const staff = await WisphubService.getStaff();
                const foundInStaff = staff.find(s =>
                    (profile.wisphub_id && s.usuario === profile.wisphub_id) ||
                    (profile.email && s.email === profile.email) ||
                    (profile.full_name && normalize(s.nombre).includes(normalize(profile.full_name))) ||
                    (profile.full_name && normalize(profile.full_name).includes(normalize(s.nombre)))
                );

                if (foundInStaff) {
                    console.log(`[WispHub] ✅ Técnico resuelto en Staff -> ID: ${foundInStaff.id}`);
                    finalWhId = foundInStaff.id;
                }
            } catch (staffErr) {
                console.error('[WispHub] Error consultando lista de Staff:', staffErr);
            }

            if (!finalWhId) {
                console.error(`[WispHub] 🛑 Error: No se pudo determinar el ID numérico de WispHub para ${profile.full_name}`);
                return false;
            }

            // 3. Obtener Datos Actuales (RAW) para el PUT completo
            const rawTicket = await WisphubService.getTicketRaw(ticketId);
            if (!rawTicket) {
                console.error(`[WispHub] 🛑 Error: No se pudo obtener el ticket ${ticketId} para actualización completa.`);
                return false;
            }

            // 4. Mapeo de Etiquetas a IDs (WispHub PUT es sumamente estricto)
            const priorityMap: Record<string, number> = { "Baja": 1, "Normal": 2, "Media": 2, "Alta": 3, "Muy Alta": 4 };
            const statusMap: Record<string, number> = { "Nuevo": 1, "Abierto": 1, "En Progreso": 2, "Resuelto": 3, "Cerrado": 4 };

            // 4b. Validar Asunto (WispHub rechaza si asuntos_default no está en su catálogo)
            const validSubjects = (WisphubService as any).TICKET_SUBJECTS || [];
            const currentAsunto = rawTicket.asunto || "Otro Asunto";
            const isAsuntoValid = validSubjects.some((s: string) => s.toLowerCase() === currentAsunto.toLowerCase());
            const safeAsunto = isAsuntoValid ? currentAsunto : (validSubjects[0] || "Otro Asunto");

            // 5. Construir Payload Completo (PUT LIMPIO - descripción sin HTML + trazabilidad)
            const cleanBase = stripHtml(rawTicket.descripcion || ".");
            const finalDescription = options.description
                ? `${cleanBase}\n\n${options.description}`.trim()
                : cleanBase;

            const payload = {
                servicio: rawTicket.servicio?.id_servicio || rawTicket.servicio?.id || rawTicket.servicio,
                asunto: currentAsunto,
                asuntos_default: safeAsunto,
                descripcion: finalDescription,
                prioridad: options.priority || priorityMap[rawTicket.prioridad] || 2,
                estado: statusMap[rawTicket.estado] || 1,
                tecnico: Number(finalWhId),
                departamento: rawTicket.departamento || "Soporte Técnico",
                departamentos_default: rawTicket.departamento || "Soporte Técnico",
                archivo_ticket: options.file
            };

            // 6. Ejecutar PUT
            const success = await WisphubService.updateTicket(ticketId, payload, 'PUT');

            if (success) {
                console.log(`[WispHub] 🚀 REASIGNACIÓN EXITOSA (Full PUT) para Ticket ${ticketId}`);
                return true;
            }
            return false;
        } catch (e) {
            console.error('[WispHub] ❌ Error crítico en changeWispHubTechnician:', e);
            return false;
        }
    },

    // --- SISTEMA DE DESPACHO INTELIGENTE (NOC) ---

    /**
     * Calcula el Dispatch Score para un ticket basado en prioridad, SLA y recurrencia.
     */
    async calculateDispatchScore(ticket: any): Promise<number> {
        let score = 0;

        // 1. Prioridad (Peso Crítico)
        const priorityWeights: Record<number, number> = {
            1: 5,   // Baja
            2: 20,  // Normal
            3: 50,  // Alta
            4: 100, // Muy Alta
            5: 150  // Crítica
        };
        score += priorityWeights[ticket.id_prioridad] || 20;

        // 2. Antigüedad (SLA) - 1 punto por hora abierto
        const hoursOpen = ticket.horas_abierto || 0;
        score += hoursOpen;

        // 3. Recurrencia (Visitas en el mes)
        const serviceId = ticket.servicio;
        if (serviceId) {
            const now = new Date();
            const recurrence = await this.getClientRecurrence(String(serviceId), now.getFullYear(), now.getMonth() + 1);
            if (recurrence > 1) {
                // Penalización/Prioridad por cada visita adicional
                score += (recurrence - 1) * 60;
            }
        }

        return score;
    },

    /**
     * Obtiene la cantidad de tickets/procesos para un cliente en un mes específico.
     */
    async getClientRecurrence(clientId: string, year: number, month: number): Promise<number> {
        const { data, error } = await supabase
            .rpc('get_client_visit_count', {
                p_client_id: clientId,
                p_year: year,
                p_month: month
            });

        if (error) {
            console.error('[Dispatch] Error calculando recurrencia:', error);
            return 0;
        }
        return data || 0;
    },

    /**
     * Obtiene la georreferenciación de un barrio desde la base de datos local.
     */
    async getNeighborhoodGeoref(name: string) {
        if (!name) return null;
        const { data, error } = await supabase
            .from('op_neighborhoods_georef')
            .select('*')
            .eq('name', name)
            .maybeSingle();

        if (error) {
            console.error('[Dispatch] Error obteniendo georef de barrio:', error);
            return null;
        }
        return data; // Contiene lat, lng, etc.
    },

    /**
     * Normaliza y guarda un barrio en el catálogo maestro (operación administrativa).
     */
    async saveNeighborhoodGeoref(data: { name: string, latitude: number, longitude: number, city?: string }) {
        const { error } = await supabase
            .from('op_neighborhoods_georef')
            .upsert({
                name: data.name,
                latitude: data.latitude,
                longitude: data.longitude,
                city: data.city || 'Desconocida',
                updated_at: new Date().toISOString()
            }, { onConflict: 'name' });

        return !error;
    },

    /**
     * Sincroniza el catálogo de barrios cruzando los datos de clientes de WispHub.
     */
    async syncNeighborhoodsWithClients() {
        try {
            const whBarrios = await WisphubService.getAllClientsBarrios();
            if (!whBarrios || whBarrios.length === 0) return { success: false, count: 0 };

            console.log(`[Workflow] Sincronizando ${whBarrios.length} candidatos de barrios...`);

            let newCount = 0;
            for (const item of whBarrios) {
                // Solo insertamos si no existe (no queremos sobreescribir coordenadas manuales con promedios de WH si ya existen)
                const { data: existing } = await supabase
                    .from('op_neighborhoods_georef')
                    .select('name')
                    .eq('name', item.name)
                    .maybeSingle();

                if (!existing) {
                    const { error } = await supabase
                        .from('op_neighborhoods_georef')
                        .insert({
                            name: item.name,
                            latitude: item.latitude || 0,
                            longitude: item.longitude || 0,
                            city: 'Detectada'
                        });

                    if (!error) newCount++;
                }
            }

            return { success: true, count: newCount };
        } catch (error) {
            console.error('[Workflow] Error en syncNeighborhoodsWithClients:', error);
            return { success: false, count: 0 };
        }
    },

    /**
     * Elimina un barrio del catálogo.
     */
    async deleteNeighborhood(name: string) {
        const { error } = await supabase
            .from('op_neighborhoods_georef')
            .delete()
            .eq('name', name);

        return !error;
    },

    /**
     * Obtiene todos los barrios del catálogo con sus estadísticas.
     */
    async getAllNeighborhoods() {
        const { data, error } = await supabase
            .from('op_neighborhoods_georef')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('[Workflow] Error obteniendo barrios:', error);
            return [];
        }
        return data;
    }
};
