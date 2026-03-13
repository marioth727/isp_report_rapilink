import { supabase } from './supabase';

export interface ConsumptionStat {
    technicianId: string;
    technicianName: string;
    category: string;
    itemName: string;
    totalQuantity: number;
    ticketCount: number;
    avgPerTicket: number;
}

export type TicketCategory = 'INSTALACION' | 'CORRECTIVO' | 'TRASLADO' | 'RETIRO' | 'ADMINISTRATIVO';

// Arrays canónicos basados en TICKET_SUBJECTS de WispHub (normalizados a mayúsculas para evitar problemas de tipeo)
const SUBJECTS_INSTALACION = [
    "INSTALACIÓN NUEVA", "INSTALACION NUEVA", "INSTATALACION NUEVA", "INSTALACIÓN DE SWITCH", "INSTALACION DE SWITCH",
    "PUNTO DE TV ADICIONAL", "INSTALACIÓN DE TV", "INSTALACION DE TV", "INSTALACIÓN TDT", "INSTALACION TDT"
];

const SUBJECTS_TRASLADO = [
    "CAMBIO DE DOMICILIO", "REUBICACIÓN DE ONU", "REUBICACION DE ONU"
];

const SUBJECTS_RETIRO = [
    "RETIRO DE SERVICIO", "RECOLECCIÓN DE EQUIPOS", "RECOLECCION DE EQUIPOS",
    "RECOLECCIÓN DE EQUIPOS 2", "RECOLECCION DE EQUIPOS 2", "CANCELACIÓN", "CANCELACION",
    "DESCONEXIÓN", "DESCONEXION", "POST RETIRO", "POST RETIRO 2 GESTIÓN", "POST RETIRO 2 GESTION",
    "POST RETIRO 3 GESTIÓN", "POST RETIRO 3 GESTION"
];

const SUBJECTS_CORRECTIVO = [
    "INTERNET LENTO", "NO TIENE INTERNET", "NO RESPONDE EL ROUTER WIFI", "ROUTER WIFI RESETEADO(VALORES DE FABRICA)",
    "CAMBIO DE ROUTER WIFI", "CAMBIO DE CONTRASEÑA EN ROUTER WIFI", "CABLE UTP DAÑADO", "INTERNET INTERMITENTE",
    "CONECTOR DAÑADO", "CAMBIO A FIBRA ÓPTICA", "CAMBIO A FIBRA OPTICA", "CABLE FIBRA DAÑADO", "CABLES MAL COLOCADOS",
    "RJ45 DAÑADO", "CAJA NAP DAÑADA", "NIVELES POTENCIA ALTOS", "PROBLEMA DE TV/NIVELES ALTOS",
    "PROBLEMAS DE TV", "INTERNET LENTO/NIVELES ALTOS", "VALIDACIÓN DE NIVELES", "VALIDACION DE NIVELES",
    "PROBLEMAS DE CONEXION", "PROBLEMAS DE CONEXIÓN", "CABLE FLOJO", "CABLE DE FIBRA COLGADO",
    "CARGADOR DAÑADO", "ROUTER DAÑADO", "VERIFICACION DE MEGAS", "VERIFICACIÓN DE MEGAS", "WIFI QUEMADO",
    "CABLE BAJITO", "SINTONIZACIÓN TV", "SINTONIZACION TV", "ADAPTACIÓN DE TDT", "ADAPTACION DE TDT",
    "CATV QUEMADA", "PROBLEMAS DE CONEXIÓN/NIVELES ALTOS", "PROBLEMAS DE CONEXION/NIVELES ALTOS", "GESTION POR DAÑO", "GESTIÓN POR DAÑO"
];

