export interface PermissionUser {
    id: string;
    role: string;
    permissions?: {
        ticket_management?: {
            can_edit?: boolean;
            can_escalate?: boolean;
            [key: string]: any;
        };
        [key: string]: any;
    };
    [key: string]: any;
}

export interface PermissionTicket {
    id: string;
    status?: string;
    id_estado?: number | string;
    estado_id?: number | string;
    workflow_activities?: {
        workflow_processes?: {
            metadata?: {
                status?: string;
                estado?: string;
                id_estado?: number | string;
                estado_id?: number | string;
                [key: string]: any;
            };
            [key: string]: any;
        };
        [key: string]: any;
    };
    [key: string]: any;
}

/**
 * Determines if a user can edit a specific ticket.
 * logic:
 * - Admins and Coordinators can always edit.
 * - Technicians can edit if they have explicit permission AND the ticket is NOT closed.
 */
export const canEditTicket = (user: PermissionUser | null, ticket: PermissionTicket | null): boolean => {
    if (!user || !ticket) return false;

    // 1. Superusers (Always allowed)
    if (['admin', 'coordinador', 'superadmin'].includes(user.role)) return true;

    // 2. Granular Permission Check
    // Must have explicit 'can_edit' permission
    const hasEditPermission = user.permissions?.ticket_management?.can_edit === true;

    if (hasEditPermission) {
        // Safe Guard: Even with permission, cannot edit Closed tickets
        const metadata = ticket.workflow_activities?.workflow_processes?.metadata || {};
        const statusId = Number(ticket.id_estado ?? ticket.estado_id ?? metadata.id_estado ?? metadata.estado_id);
        const statusName = (ticket.status ?? metadata.status ?? metadata.estado ?? '').toLowerCase();

        const isClosed = statusId === 4 || statusName === 'cerrado';

        return !isClosed;
    }

    return false;
};

/**
 * Determines if a user can escalate a specific ticket.
 * logic:
 * - Admins and Coordinators can always escalate.
 * - Technicians can escalate if they have explicit permission AND the ticket is NOT closed.
 */
export const canEscalateTicket = (user: PermissionUser | null, ticket: PermissionTicket | null): boolean => {
    if (!user || !ticket) return false;

    // 1. Superusers (Always allowed)
    if (['admin', 'coordinador', 'superadmin'].includes(user.role)) return true;

    // 2. Granular Permission Check
    const hasEscalatePermission = user.permissions?.ticket_management?.can_escalate === true;

    if (hasEscalatePermission) {
        // Safe Guard: Even with permission, cannot escalate Closed tickets
        const metadata = ticket.workflow_activities?.workflow_processes?.metadata || {};
        const statusId = Number(ticket.id_estado ?? ticket.estado_id ?? metadata.id_estado ?? metadata.estado_id);
        const statusName = (ticket.status ?? metadata.status ?? metadata.estado ?? '').toLowerCase();

        const isClosed = statusId === 4 || statusName === 'cerrado';

        return !isClosed;
    }

    return false;
};

/**
 * Verifica si un usuario tiene acceso a un menú específico basado en su configuración de perfil.
 * @param allowedMenus Array de strings con los títulos de grupos o etiquetas de ítemes permitidos.
 * @param itemLabel Etiqueta del ítem de menú (ej: 'Mis Tareas').
 * @param groupTitle Título del grupo (ej: 'Escalamiento').
 * @param isAdmin Si el usuario es administrador.
 */
export function isMenuAllowed(
    allowedMenus: string[],
    itemLabel: string,
    groupTitle?: string,
    isAdmin: boolean = false
): boolean {
    if (isAdmin) return true;
    if (!allowedMenus || allowedMenus.length === 0) return false;

    // Permitir Dashboard por defecto si no hay nada configurado (o si está en la lista)
    if (itemLabel === 'Dashboard') return true;

    return allowedMenus.includes(itemLabel) || (groupTitle ? allowedMenus.includes(groupTitle) : false);
}
