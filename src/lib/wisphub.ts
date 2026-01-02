export interface WispHubClient {
    id_servicio: number;
    nombre: string;
    cedula: string;
    estado: string; // 'Activo' | 'Suspendido' | 'Retirado'
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
}

export interface WispHubStaff {
    id?: number | string; // WispHub requires ID for ticket creation
    nombre: string;
    usuario: string; // email
    nivel: string; // "Técnico", "Administrador", etc.
}

const API_KEY = import.meta.env.VITE_WISPHUB_API_KEY;
// Use proxy if in dev, direct URL in prod (or backend function)
const BASE_URL = '/api/wisphub';

export const TICKET_SUBJECTS = [
    "Internet Lento",
    "No Tiene Internet",
    "No Responde El Router Wifi",
    "Router Wifi Reseteado(Valores De Fabrica)",
    "Cambio De Router Wifi",
    "Cambio De Contraseña En Router Wifi",
    "Cable Utp Dañado",
    "Internet Intermitente",
    "Cambio De Domicilio",
    "Reconexion",
    "Recolección De Equipos",
    "Conector Dañado",
    "Cambio A Fibra Óptica",
    "Cable Fibra Dañado",
    "Cables Mal Colocados",
    "Rj45 Dañado",
    "Cancelación",
    "Desconexión",
    "Caja Nap Dañada",
    "Niveles Potencia Altos",
    "Notificación Datacrédito",
    "Gestión De Cartera Corte 30",
    "Gestión De Cartera Corte 15",
    "Recolección De Equipos 2",
    "Noficación Datacrédito 2",
    "Retiro De Servicio",
    "Problema De Tv/Niveles Altos",
    "Problemas De Tv",
    "Internet Lento/Niveles Altos",
    "Validación De Niveles",
    "Instalación De Tv",
    "Problemas De Conexion",
    "Acceso Remoto Inactivo",
    "Fibra Partida",
    "Instatalacion Nueva",
    "Instalacion De Switch",
    "Punto De Tv Adicional",
    "Cable Flojo",
    "Cable De Fibra Colgado",
    "Cargador Dañado",
    "Router Dañado",
    "Verificacion De Megas",
    "Wifi Quemado",
    "Cable Bajito",
    "Sintonización Tv",
    "Instalación Tdt",
    "Reubicación de Onu",
    "Adaptación De Tdt",
    "Catv Quemada",
    "Problemas De Conexión/Niveles Altos",
    "Gestión Clausula",
    "Paz Y Salvo",
    "Descuento",
    "Recordatorio Pago Por Whatsapp",
    "Promesa De Pago",
    "Proyecto De Trabajo",
    "Cambio De Fecha 30",
    "Cambio De Fecha 15",
    "Cambio De Plan",
    "Cambio De Titular",
    "Gestión De Bienvenida",
    "No Interesado",
    "Cancela Solicitud",
    "Post Retiro",
    "Post Retiro 2 Gestión",
    "Post Retiro 3 Gestión",
    "Encuesta De Satisfacción",
    "Gestion Por Daño",
    "Cobro De Visita",
    "No Contesta Para Inst Tv",
    "Prorrateo Corte 30",
    "Prorrateo Corte 15",
    "Oferta Planes",
    "Confirmacion De Pago",
    "Asesoria Para Pago En Linea",
    "Asesoria Para Traslado",
    "Asesoria Para Reconexion",
    "Asesoria Para Cambio De Titular",
    "Asesoria Para Cambio De Plan",
    "Asesoria Para Cambio De Fecha De Pago",
    "Firma Del Contrato",
    "Asesoria Para Retiro",
    "Recordatorio Whatsapp - Cartera 2024",
    "Gmail - Recordatorio De Pago Factura - Corte 30"
];