export const categorizeTicket = (subject: string): TicketCategory => {
    if (!subject) return 'ADMINISTRATIVO';
    // WispHub a menudo guarda "Asunto - Cliente". Cortamos aquí para obtener el asunto puro
    const isolatedSubject = subject.includes(' - ') ? subject.split(' - ')[0] : subject;
    // Removemos acentos y pasamos a mayúsculas para una comparación estricta de la frase completa
    const normalizedSubject = isolatedSubject.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

    if (SUBJECTS_INSTALACION.includes(normalizedSubject)) return 'INSTALACION';
    if (SUBJECTS_CORRECTIVO.includes(normalizedSubject)) return 'CORRECTIVO';
    if (SUBJECTS_TRASLADO.includes(normalizedSubject)) return 'TRASLADO';
    if (SUBJECTS_RETIRO.includes(normalizedSubject)) return 'RETIRO';

    // Si meten un nuevo asunto que no está catalogado o no machea exactamente, se va a ADMINISTRATIVO
    return 'ADMINISTRATIVO';
};

export interface AdvancedStatsResponse {
    stats: ConsumptionStat[];
    totalUniqueTickets: number;
    materialRanking: { name: string; qty: number; }[];
    categorySummary: Record<string, { units: number, tickets: number }>;
    technicianTicketCount: Record<string, number>;
    ticketConsumption: Record<string, {
        ticketId: string;
        technicianName: string;
        date: string;
        category: string;
        materials: { name: string; qty: number }[];
    }>;
}

