export interface WispHubClient {
    id_servicio: number;
    nombre: string;
    cedula: string;
    estado: string;
    ip: string;
    plan_internet: {
        nombre: string;
        precio: number;
    };
    saldo_total?: number;
    fecha_instalacion?: string;
    last_result?: string;
}

export interface WispHubPlan {
    id: number;
    nombre: string;
    precio?: number;
    Precio?: number;
    costo?: number;
    velocidad_bajada: number;
    velocidad_subida: number;
    tipo: string;
}

export interface WispHubStaff {
    id?: number | string;
    nombre: string;
    usuario: string;
    nivel: string;
}

const BASE_URL = '/api/wisphub';

export const TICKET_SUBJECTS = [
    "Internet Lento", "No Tiene Internet", "No Responde El Router Wifi", "Router Wifi Reseteado(Valores De Fabrica)",
    "Cambio De Router Wifi", "Cambio De Contraseña En Router Wifi", "Cable Utp Dañado", "Internet Intermitente",
    "Cambio De Domicilio", "Reconexion", "Recolección De Equipos", "Conector Dañado", "Cambio A Fibra Óptica",
    "Cable Fibra Dañado", "Cables Mal Colocados", "Rj45 Dañado", "Cancelación", "Desconexión", "Caja Nap Dañada",
    "Niveles Potencia Altos", "Notificación Datacrédito", "Gestión De Cartera Corte 30", "Gestión De Cartera Corte 15",
    "Recolección De Equipos 2", "Noficación Datacrédito 2", "Retiro De Servicio", "Problema De Tv/Niveles Altos",
    "Problemas De Tv", "Internet Lento/Niveles Altos", "Validación De Niveles", "Instalación De Tv", "Problemas De Conexion",
    "Acceso Remoto Inactivo", "Fibra Partida", "Instatalacion Nueva", "Instalacion De Switch", "Punto De Tv Adicional",
    "Cable Flojo", "Cable De Fibra Colgado", "Cargador Dañado", "Router Dañado", "Verificacion De Megas", "Wifi Quemado",
    "Cable Bajito", "Sintonización Tv", "Instalación Tdt", "Reubicación de Onu", "Adaptación De Tdt", "Catv Quemada",
    "Problemas De Conexión/Niveles Altos", "Gestión Clausula", "Paz Y Salvo", "Descuento", "Recordatorio Pago Por Whatsapp",
    "Promesa De Pago", "Proyecto De Trabajo", "Cambio De Fecha 30", "Cambio De Fecha 15", "Cambio De Plan",
    "Cambio De Titular", "Gestión De Bienvenida", "No Interesado", "Cancela Solicitud", "Post Retiro", "Post Retiro 2 Gestión",
    "Post Retiro 3 Gestión", "Encuesta De Satisfacción", "Gestion Por Daño", "Cobro De Visita", "No Contesta Para Inst Tv",
    "Prorrateo Corte 30", "Prorrateo Corte 15", "Oferta Planes", "Confirmacion De Pago", "Asesoria Para Pago En Linea",
    "Asesoria Para Traslado", "Asesoria Para Reconexion", "Asesoria Para Cambio De Titular", "Asesoria Para Cambio De Plan",
    "Asesoria Para Cambio De Fecha De Pago", "Firma Del Contrato", "Asesoria Para Retiro", "Recordatorio Whatsapp - Cartera 2024",
    "Gmail - Recordatorio De Pago Factura - Corte 30"
];

const FALLBACK_TECHNICIANS: WispHubStaff[] = [
    { id: "tecnico4@rapilink-sas", nombre: "TOMAS MCAUSLAND", usuario: "tecnico4@rapilink-sas", nivel: "Técnico" },
    { id: "tecnico2@rapilink-sas", nombre: "VALENTINA SUAREZ", usuario: "tecnico2@rapilink-sas", nivel: "Técnico" },
    { id: "tecnico1@rapilink-sas", nombre: "ELENA MACHADO", usuario: "tecnico1@rapilink-sas", nivel: "Técnico" },
    { id: "administrador@rapilink-sas", nombre: "Vanessa Barrera", usuario: "administrador@rapilink-sas", nivel: "Administrativo" }
];

let GLOBAL_CLIENT_CACHE: WispHubClient[] | null = null;
let CACHE_PROMISE: Promise<void> | null = null;