const FALLBACK_TECHNICIANS: WispHubStaff[] = [
    { id: "jefe.operacion@rapilink-sas", nombre: "TOMAS ENRIQUE MORENO", usuario: "jefe.operacion@rapilink-sas", nivel: "Administrativo" },
    { id: "asistente.administrativa1@rapilink-sas", nombre: "ASISTENTE ADMINISTRATIVA", usuario: "asistente.administrativa1@rapilink-sas", nivel: "Administrativo" },
    { id: "tecnico4@rapilink-sas", nombre: "TOMAS MCAUSLAND", usuario: "tecnico4@rapilink-sas", nivel: "Técnico" },
    { id: "tecnico3@rapilink-sas", nombre: "MARIO SABANAGRANDE", usuario: "tecnico3@rapilink-sas", nivel: "Técnico" },
    { id: "tecnico2@rapilink-sas", nombre: "VALENTINA SUAREZ", usuario: "tecnico2@rapilink-sas", nivel: "Técnico" },
    { id: "tecnico1@rapilink-sas", nombre: "ELENA MACHADO", usuario: "tecnico1@rapilink-sas", nivel: "Técnico" },
    { id: "lucia@rapilink-sas", nombre: "LUCIA ACUÑA", usuario: "lucia@rapilink-sas", nivel: "Comercial" },
    { id: "comercial2@rapilink-sas", nombre: "CRISTOBAL MARTINEZ", usuario: "comercial2@rapilink-sas", nivel: "Comercial" },
    { id: "comercial1@rapilink-sas", nombre: "JAVIER OLIVERA", usuario: "comercial1@rapilink-sas", nivel: "Comercial" },
    { id: "administrador@rapilink-sas", nombre: "Vanessa Barrera", usuario: "administrador@rapilink-sas", nivel: "Administrativo" }
];

const DEFAULT_TECH_ID = 'tecnico4@rapilink-sas';

// Global Cache for Clients to handle "Contains" search locally
let GLOBAL_CLIENT_CACHE: WispHubClient[] | null = null;
let CACHE_PROMISE: Promise<void> | null = null;