export const getConsumptionAdvancedStats = async (days: number): Promise<AdvancedStatsResponse> => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    // 1. Fetch relevant movements
    const { data: movements, error: moveError } = await supabase
        .from('inventory_movements')
        .select(`
            id,
            notes,
            quantity,
            movement_type,
            origin_holder_id,
            created_at,
            inventory_assets!asset_id!inner (
                inventory_items!inner (name)
            ),
            origin:profiles!origin_holder_id (full_name)
        `)
        .in('movement_type', ['CONSUMO', 'installation'])
        .gte('created_at', startDateStr);

    if (moveError) throw moveError;
    if (!movements) return { stats: [], totalUniqueTickets: 0, materialRanking: [], categorySummary: {}, technicianTicketCount: {}, ticketConsumption: {} };

    // 2. Extract Ticket IDs and unique IDs to fetch from workflow_processes
    const ticketMoves = movements.map((m: any) => {
        const match = m.notes?.match(/#?(\d+)/); // More flexible: matches #67081 or 67081
        return {
            ...m,
            ticketId: match ? match[1] : null
        };
    }).filter(m => m.ticketId);

    const uniqueTicketIds = Array.from(new Set(ticketMoves.map(m => m.ticketId!)));

    // 3. Fetch ticket subjects from workflow_processes
    const { data: processes } = await supabase
        .from('workflow_processes')
        .select('reference_id, title')
        .in('reference_id', uniqueTicketIds);

    const subjectMap = new Map(processes?.map(p => [p.reference_id, p.title]) || []);

    // 4. Group and aggregate
    const statsMap: Record<string, ConsumptionStat> = {};

    ticketMoves.forEach((m: any) => {
        const subject = subjectMap.get(m.ticketId!) || 'DESCONOCIDO';
        const category = categorizeTicket(subject);
        const techId = m.origin_holder_id || 'system';
        const techName = m.origin?.full_name || 'Desconocido';
        const itemName = m.inventory_assets?.inventory_items?.name || 'Item';

        const key = `${techId}-${category}-${itemName}`;

        if (!statsMap[key]) {
            statsMap[key] = {
                technicianId: techId,
                technicianName: techName,
                category,
                itemName,
                totalQuantity: 0,
                ticketCount: 0,
                avgPerTicket: 0
            };
        }

        statsMap[key].totalQuantity += m.quantity || 1;
    });

    // Count unique tickets per key
    const uniqueTicketsPerKey: Record<string, Set<string>> = {};
    ticketMoves.forEach((m: any) => {
        const subject = subjectMap.get(m.ticketId!) || 'DESCONOCIDO';
        const category = categorizeTicket(subject);
        const techId = m.origin_holder_id || 'system';
        const itemName = m.inventory_assets?.inventory_items?.name || 'Item';
        const key = `${techId}-${category}-${itemName}`;

        if (!uniqueTicketsPerKey[key]) uniqueTicketsPerKey[key] = new Set<string>();
        uniqueTicketsPerKey[key].add(m.ticketId!);
    });

    const results: ConsumptionStat[] = Object.values(statsMap).map(stat => {
        const key = `${stat.technicianId}-${stat.category}-${stat.itemName}`;
        const ticketCount = uniqueTicketsPerKey[key]?.size || 0;
        return {
            ...stat,
            ticketCount,
            avgPerTicket: ticketCount > 0 ? stat.totalQuantity / ticketCount : 0
        };
    });

    // 5. Build Material Ranking
    const materialRankingRaw: Record<string, { name: string, qty: number }> = {};
    ticketMoves.forEach((m: any) => {
        const itemName = m.inventory_assets?.inventory_items?.name || 'Item';
        if (!materialRankingRaw[itemName]) materialRankingRaw[itemName] = { name: itemName, qty: 0 };
        materialRankingRaw[itemName].qty += m.quantity || 1;
    });

    // 6. Build Category Summary
    const categorySummary: Record<string, { units: number, tickets: number }> = {};
    const ticketsPerCategory: Record<string, Set<string>> = {};

    ticketMoves.forEach((m: any) => {
        const subject = subjectMap.get(m.ticketId!) || 'DESCONOCIDO';
        const category = categorizeTicket(subject);

        if (!categorySummary[category]) categorySummary[category] = { units: 0, tickets: 0 };
        if (!ticketsPerCategory[category]) ticketsPerCategory[category] = new Set();

        categorySummary[category].units += m.quantity || 1;
        ticketsPerCategory[category].add(m.ticketId!);
    });

    Object.keys(ticketsPerCategory).forEach(cat => {
        categorySummary[cat].tickets = ticketsPerCategory[cat].size;
    });

    // 7. Build Technician Ticket Summary
    const technicianTicketCount: Record<string, number> = {};
    const ticketsPerTech: Record<string, Set<string>> = {};

    ticketMoves.forEach((m: any) => {
        const techId = String(m.origin_holder_id || 'system');
        if (!ticketsPerTech[techId]) ticketsPerTech[techId] = new Set();
        ticketsPerTech[techId].add(m.ticketId!);
    });

    Object.keys(ticketsPerTech).forEach(techId => {
        technicianTicketCount[techId] = ticketsPerTech[techId].size;
    });

    // 8. Build Detailed Ticket Consumption
    const ticketConsumption: Record<string, any> = {};

    ticketMoves.forEach((m: any) => {
        const ticketId = m.ticketId!;
        const subject = subjectMap.get(ticketId) || 'DESCONOCIDO';
        const category = categorizeTicket(subject);
        const techName = m.origin?.full_name || 'Desconocido';
        const itemName = m.inventory_assets?.inventory_items?.name || 'Item';
        const qty = m.quantity || 1;
        const date = m.created_at;

        if (!ticketConsumption[ticketId]) {
            ticketConsumption[ticketId] = {
                ticketId,
                technicianName: techName,
                date,
                category,
                materials: []
            };
        }

        // Add or update material in the list
        const existingMat = ticketConsumption[ticketId].materials.find((mat: any) => mat.name === itemName);
        if (existingMat) {
            existingMat.qty += qty;
        } else {
            ticketConsumption[ticketId].materials.push({ name: itemName, qty });
        }
    });

    return {
        stats: results,
        totalUniqueTickets: uniqueTicketIds.length,
        materialRanking: Object.values(materialRankingRaw).sort((a, b) => b.qty - a.qty),
        categorySummary,
        technicianTicketCount,
        ticketConsumption
    };
};