// Helper to handle API requests with retries and better error handling
async function safeFetch(url: string, options: RequestInit = {}, retries = 2): Promise<Response> {
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;

            let errorBody = 'Unable to parse body';
            try {
                const clonedRes = res.clone();
                errorBody = await clonedRes.text();
            } catch (bodyError) {
                errorBody = `Body capture failed: ${bodyError}`;
            }

            console.error(`[WispHub API ERROR]
URL: ${url}
Status: ${res.status} ${res.statusText}
Payload: ${errorBody}
Attempt: ${i + 1}/${retries + 1}`);

            if (res.status === 404 || res.status === 401 || res.status === 403) return res;

        } catch (e) {
            console.error(`[WispHub FETCH EXCEPTION]
URL: ${url}
Error: ${e}
Attempt: ${i + 1}/${retries + 1}`);
        }
        if (i < retries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
    throw new Error(`Failed to fetch ${url} after ${retries + 1} attempts`);
}

export const WisphubService = {
    async getStaff(): Promise<WispHubStaff[]> {
        try {
            const response = await safeFetch(`${BASE_URL}/staff/`);
            if (!response.ok) return FALLBACK_TECHNICIANS;
            const data = await response.json();
            const staff = data.results || data || [];
            return staff.map((s: any) => ({
                id: s.id || s.id_usuario,
                nombre: s.nombre,
                usuario: s.usuario || s.email,
                nivel: s.nivel || 'Desconocido'
            }));
        } catch (error) {
            return FALLBACK_TECHNICIANS;
        }
    },

    async getAllClients(page: number = 1, limit: number = 20, filters?: { plan?: string; status?: string }): Promise<{ results: WispHubClient[], count: number }> {
        try {
            const offset = (page - 1) * limit;
            let url = `${BASE_URL}/clientes/?limit=${limit}&offset=${offset}&ordering=id`;
            if (filters?.plan) url += `&plan_internet=${filters.plan}`;
            if (filters?.status && filters.status !== 'Todos') url += `&estado=${encodeURIComponent(filters.status)}`;

            const response = await safeFetch(url);
            if (!response.ok) return { results: [], count: 0 };
            const data = await response.json();
            return { results: data.results || [], count: data.count || 0 };
        } catch (error) {
            return { results: [], count: 0 };
        }
    },

    async ensureFullCache(): Promise<void> {
        if (GLOBAL_CLIENT_CACHE !== null) return;
        if (CACHE_PROMISE !== null) return CACHE_PROMISE;

        CACHE_PROMISE = (async () => {
            try {
                let allClients: WispHubClient[] = [];
                let nextUrl: string | null = `${BASE_URL}/clientes/?limit=500`;
                let pages = 0;

                while (nextUrl && pages < 100) {
                    const res = await fetch(nextUrl);
                    if (!res.ok) break;
                    const data = await res.json();
                    allClients = [...allClients, ...(data.results || [])];
                    if (data.next) {
                        nextUrl = data.next.replace(/https?:\/\/(api\.)?wisphub\.(io|net)\/api/, '/api/wisphub');
                    } else {
                        nextUrl = null;
                    }
                    pages++;
                }
                GLOBAL_CLIENT_CACHE = allClients;
            } catch (e) {
                console.error("[WispHub] Cache Sync Failed:", e);
            } finally {
                CACHE_PROMISE = null;
            }
        })();
        return CACHE_PROMISE;
    },

    async searchClients(query: string): Promise<WispHubClient[]> {
        if (!GLOBAL_CLIENT_CACHE) this.ensureFullCache();
        try {
            const isNumeric = /^\d+$/.test(query);
            if (!isNumeric && GLOBAL_CLIENT_CACHE) {
                const searchTerms = query.toLowerCase().trim().split(/\s+/);
                return GLOBAL_CLIENT_CACHE.filter(c => searchTerms.every(t => (c.nombre || '').toLowerCase().includes(t)));
            }
            const url = isNumeric ? `${BASE_URL}/clientes/?limit=50&cedula=${query}` : `${BASE_URL}/clientes/?limit=50&nombre=${encodeURIComponent(query)}`;
            const response = await safeFetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            return data.results || [];
        } catch (error) {
            return [];
        }
    },

    async getInternetPlans(): Promise<WispHubPlan[]> {
        try {
            const response = await fetch(`${BASE_URL}/plan-internet/?limit=1000`);
            if (!response.ok) return [];
            const data = await response.json();
            return data.results || [];
        } catch (error) {
            return [];
        }
    },

    async getTickets(serviceId: number, clientName?: string, cedula?: string): Promise<any[]> {
        try {
            const currentSId = String(serviceId);
            const targetCedula = String(cedula || "").trim();
            const cleanName = (clientName || '').split(' (')[0].trim();

            // 1. OBTENER IDs HISTÓRICOS DESDE FACTURAS
            let historicalSIds = new Set<string>([currentSId]);
            try {
                const invoices = await this.getInvoices(serviceId, clientName);
                invoices.forEach(inv => {
                    if (inv.servicio?.id_servicio) historicalSIds.add(String(inv.servicio.id_servicio));
                    else if (inv.servicio) historicalSIds.add(String(inv.servicio));
                });
            } catch (e) { /* ignore */ }

            // 2. BUSCAR SOLO POR ID Y CÉDULA (Eliminamos búsqueda por nombre)
            const queries = Array.from(historicalSIds).map(id => `${BASE_URL}/tickets/?search=${id}&limit=50`);
            if (targetCedula.length > 5) {
                queries.push(`${BASE_URL}/tickets/?search=${targetCedula}&limit=50`);
            }

            const results = await Promise.all(
                queries.slice(0, 10).map(url => safeFetch(url).then(res => res.ok ? res.json() : { results: [] }))
            );

            // 3. UNIFICAR Y FILTRAR
            let allFound: any[] = [];
            results.forEach(data => { if (data.results) allFound = [...allFound, ...data.results]; });

            const mapped = allFound.map(t => this.mapTicket(t));
            const uniqueMap = new Map();

            mapped.forEach(t => {
                const isIdMatch = historicalSIds.has(String(t.servicio));
                const isCedulaMatch = targetCedula.length > 5 && targetCedula === String(t.cedula).trim();

                // Solo permitimos coincidencias por ID exacto de servicio o Cédula exacta
                if (isIdMatch || isCedulaMatch) {
                    uniqueMap.set(t.id, t);
                }
            });

            const final = Array.from(uniqueMap.values()).sort((a: any, b: any) => Number(b.id) - Number(a.id));
            console.log(`[WispHub] Recuperados ${final.length} tickets (Filtrado Estricto ID/Cédula) para ${cleanName}`);
            return final;
        } catch (error) {
            console.error("[WispHub] Error en historial:", error);
            return [];
        }
    },

    async getAllTickets(onProgress?: (current: number, total: number) => void): Promise<any[]> {
        try {
            let allResults: any[] = [];
            const pageSize = 100;
            let currentOffset = 0;
            let totalCount = 0;

            while (true) {
                const url = `${BASE_URL}/tickets/?limit=${pageSize}&offset=${currentOffset}&id_estado=1&ordering=-id`;
                const response = await safeFetch(url);
                if (!response.ok) break;

                const data = await response.json();
                const results = data.results || [];
                if (currentOffset === 0) totalCount = data.count || 0;

                results.forEach((t: any) => {
                    allResults.push(this.mapTicket(t));
                });

                if (onProgress) onProgress(allResults.length, totalCount);
                if (results.length === 0 || allResults.length >= totalCount) break;
                currentOffset += results.length;
            }
            return allResults;
        } catch (error) {
            return [];
        }
    },

    mapTicket(t: any) {
        const now = new Date();
        const createdDate = new Date(t.fecha_creacion || t.created_at || t.fecha);
        const diffMs = now.getTime() - createdDate.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

        const priorityLabels: any = { '1': 'Baja', '2': 'Normal', '3': 'Alta', '4': 'Muy Alta', '5': 'Crítica' };
        const priorityTextToId: any = { 'Baja': 1, 'Normal': 2, 'Alta': 3, 'Muy Alta': 4, 'Crítica': 5 };

        let priorityKey = String(t.prioridad || '1');
        if (priorityTextToId[priorityKey]) priorityKey = String(priorityTextToId[priorityKey]);

        let finalClientName = t.nombre_cliente || t.cliente_nombre || "Cliente Desconocido";
        let finalCedula = "";

        const possibleClient = t.cliente || t.servicio;
        if (possibleClient && typeof possibleClient === 'object') {
            finalClientName = possibleClient.nombre || possibleClient.client_name || finalClientName;
            finalCedula = possibleClient.cedula || "";
        }

        const serviceObj = typeof t.servicio === 'object' ? t.servicio : null;
        let finalServiceId = String(t.id_servicio || t.servicio || "0");
        if (serviceObj) {
            finalServiceId = String(serviceObj.id_servicio || serviceObj.id || finalServiceId);
            if (!finalCedula) finalCedula = serviceObj.cedula || "";
        }

        let finalAsunto = "Sin Asunto";
        if (t.asunto) {
            finalAsunto = typeof t.asunto === 'object' ? (t.asunto.nombre || "Asunto") : String(t.asunto);
        }

        // Lógica de Estado AXCES: Abierto, Suspendido, Resuelto, Cerrado
        const statusText = String(t.estado || 'Nuevo');
        let finalNombreEstado = statusText;
        let finalIdEstado = 1; // 1 = Abierto/Nuevo por defecto

        const lowerStatus = statusText.toLowerCase();
        if (lowerStatus.includes('cerrado') || lowerStatus.includes('resuelto')) {
            finalIdEstado = 3;
            finalNombreEstado = 'Cerrado';
        } else if (lowerStatus.includes('progreso') || lowerStatus.includes('espera')) {
            finalIdEstado = 2;
            finalNombreEstado = 'En Progreso';
        }

        return {
            id: String(t.id_ticket || t.id || "0"),
            asunto: finalAsunto,
            nombre_cliente: finalClientName,
            cedula: finalCedula,
            prioridad: priorityLabels[priorityKey] || "Normal",
            id_prioridad: Number(priorityKey),
            nombre_estado: finalNombreEstado,
            id_estado: finalIdEstado,
            servicio: finalServiceId,
            servicio_completo: serviceObj,
            nombre_tecnico: t.nombre_tecnico || t.tecnico?.nombre || t.tecnico || "Sin asignar",
            horas_abierto: diffHours,
            sla_status: diffHours > 48 ? 'critico' : diffHours > 24 ? 'amarillo' : 'verde',
            fecha_creacion: t.fecha_creacion || t.created_at || t.fecha
        };
    },

    async getTicketDetail(id: string | number): Promise<any> {
        try {
            const response = await fetch(`${BASE_URL}/tickets/${id}/`);
            if (response.ok) {
                const data = await response.json();
                return this.mapTicket(data);
            }
            return null;
        } catch (e) {
            return null;
        }
    },

    async getServiceDetail(id: string | number): Promise<any> {
        try {
            const response = await safeFetch(`${BASE_URL}/clientes/${id}/`);
            return response.ok ? await response.json() : null;
        } catch (e) {
            return null;
        }
    },

    async getClientPortalLink(serviceId: string | number): Promise<string | null> {
        try {
            const response = await safeFetch(`${BASE_URL}/clientes/${serviceId}/saldo/`);
            if (response.ok) {
                const data = await response.json();
                return data.enlace_portal || data.url || null;
            }
            return null;
        } catch (e) {
            return null;
        }
    },

    async getPlanDetails(id: string | number, type?: string): Promise<any> {
        try {
            let detailUrl = `${BASE_URL}/plan-internet/queue/${id}/`;
            if (type?.toLowerCase().includes('pppoe')) detailUrl = `${BASE_URL}/plan-internet/pppoe/${id}/`;
            const response = await safeFetch(detailUrl);
            if (response.ok) return await response.json();
            const altUrl = detailUrl.includes('queue') ? `${BASE_URL}/plan-internet/pppoe/${id}/` : `${BASE_URL}/plan-internet/queue/${id}/`;
            const altRes = await safeFetch(altUrl);
            return altRes.ok ? await altRes.json() : null;
        } catch (e) {
            return null;
        }
    },

    async getClientBalance(serviceId: number | string): Promise<number> {
        try {
            // 1. Try with the provided ID
            const response = await safeFetch(`${BASE_URL}/clientes/${serviceId}/saldo/`);
            let saldo = 0;
            if (response.ok) {
                const data = await response.json();
                saldo = Number(data.saldo || 0);
                if (saldo > 0) return saldo;
            }

            // 2. Fallback: If saldo is 0 but the ID looks like a Cedula (long number)
            // or if we simply want to be sure, try searching by Cedula to find the real service ID
            const idStr = String(serviceId);
            if (idStr.length >= 7) { // Likely a Cedula, not a Service ID
                const searchRes = await safeFetch(`${BASE_URL}/clientes/?cedula=${idStr}`);
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    const realClient = (searchData.results || [])[0];
                    if (realClient?.id_servicio && String(realClient.id_servicio) !== idStr) {
                        const realRes = await safeFetch(`${BASE_URL}/clientes/${realClient.id_servicio}/saldo/`);
                        if (realRes.ok) {
                            const realData = await realRes.json();
                            return Number(realData.saldo || 0);
                        }
                    }
                }
            }

            return saldo;
        } catch (e) {
            console.error("[WispHub Balance] Critical Error:", e);
            return 0;
        }
    },

    async getTicketComments(ticketId: string | number): Promise<any[]> {
        try {
            const response = await safeFetch(`${BASE_URL}/tickets-comentarios/?ticket=${ticketId}`);
            if (!response.ok) return [];
            const data = await response.json();
            return data.results || data || [];
        } catch (e) {
            return [];
        }
    },

    async addTicketComment(ticketId: string | number, comment: string): Promise<boolean> {
        try {
            const formData = new FormData();
            formData.append('ticket', String(ticketId));
            formData.append('comentario', comment);
            const response = await safeFetch(`${BASE_URL}/tickets-comentarios/`, { method: 'POST', body: formData });
            return response.ok;
        } catch (e) {
            return false;
        }
    },

    async updateClientComments(serviceId: number, newComment: string): Promise<boolean> {
        try {
            const client = await this.getServiceDetail(serviceId);
            const currentComments = client?.comentarios || '';
            const timestamp = new Date().toLocaleString('es-CO', { hour12: false });
            const updatedComments = `${currentComments}\n[${timestamp}]: ${newComment}`.trim();
            const response = await safeFetch(`${BASE_URL}/clientes/${serviceId}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comentarios: updatedComments })
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    },

    async createTicket(ticketData: {
        servicio: number;
        asunto: string;
        descripcion: string;
        prioridad: number;
        technicianId?: string;
    }): Promise<any> {
        try {
            const body = {
                servicio: ticketData.servicio,
                asunto: `CRM - Report - ${ticketData.asunto}`,
                asuntos_default: ticketData.asunto,
                descripcion: ticketData.descripcion,
                prioridad: ticketData.prioridad.toString(),
                estado: '1',
                tecnico: ticketData.technicianId || 1408762,
                departamento: 'Administrativo',
                departamentos_default: 'Administrativo'
            };
            const response = await safeFetch(`${BASE_URL}/tickets/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            return response.ok ? { success: true } : { success: false, message: await response.text() };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    },

    async getAllRecentTickets(limit: number = 50): Promise<any[]> {
        try {
            // Traemos los últimos tickets, pero priorizamos los que no están cerrados
            // id_estado=1 (Nuevo), id_estado=2 (En Progreso)
            const url = `${BASE_URL}/tickets/?limit=${limit}&ordering=-id&id_estado__in=1,2`;
            const response = await safeFetch(url);
            if (!response.ok) {
                // Si el filtro __in falla (depende de la versión de la API), intentamos el genérico
                const fallbackRes = await safeFetch(`${BASE_URL}/tickets/?limit=${limit}&ordering=-id`);
                if (!fallbackRes.ok) return [];
                const fallbackData = await fallbackRes.json();
                return (fallbackData.results || []).map((t: any) => this.mapTicket(t));
            }
            const data = await response.json();
            return (data.results || []).map((t: any) => this.mapTicket(t));
        } catch (error) {
            return [];
        }
    },

    async getInvoices(serviceId: number, clientName?: string): Promise<any[]> {
        try {
            let allResults: any[] = [];
            const targetCedula = clientName?.match(/\((\d+)\)/)?.[1];
            const cleanTargetName = (clientName || '').toLowerCase().split(' (')[0].trim();
            for (let i = 0; i < 5; i++) {
                const url = `${BASE_URL}/facturas/?fecha_emision__range_0=2021-01-01&limit=500&offset=${i * 500}&ordering=-id`;
                const res = await safeFetch(url);
                if (!res.ok) break;
                const data = await res.json();
                const results = data.results || [];
                if (results.length === 0) break;
                const filtered = results.filter((inv: any) => {
                    const invCedula = String(inv.cliente?.cedula || '');
                    const invName = (inv.cliente?.nombre || '').toLowerCase();
                    const invSId = String(inv.servicio?.id_servicio || inv.servicio || '');
                    if (targetCedula && invCedula === targetCedula) return true;
                    if (String(serviceId) === invCedula || String(serviceId) === invSId) return true;
                    if (cleanTargetName && invName.includes(cleanTargetName)) return true;
                    return false;
                });
                allResults = [...allResults, ...filtered];
                if (allResults.length >= 12) break;
                if (results.length < 500) break;
            }
            const unique = Array.from(new Map(allResults.map(inv => [inv.id_factura, inv])).values());
            return unique.sort((a, b) => b.id_factura - a.id_factura);
        } catch (e) {
            return [];
        }
    },

    async getPayments(serviceId: number): Promise<any[]> {
        try {
            const res = await safeFetch(`${BASE_URL}/pagos/?id_servicio=${serviceId}&limit=100&ordering=-id`);
            if (!res.ok) return [];
            const data = await res.json();
            return (data.results || []).filter((p: any) => String(p.servicio?.id_servicio || p.servicio) === String(serviceId));
        } catch (e) {
            return [];
        }
    }
};