export const WisphubService = {
    async getStaff(): Promise<WispHubStaff[]> {
        if (!API_KEY) {
            console.warn('[WispHub] No API Key configured, using fallback technicians');
            return FALLBACK_TECHNICIANS;
        }

        try {
            const response = await fetch(`${BASE_URL}/staff/`, {
                headers: {
                    'Authorization': `Api-Key ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                return FALLBACK_TECHNICIANS;
            }

            const data = await response.json();
            const staff = data.results || data || [];

            const techs = staff.map((s: any) => ({
                id: s.id || s.id_usuario,
                nombre: s.nombre,
                usuario: s.usuario || s.email,
                nivel: s.nivel || 'Desconocido'
            }));

            return techs.length > 0 ? techs : FALLBACK_TECHNICIANS;

        } catch (error) {
            console.error('[WispHub] Error getting staff:', error);
            return FALLBACK_TECHNICIANS;
        }
    },

    async getAllClients(page: number = 1, limit: number = 20, filters?: { plan?: string; status?: string }): Promise<{ results: WispHubClient[], count: number }> {
        if (!API_KEY) throw new Error("WispHub API Key not configured");

        try {
            // Native Filter using ID if plan selected
            // Reverted from "Fetch All" strategy as internal tests proved plan_internet=ID works.

            // Use LIMIT + OFFSET for reliable pagination (API ignores page param with limit)
            const offset = (page - 1) * limit;
            let url = `${BASE_URL}/clientes/?limit=${limit}&offset=${offset}&ordering=id`;

            if (filters?.plan) {
                // Now receiving ID, so filtering by ID
                url += `&plan_internet=${filters.plan}`;
            }

            if (filters?.status && filters.status !== 'Todos') {
                url += `&estado=${encodeURIComponent(filters.status)}`;
            }

            console.log(`[WispHub] Fetching clients: ${url}`);

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Api-Key ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`[WispHub] Error fetching clients: ${response.statusText}`);
                return { results: [], count: 0 };
            }

            const data = await response.json();

            // No need for strict JS filtering anymore as API handles ID filtering correctly
            return { results: data.results || [], count: data.count || 0 };

        } catch (error) {
            console.error('[WispHub] Error getting all clients:', error);
            return { results: [], count: 0 };
        }
    },

    // Helper to download FULL database for robust search
    async ensureFullCache(): Promise<void> {
        // If cache exists, we are done.
        if (GLOBAL_CLIENT_CACHE !== null) return;

        // If a request is already running, return THAT promise so we wait for it.
        if (CACHE_PROMISE !== null) return CACHE_PROMISE;

        if (!API_KEY) return;

        console.log("[WispHub] Starting Background Sync of ALL Clients...");

        // Create the promise and assign it to the singleton
        CACHE_PROMISE = (async () => {
            try {
                let allClients: WispHubClient[] = [];
                // Use safe limit: 500 (2000 might be capped by API or timeout)
                let nextUrl = `${BASE_URL}/clientes/?limit=500`;
                let pages = 0;

                // 100 pages * 500 = 50,000 clients cap. User has ~6500, so ~13 pages. Safe.
                while (nextUrl && pages < 100) {
                    try {
                        const res = await fetch(nextUrl, { headers: { 'Authorization': `Api-Key ${API_KEY}` } });
                        if (!res.ok) break;
                        const data = await res.json();
                        allClients = [...allClients, ...(data.results || [])];

                        // Log progress occasionally
                        if (pages === 0) console.log(`[WispHub] Total count to fetch: ${data.count || 'Unknown'}`);
                        if (pages % 5 === 0) console.log(`[WispHub] Sync progress: ${allClients.length} clients...`);

                        if (data.next && (data.results?.length || 0) > 0) {
                            let nextLink = data.next;
                            // Robust URL replacement for proxying
                            if (nextLink.includes('wisphub.io/api')) nextLink = nextLink.replace(/https?:\/\/(api\.)?wisphub\.io\/api/, '/api/wisphub');
                            else if (nextLink.includes('wisphub.net/api')) nextLink = nextLink.replace(/https?:\/\/(api\.)?wisphub\.net\/api/, '/api/wisphub');
                            nextUrl = nextLink;
                        } else {
                            nextUrl = '';
                        }
                        pages++;
                    } catch (e) {
                        console.error("[WispHub] Page fetch error:", e);
                        break;
                    }
                }

                GLOBAL_CLIENT_CACHE = allClients;
                console.log(`[WispHub] Cache Sync Complete. Total Clients Cached: ${allClients.length}`);
            } catch (e) {
                console.error("[WispHub] Cache Sync Failed:", e);
            } finally {
                CACHE_PROMISE = null; // Clear promise so we can retry if needed
            }
        })();

        return CACHE_PROMISE;
    },

    async searchClients(query: string): Promise<WispHubClient[]> {
        if (!API_KEY) throw new Error("WispHub API Key not configured");

        // Kick off cache sync if not exists (non-blocking if we use API first, but we want robust search)
        if (!GLOBAL_CLIENT_CACHE) {
            this.ensureFullCache(); // Start background sync logic (idempotent via promise)
        }

        try {
            console.log(`[WispHub] Searching for: ${query}`);
            const isNumeric = /^\d+$/.test(query);
            let results: WispHubClient[] = [];

            // 1. If Cache is Ready, USE IT (Fastest + Most Accurate for "Contains")
            if (!isNumeric && GLOBAL_CLIENT_CACHE) {
                console.log("[WispHub] Using Local Cache for search");
                const searchTerms = query.toLowerCase().trim().split(/\s+/);
                return GLOBAL_CLIENT_CACHE.filter((client) => {
                    const clientName = (client.nombre || '').toLowerCase();
                    return searchTerms.every(term => clientName.includes(term));
                });
            }

            // 2. If Numeric or No Cache Yet, use API
            if (isNumeric) {
                const url = `${BASE_URL}/clientes/?limit=50&cedula=${encodeURIComponent(query)}`;
                const response = await fetch(url, { headers: { 'Authorization': `Api-Key ${API_KEY}` } });
                if (response.ok) {
                    const data = await response.json();
                    results = data.results || [];
                }
            } else {
                // Multi-fetch strategy (Fallback until cache is ready)
                const words = query.trim().split(/\s+/).filter(w => w.length > 2);
                const searchTerms = words.length > 0 ? words : [query.trim()];

                const fetchPromises = searchTerms.map(term => {
                    const url = `${BASE_URL}/clientes/?limit=300&nombre=${encodeURIComponent(term)}`;
                    return fetch(url, { headers: { 'Authorization': `Api-Key ${API_KEY}` } })
                        .then(res => res.ok ? res.json() : { results: [] })
                        .then(data => data.results || [])
                        .catch(() => []);
                });

                const resultsArrays = await Promise.all(fetchPromises);
                const allCandidates = resultsArrays.flat();

                // Deduplicate
                const seenIds = new Set();
                for (const client of allCandidates) {
                    if (client.id_servicio && !seenIds.has(client.id_servicio)) {
                        seenIds.add(client.id_servicio);
                        results.push(client);
                    }
                }
            }

            // Client-side refinement
            if (!isNumeric) {
                const searchTerms = query.toLowerCase().trim().split(/\s+/);
                results = results.filter((client: any) => {
                    const clientName = (client.nombre || '').toLowerCase();
                    return searchTerms.every(term => clientName.includes(term));
                });

                // FALLBACK: If API failed AND Cache isn't ready yet, force a blocking wait for cache?
                // Or just try to force deep search one last time (blocking).
                if (results.length < 5 && query.length > 3 && !GLOBAL_CLIENT_CACHE) {
                    console.log("[WispHub] Cache missing & API poor results. Waiting for sync...");
                    await this.ensureFullCache();
                    if (GLOBAL_CLIENT_CACHE) {
                        return (GLOBAL_CLIENT_CACHE as WispHubClient[]).filter((client: WispHubClient) => {
                            const clientName = (client.nombre || '').toLowerCase();
                            return searchTerms.every(term => clientName.includes(term));
                        });
                    }
                }
            }

            return results;
        } catch (error) {
            console.error("WispHub Search Error:", error);
            // Emergency fallback
            if (GLOBAL_CLIENT_CACHE) {
                const searchTerms = query.toLowerCase().trim().split(/\s+/);
                return (GLOBAL_CLIENT_CACHE as WispHubClient[]).filter((c: WispHubClient) =>
                    searchTerms.every(t => (c.nombre || '').toLowerCase().includes(t))
                );
            }
            return [];
        }
    },

    async getClientBalance(serviceId: number): Promise<number> {
        if (!API_KEY) return 0;
        try {
            const response = await fetch(`${BASE_URL}/clientes/${serviceId}/saldo/`, {
                headers: { 'Authorization': `Api-Key ${API_KEY}` }
            });
            if (!response.ok) return 0;
            const data = await response.json();
            return data.saldo_total || 0;
        } catch (error) {
            return 0;
        }
    },

    async getInternetPlans(includeDetails: boolean = false): Promise<WispHubPlan[]> {
        if (!API_KEY) return [];

        try {
            let allPlans: WispHubPlan[] = [];
            let nextUrl = `${BASE_URL}/plan-internet/?limit=1000`;

            // 1. Fetch ALL Plans (Pagination Loop)
            while (nextUrl) {
                const response = await fetch(nextUrl, {
                    headers: { 'Authorization': `Api-Key ${API_KEY}` }
                });

                if (!response.ok) break;

                const data = await response.json();
                const results = data.results || [];
                allPlans = [...allPlans, ...results];

                if (data.next) {
                    let nextLink = data.next;
                    if (nextLink.includes('wisphub.io/api')) {
                        nextLink = nextLink.replace(/https:\/\/(api\.)?wisphub\.io\/api/, '/api/wisphub');
                    } else if (nextLink.includes('wisphub.net/api')) {
                        nextLink = nextLink.replace(/https:\/\/(api\.)?wisphub\.net\/api/, '/api/wisphub');
                    }
                    nextUrl = nextLink;
                } else {
                    nextUrl = '';
                }
            }

            if (!includeDetails) {
                return allPlans;
            }

            const detailedPlans = await Promise.all(allPlans.map(async (plan: any) => {
                try {
                    const detailRes = await fetch(`${BASE_URL}/plan-internet/queue/${plan.id}/`, {
                        headers: { 'Authorization': `Api-Key ${API_KEY}` }
                    });
                    if (detailRes.ok) {
                        const detail = await detailRes.json();
                        return {
                            ...plan,
                            precio: parseFloat(detail.precio || '0'),
                            velocidad_bajada: parseInt(detail.bajada || '0'),
                            velocidad_subida: parseInt(detail.subida || '0')
                        };
                    }
                } catch (e) {
                    // ignore
                }
                return plan;
            }));

            return detailedPlans;
        } catch (error) {
            console.error("WispHub Plans Error:", error);
            return [];
        }
    },

    async getPlanDetails(planId: number | string): Promise<any> {
        if (!API_KEY) return null;
        try {
            const detailRes = await fetch(`${BASE_URL}/plan-internet/queue/${planId}/`, {
                headers: { 'Authorization': `Api-Key ${API_KEY}` }
            });
            if (detailRes.ok) {
                const detail = await detailRes.json();
                return {
                    id: planId,
                    nombre: detail.nombre,
                    precio: parseFloat(detail.precio || '0'),
                    velocidad_bajada: parseInt(detail.bajada || '0'),
                    velocidad_subida: parseInt(detail.subida || '0')
                };
            }
        } catch (e) {
            console.error("WispHub Plan Detail Error:", e);
        }
        return null;
    },

    async getTickets(serviceId: number): Promise<any[]> {
        if (!API_KEY) return [];
        try {
            // Filter tickets by service ID
            const url = `${BASE_URL}/tickets/?limit=5&servicio=${serviceId}&ordering=-id`;
            const response = await fetch(url, { headers: { 'Authorization': `Api-Key ${API_KEY}` } });
            if (!response.ok) return [];
            const data = await response.json();
            return data.results || [];
        } catch (error) {
            console.error("WispHub Get Tickets Error:", error);
            return [];
        }
    },

    async createTicket(ticketData: {
        servicio: number;
        asunto: string;
        descripcion: string;
        prioridad: number;
        technicianId?: string;
    }): Promise<any> {
        if (!API_KEY) throw new Error("WispHub API Key not configured");

        try {
            const formData = new FormData();
            formData.append('servicio', ticketData.servicio.toString());
            formData.append('asunto', ticketData.asunto);
            formData.append('asuntos_default', ticketData.asunto);
            formData.append('descripcion', ticketData.descripcion);
            formData.append('prioridad', ticketData.prioridad.toString());
            formData.append('estado', '1');
            formData.append('origen_reporte', 'telefono');
            formData.append('departamento', 'Soporte Técnico');
            formData.append('departamentos_default', 'Soporte Técnico');

            const techId = ticketData.technicianId || DEFAULT_TECH_ID;
            formData.append('tecnico', techId);

            const now = new Date();
            const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            const formatDate = (d: Date) => {
                const dd = d.getDate().toString().padStart(2, '0');
                const mm = (d.getMonth() + 1).toString().padStart(2, '0');
                const yyyy = d.getFullYear();
                const hh = d.getHours().toString().padStart(2, '0');
                const min = d.getMinutes().toString().padStart(2, '0');
                return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
            };

            formData.append('fecha_inicio', formatDate(now));
            formData.append('fecha_final', formatDate(end));

            const response = await fetch(`${BASE_URL}/tickets/`, {
                method: 'POST',
                headers: { 'Authorization': `Api-Key ${API_KEY}` },
                body: formData
            });

            if (response.ok) {
                return { success: true, message: "Ticket creado exitosamente en WispHub" };
            } else {
                const errorText = await response.text();
                return { success: false, message: `Error WispHub (${response.status}): ${errorText.substring(0, 200)}` };
            }
        } catch (error: any) {
            console.error("Ticket Creation Exception:", error);
            return { success: false, message: error.message };
        }
    }
};
