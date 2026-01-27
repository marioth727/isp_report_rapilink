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
    last_result?: string; // Para mostrar errores/éxitos previos
    telefono?: string;    // Propiedad opcional para evitar errores ts(2339)
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
    email?: string;
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
    { id: "asistente.administrativa1@rapilink-sas", nombre: "VALENTINA SUAREZ", usuario: "asistente.administrativa1@rapilink-sas", nivel: "Técnico" },
    { id: "tecnico1@rapilink-sas", nombre: "ALEXANDER GOMEZ", usuario: "tecnico1@rapilink-sas", nivel: "Técnico" },
    { id: "asistente.administravo.3@rapilink-sas", nombre: "VANESSA BARRERA", usuario: "asistente.administravo.3@rapilink-sas", nivel: "Técnico" }
];

let GLOBAL_CLIENT_CACHE: WispHubClient[] | null = null;
let GLOBAL_STAFF_CACHE: WispHubStaff[] | null = null;
let CACHE_PROMISE: Promise<void> | null = null;
let STAFF_PROMISE: Promise<WispHubStaff[]> | null = null;
let SUBJECTS_FETCH_FAILED = false;

export function toProxyUrl(url: string | null): string | null {
    if (!url) return null;
    return url.replace(/https?:\/\/(api\.)?wisphub\.(io|net)\/api\/(v1\/)?/, BASE_URL + '/');
}

export async function safeFetch(url: string, options: RequestInit = {}, retries = 2, silent = false): Promise<Response> {
    const proxyUrl = toProxyUrl(url) || url;
    for (let i = 0; i <= retries; i++) {
        try {
            // Asegurar cabeceras de API si no están presentes
            const finalOptions: RequestInit = {
                ...options,
                headers: {
                    'Accept': 'application/json',
                    ...(options.headers || {})
                }
            };

            const res = await fetch(proxyUrl, finalOptions);
            if (res.ok) return res;

            let errorBody = 'Unable to parse body';
            if (!silent) {
                try {
                    const clonedRes = res.clone();
                    errorBody = await clonedRes.text();
                    console.warn(`[WispHub] Raw error body details: ${errorBody}`);
                } catch (bodyError) {
                    console.warn(`[WispHub] Body capture failed: ${bodyError}`);
                }
            }

            if (!silent) {
                console.error(`[WispHub API ERROR] URL: ${proxyUrl} Status: ${res.status} Attempt: ${i + 1}/${retries + 1}`);
            } else {
                // Debug log to ensure silent mode is working
                // console.log(`[WispHub Silent] 404 on ${proxyUrl}`);
            }

            if (res.status === 404 || res.status === 401 || res.status === 403 || res.status === 400) return res;

        } catch (e) {
            if (!silent) console.error(`[WispHub FETCH EXCEPTION] URL: ${proxyUrl} Error: ${e}`);
        }
        if (i < retries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
    if (!silent) throw new Error(`Failed to fetch ${proxyUrl} after ${retries + 1} attempts`);
    return new Response(null, { status: 500 });
}

export function stripHtml(html: string): string {
    if (!html) return '';
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<p>/gi, '\n')
        .replace(/<\/p>/gi, '')
        .replace(/<[^>]*>?/gm, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
}

export const WisphubService = {
    async getStaff(): Promise<WispHubStaff[]> {
        if (GLOBAL_STAFF_CACHE) return GLOBAL_STAFF_CACHE;
        if (STAFF_PROMISE) return STAFF_PROMISE;

        STAFF_PROMISE = (async () => {
            try {
                const response = await safeFetch(`${BASE_URL}/staff/?limit=1000`);
                if (!response.ok) return FALLBACK_TECHNICIANS;
                const data = await response.json();
                const staff = data.results || data || [];
                const mapped = staff.map((s: any) => ({
                    id: s.id || s.id_usuario,
                    nombre: s.nombre,
                    usuario: s.usuario || s.username || s.email,
                    email: s.email || s.email_usuario || '',
                    nivel: s.nivel || 'Desconocido'
                }));
                GLOBAL_STAFF_CACHE = mapped;
                return mapped;
            } catch (error) {
                console.error('[WisphubService] Staff Fetch Failed:', error);
                return FALLBACK_TECHNICIANS;
            } finally {
                STAFF_PROMISE = null;
            }
        })();
        return STAFF_PROMISE;
    },

    async getInstallations(filters?: { search?: string; tecnico?: string | number; estado?: string; zona?: string }): Promise<any[]> {
        try {
            let url = `${BASE_URL}/instalaciones/?limit=50`;
            if (filters?.search) url += `&search=${encodeURIComponent(filters.search)}`;
            if (filters?.tecnico) url += `&tecnico=${filters.tecnico}`;
            if (filters?.estado) url += `&estado=${filters.estado}`;
            if (filters?.zona) url += `&nombre_zona=${encodeURIComponent(filters.zona)}`;

            const response = await safeFetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            return data.results || [];
        } catch (error) {
            console.error('[WisphubService] Error fetching installations:', error);
            return [];
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
                    const res = await safeFetch(nextUrl);
                    if (!res.ok) break;
                    const data = await res.json();
                    allClients = [...allClients, ...(data.results || [])];
                    nextUrl = toProxyUrl(data.next);
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
            const response = await safeFetch(`${BASE_URL}/plan-internet/?limit=1000`);
            if (!response.ok) return [];
            const data = await response.json();
            return data.results || [];
        } catch (error) {
            return [];
        }
    },

    async getRouters(): Promise<any[]> {
        try {
            // FALLBACK: Usamos /zonas/ como fuente de routers/servidores ya que el endpoint /mikrotiks/ falla
            const response = await safeFetch(`${BASE_URL}/zonas/?limit=1000`);
            if (!response.ok) return [];
            const data = await response.json();
            return (data.results || []).map((z: any) => ({
                id: z.id,
                id_router: z.id,
                nombre: z.nombre,
                // Mapeo adicional por si el frontend espera otros campos
                ip: z.ip_server || '0.0.0.0'
            }));
        } catch (error) {
            return [];
        }
    },

    async getAvailableIps(_routerId: string | number): Promise<string[]> {
        // TODO: Endpoint de IPs no descubierto. Retornamos vacío para evitar errores 404 en consola.
        // Se requiere documentación técnica precisa sobre "ips-disponibles".
        console.warn('[WisphubService] Endpoint de IPs disponibles no encontrado. Retornando lista vacía.');
        return [];
        /* 
        try {
            if (!routerId) return [];
            const response = await safeFetch(`${BASE_URL}/ips-disponibles/?id_router=${routerId}`);
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data) ? data : (data.results || []);
        } catch (error) {
            console.error('[WisphubService] Error fetching available IPs:', error);
            return [];
        }
        */
    },

    async getSectors(): Promise<any[]> {
        try {
            // INTENTO: Usar endpoint de zonas también para sectores o buscar dentro de zonas
            // Por ahora mapeamos zonas como sectores también para que no esté vacío el select
            const response = await safeFetch(`${BASE_URL}/zonas/?limit=1000`);
            if (!response.ok) return [];
            const data = await response.json();
            return (data.results || []).map((z: any) => ({
                id: z.id,
                id_sector: z.id,
                nombre: z.nombre,
                nombre_sector: z.nombre
            }));
        } catch (error) {
            return [];
        }
    },

    async createInstallation(installationData: any): Promise<{ success: boolean; data?: any; message?: string }> {
        try {
            // Validar que tengamos el ID de zona (id_router en nuestro caso representa la zona)
            if (!installationData.id_zona && !installationData.id_router) {
                return { success: false, message: 'ID de zona es obligatorio' };
            }

            const zonaId = installationData.id_zona || installationData.id_router;

            // Mapeo de campos según documentación oficial de WispHub
            const payload = {
                // Datos de conexión (OBLIGATORIOS)
                ip: installationData.ip || '',
                plan_internet: installationData.plan_internet || installationData.id_plan,

                // Datos de hardware
                // FALLBACK: Si no hay MAC, enviar 00:00:00:00:00:00 para pasar validación de API
                mac_cpe: installationData.mac_cpe || installationData.mac || '00:00:00:00:00:00',
                sn_onu: installationData.sn_onu || installationData.sn || '',

                // Datos del cliente
                nombre: installationData.nombre || '',
                apellidos: installationData.apellidos || installationData.apellido || '',
                email: installationData.email || '',
                cedula: installationData.cedula || installationData.dni || '',
                telefono: installationData.telefono || '',
                direccion: installationData.direccion || '',
                localidad: installationData.localidad || installationData.barrio || '',
                ciudad: installationData.ciudad || 'Soledad',

                // Coordenadas GPS
                coordenadas: installationData.coordenadas || (installationData.gps_latitud && installationData.gps_longitud
                    ? `${installationData.gps_latitud},${installationData.gps_longitud}`
                    : ''),

                // Datos de autenticación PPPoE
                // CORRECCIÓN: Usuario RB = Nombre + Apellido (para Simple Queue / PPPoE)
                // Para Cola Simple, la contraseña va vacía.
                usuario_rb: installationData.usuario_rb || `${installationData.nombre || ''} ${installationData.apellidos || installationData.apellido || ''}`.trim(),
                password_rb: installationData.password_rb || '',

                // Datos de instalación
                forma_contratacion: installationData.forma_contratacion || 3, // 3 = Oficina (default)
                costo_instalacion: installationData.costo_instalacion || installationData.costo || '0',
                estado_instalacion: installationData.estado_instalacion || 2, // 2 = En Progreso
                comentarios: installationData.comentarios || installationData.comentario || ''
            };

            console.log('[WispHub] Payload de instalación enviado:', JSON.stringify(payload, null, 2));

            // Endpoint correcto según documentación: /clientes/agregar-cliente/{id_zona}/?instalacion
            const url = `${BASE_URL}/clientes/agregar-cliente/${zonaId}/?instalacion`;
            console.log('[WispHub] URL de instalación:', url);

            const response = await safeFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                console.log('[WispHub] Instalación creada exitosamente:', data);
                return { success: true, data };
            } else {
                let errorDetail = 'Sin detalles';
                try {
                    const errorBody = await response.text();
                    errorDetail = errorBody;
                    console.error('[WispHub] Error HTTP', response.status, ':', errorBody);
                } catch (parseError) {
                    console.error('[WispHub] No se pudo leer el cuerpo del error');
                }
                return {
                    success: false,
                    message: `HTTP ${response.status}: ${errorDetail.substring(0, 200)}`
                };
            }
        } catch (error: any) {
            console.error('[WispHub] Error de red o excepción:', error);
            return { success: false, message: error.message || 'Error desconocido' };
        }
    },

    // Método legacy de createClient - redirigir al método correcto
    async createClient(clientData: any): Promise<{ success: boolean; data?: any; message?: string }> {
        return this.createInstallation(clientData);
    },

    async getInvoices(serviceId: number): Promise<any[]> {
        try {
            const url = `${BASE_URL}/facturas/?id_servicio=${serviceId}&limit=50&ordering=-id`;
            const response = await safeFetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            return data.results || [];
        } catch (error) {
            console.error("[WispHub] Error fetching invoices:", error);
            return [];
        }
    },

    async getTickets(serviceId: number, _clientName?: string, cedula?: string): Promise<any[]> {
        try {
            const currentSId = String(serviceId);
            const targetCedula = String(cedula || "").trim();

            let historicalSIds = new Set<string>([currentSId]);
            try {
                const invoices = await this.getInvoices(serviceId);
                invoices.forEach(inv => {
                    if (inv.servicio?.id_servicio) historicalSIds.add(String(inv.servicio.id_servicio));
                    else if (inv.servicio) historicalSIds.add(String(inv.servicio));
                });
            } catch (e) { /* ignore */ }

            const queries = Array.from(historicalSIds).map(id => `${BASE_URL}/tickets/?search=${id}&limit=50`);
            if (targetCedula.length > 5) {
                queries.push(`${BASE_URL}/tickets/?search=${targetCedula}&limit=50`);
            }

            const results = await Promise.all(
                queries.slice(0, 10).map(url => safeFetch(url).then(res => res.ok ? res.json() : { results: [] }))
            );

            let allFound: any[] = [];
            results.forEach(data => { if (data.results) allFound = [...allFound, ...data.results]; });

            const mapped = allFound.map(t => this.mapTicket(t));
            const uniqueMap = new Map();

            mapped.forEach(t => {
                const isIdMatch = historicalSIds.has(String(t.servicio));
                const isCedulaMatch = targetCedula.length > 5 && targetCedula === String(t.cedula).trim();
                if (isIdMatch || isCedulaMatch) {
                    uniqueMap.set(t.id, t);
                }
            });

            return Array.from(uniqueMap.values()).sort((a: any, b: any) => Number(b.id) - Number(a.id));
        } catch (error) {
            console.error("[WispHub] Error en historial:", error);
            return [];
        }
    },

    async getTicketSubjects(): Promise<string[]> {
        if (SUBJECTS_FETCH_FAILED) return TICKET_SUBJECTS;
        try {
            // Probamos primero sin barra final (más común) y en modo SILENCIOSO
            let response = await safeFetch(`${BASE_URL}/asuntos-tickets`, {
                headers: { 'Accept': 'application/json' }
            }, 0, true);

            // Si falla, probamos con barra final, también silencioso
            if (!response.ok) {
                response = await safeFetch(`${BASE_URL}/asuntos-tickets/`, {
                    headers: { 'Accept': 'application/json' }
                }, 0, true);
            }

            if (!response || !response.ok) {
                SUBJECTS_FETCH_FAILED = true;
                console.info('[WispHub] Usando catálogo de asuntos local (API no disponible).');
                return TICKET_SUBJECTS;
            }

            const data = await response.json();

            // Validar que los datos sean JSON y no una página HTML
            if (typeof data !== 'object' || data === null) {
                console.warn('[WispHub] Subjects API returned non-JSON data, using fallbacks.');
                return TICKET_SUBJECTS;
            }

            const results = data.results || data || [];
            if (!Array.isArray(results) || results.length === 0) return TICKET_SUBJECTS;

            const subjects = Array.from(new Set(results.map((s: any) => s.nombre || s.asunto || s)))
                .filter(Boolean)
                .sort() as string[];

            return subjects.length > 0 ? subjects : TICKET_SUBJECTS;
        } catch (error) {
            return TICKET_SUBJECTS;
        }
    },

    async getAllTickets(filters?: { startDate?: string; endDate?: string; status?: string }, onProgress?: (current: number, total: number) => void): Promise<any[]> {
        try {
            // Asegurar que el staff esté cargado para mapear nombres reales
            await this.getStaff();

            const pageSize = 50;
            let baseUrl = `${BASE_URL}/tickets/?limit=50&offset=0&ordering=-id`;

            if (filters?.startDate || filters?.endDate) {
                const start = filters.startDate || '2024-01-01';
                const end = filters.endDate || new Date().toISOString().split('T')[0];
                baseUrl += `&fecha_creacion_0=${start}&fecha_creacion_1=${end}`;
            } else {
                const past = new Date();
                past.setDate(past.getDate() - 30);
                const start = past.toISOString().split('T')[0];
                const end = new Date().toISOString().split('T')[0];
                baseUrl += `&fecha_creacion_0=${start}&fecha_creacion_1=${end}`;
            }

            if (filters?.status) baseUrl += `&id_estado=${filters.status}`;

            console.log(`[REQUEST] URL: ${baseUrl}`);
            const firstResponse = await safeFetch(baseUrl);
            console.log(`[RESPONSE] Status: ${firstResponse.status} for URL: ${baseUrl}`);

            if (!firstResponse.ok) return [];

            const firstData = await firstResponse.json();
            const totalCount = firstData.count || 0;
            const uniqueTicketsMap = new Map<string, any>();

            // Procesar primera página
            (firstData.results || []).forEach((t: any) => {
                const mapped = this.mapTicket(t);
                // Filtrar localmente si se solicitó un estado
                if (!filters?.status || String(mapped.id_estado) === String(filters.status)) {
                    uniqueTicketsMap.set(mapped.id, mapped);
                }
            });

            if (onProgress) onProgress(uniqueTicketsMap.size, totalCount);

            // Si ya tenemos suficientes o no hay más qué pedir
            if (uniqueTicketsMap.size >= totalCount || uniqueTicketsMap.size >= 1000) return Array.from(uniqueTicketsMap.values());

            const remainingOffsets = [];
            for (let offset = pageSize; offset < totalCount && offset < 1000; offset += pageSize) {
                remainingOffsets.push(offset);
            }

            for (const offset of remainingOffsets) {
                const pageUrl = baseUrl.replace('offset=0', `offset=${offset}`);
                const response = await safeFetch(pageUrl);
                if (response.ok) {
                    const data = await response.json();
                    console.log(`[RESPONSE] Offset ${offset} - Total Page Results: ${data.results?.length || 0}`);

                    (data.results || []).forEach((t: any) => {
                        const mapped = this.mapTicket(t);
                        // Filtrar localmente por estado y evitar duplicados
                        if (!filters?.status || String(mapped.id_estado) === String(filters.status)) {
                            uniqueTicketsMap.set(mapped.id, mapped);
                        }
                    });

                    if (onProgress) onProgress(uniqueTicketsMap.size, totalCount);
                }
                await new Promise(r => setTimeout(r, 200));

                // Limite de seguridad de 1000 tickets por estado
                if (uniqueTicketsMap.size >= 1000) break;
            }

            const finalResults = Array.from(uniqueTicketsMap.values());
            console.log(`[SUCCESS] WisphubService.getAllTickets finalizó con ${finalResults.length} tickets mapeados (Deduplicados y Filtrados).`);
            return finalResults;
        } catch (error) {
            console.error("[WispHub] Error loading all tickets:", error);
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

        let finalClientName = t.nombre_cliente || t.cliente_nombre || "";
        let finalCedula = "";

        // Intentar extraer de objetos anidados (cliente o servicio)
        const possibleClient = t.cliente || t.servicio;
        if (possibleClient && typeof possibleClient === 'object') {
            finalClientName = finalClientName || possibleClient.nombre || possibleClient.client_name || possibleClient.nombre_cliente || "";
            finalCedula = possibleClient.cedula || "";
        }

        // Si sigue vacío, poner fallback
        if (!finalClientName) finalClientName = "Cliente Desconocido";

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

        const statusText = String(t.estado || t.nombre_estado || 'Nuevo');
        let finalNombreEstado = statusText;
        let finalIdEstado = Number(t.id_estado);

        if (isNaN(finalIdEstado)) {
            const lowerStatus = statusText.toLowerCase();
            if (lowerStatus.includes('cerrado')) {
                finalIdEstado = 4;
                finalNombreEstado = 'Cerrado';
            } else if (lowerStatus.includes('resuelto')) {
                finalIdEstado = 3;
                finalNombreEstado = 'Resuelto';
            } else if (lowerStatus.includes('progreso') || lowerStatus.includes('espera')) {
                finalIdEstado = 2;
                finalNombreEstado = 'En Progreso';
            } else {
                finalIdEstado = 1;
                finalNombreEstado = 'Abierto';
            }
        } else {
            if (finalIdEstado === 4) finalNombreEstado = 'Cerrado';
            else if (finalIdEstado === 3) finalNombreEstado = 'Resuelto';
            else if (finalIdEstado === 2) finalNombreEstado = 'En Progreso';
            else if (finalIdEstado === 1) finalNombreEstado = 'Abierto';
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
            nombre_tecnico: (() => {
                const techIdentifier = String(t.tecnico && typeof t.tecnico === 'object' ? (t.tecnico.usuario || t.tecnico.username || t.tecnico.email || t.tecnico.nombre) : t.tecnico || t.nombre_tecnico || "").toLowerCase().trim();
                const techIdStr = String(t.tecnico_id || (t.tecnico && typeof t.tecnico === 'object' ? (t.tecnico.id || t.tecnico.id_usuario) : "")).trim();

                let finalName = t.nombre_tecnico || (t.tecnico && typeof t.tecnico === 'object' ? t.tecnico.nombre : null) || "Sin asignar";

                if (GLOBAL_STAFF_CACHE) {
                    const found = GLOBAL_STAFF_CACHE.find(s =>
                        (s.usuario && s.usuario.toLowerCase() === techIdentifier) ||
                        (s.email && s.email.toLowerCase() === techIdentifier) ||
                        (String(s.id) === techIdStr && techIdStr !== "") ||
                        (s.nombre && s.nombre.toLowerCase() === techIdentifier)
                    );
                    if (found) finalName = found.nombre;
                }
                return finalName;
            })(),
            tecnico_id: t.tecnico_id || (t.tecnico && typeof t.tecnico === 'object' ? (t.tecnico.id || t.tecnico.id_usuario) : null),
            tecnico_usuario: t.tecnico_usuario || (t.tecnico && typeof t.tecnico === 'object' ? (t.tecnico.usuario || t.tecnico.username) : null),
            email_tecnico: t.email_tecnico || (t.tecnico && typeof t.tecnico === 'object' ? t.tecnico.email : null),
            horas_abierto: diffHours,
            sla_status: diffHours > 48 ? 'critico' : diffHours > 24 ? 'amarillo' : 'verde',
            fecha_creacion: t.fecha_creacion || t.created_at || t.fecha,
            creado_por: t.creado_por || t.created_by || null,
            descripcion: t.descripcion || ''
        };
    },

    async getTicketDetail(id: string | number): Promise<any> {
        const raw = await this.getTicketRaw(id);
        return raw ? this.mapTicket(raw) : null;
    },

    async getTicketRaw(id: string | number): Promise<any> {
        try {
            const response = await safeFetch(`${BASE_URL}/tickets/${id}/`);
            return response.ok ? await response.json() : null;
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
            const response = await safeFetch(`${BASE_URL}/clientes/${serviceId}/saldo/`);
            let saldo = 0;
            if (response.ok) {
                const data = await response.json();
                saldo = Number(data.saldo || 0);
            }
            return saldo;
        } catch (e) {
            return 0;
        }
    },

    async getTicketComments(ticketId: string | number): Promise<any[]> {
        try {
            const response = await safeFetch(`${BASE_URL}/tickets/comentarios/?ticket=${ticketId}`);
            if (!response.ok) return [];
            const data = await response.json();
            return data.results || data || [];
        } catch (e) {
            return [];
        }
    },

    async addTicketComment(ticketId: string | number, comment: string, file?: File | Blob): Promise<boolean> {
        try {
            const formData = new FormData();
            formData.append('ticket', String(ticketId));
            formData.append('comentario', comment);
            if (file) formData.append('archivo', file);
            const response = await safeFetch(`${BASE_URL}/tickets/comentarios/`, {
                method: 'POST',
                body: formData
            });
            return response.ok;
        } catch (e) {
            return false;
        }
    },

    async updateTicket(ticketId: string | number, data: any, method: 'PATCH' | 'PUT' = 'PATCH'): Promise<boolean> {
        try {
            let payload = data;
            const hasFile = data.archivo_ticket instanceof File || data.archivo_ticket instanceof Blob;
            if (!data.asunto && !data.servicio && !hasFile) {
                payload = {
                    tecnico: data.tecnico,
                    email_tecnico: data.email_tecnico,
                    estado: data.estado,
                    prioridad: data.prioridad,
                    descripcion: data.descripcion ? stripHtml(data.descripcion) : undefined
                };
            }
            const response = await safeFetch(`${BASE_URL}/tickets/${ticketId}/`, {
                method: method,
                headers: hasFile ? {} : { 'Content-Type': 'application/json' },
                body: hasFile ? (() => {
                    const fd = new FormData();
                    Object.keys(payload).forEach(k => fd.append(k, payload[k]));
                    return fd;
                })() : JSON.stringify(payload)
            });
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
        file?: File | Blob;
    }): Promise<any> {
        try {
            // 1. Resolver ID numérico del técnico (WispHub lo exige en POST/PUT)
            let finalTechId: string | number = ticketData.technicianId || 'admin@rapilink-sas';

            try {
                const staff = await this.getStaff();
                const found = staff.find(s =>
                    s.usuario === ticketData.technicianId ||
                    s.email === ticketData.technicianId ||
                    s.id === ticketData.technicianId
                );
                if (found && found.id) {
                    finalTechId = found.id;
                }
            } catch (staffErr) {
                console.warn("[WispHub] No se pudo resolver ID numérico, usando fallback:", staffErr);
            }

            // 2. Safe Subject Logic (WispHub is strict with catalogs)
            const staffSubjects = await this.getTicketSubjects();
            const originalSubject = ticketData.asunto;
            const isAsuntoValid = staffSubjects.some(s => s.toLowerCase() === originalSubject.toLowerCase());
            const safeSubject = isAsuntoValid ? originalSubject : (staffSubjects[0] || "Internet Lento");

            const payload: any = {
                servicio: ticketData.servicio,
                asunto: `CRM - Report - ${originalSubject}`,
                asuntos_default: safeSubject,
                descripcion: ticketData.descripcion,
                prioridad: ticketData.prioridad.toString(),
                estado: '1',
                tecnico: finalTechId,
                departamento: 'Soporte Técnico',
                departamentos_default: 'Soporte Técnico'
            };

            if (ticketData.file) {
                payload.archivo_ticket = ticketData.file;
            }

            console.log("[WispHub REQUEST] Create Ticket Payload:", { ...payload, archivo_ticket: payload.archivo_ticket ? 'File attached' : 'No file' });

            const hasFile = !!ticketData.file;
            const response = await safeFetch(`${BASE_URL}/tickets/`, {
                method: 'POST',
                headers: hasFile ? {} : { 'Content-Type': 'application/json' },
                body: hasFile ? (() => {
                    const fd = new FormData();
                    Object.keys(payload).forEach(k => {
                        if (payload[k] !== undefined && payload[k] !== null) {
                            fd.append(k, payload[k]);
                        }
                    });
                    return fd;
                })() : JSON.stringify(payload)
            });

            if (response.ok) {
                return { success: true };
            } else {
                const errorText = await response.text();
                console.error("[WispHub API ERROR Response]", errorText);
                return { success: false, message: errorText };
            }
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    },

    async getAllRecentTickets(limit: number = 1000, daysBack: number = 60): Promise<any[]> {
        try {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - daysBack);
            const start = pastDate.toISOString().split('T')[0];
            const end = new Date().toISOString().split('T')[0];
            const url = `${BASE_URL}/tickets/?limit=${limit}&ordering=-id&fecha_creacion_0=${start}&fecha_creacion_1=${end}`;
            const response = await safeFetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            return (data.results || []).map((t: any) => this.mapTicket(t));
        } catch (error) {
            return [];
        }
    },

    async getMyTickets(limit: number = 100, daysBack: number = 0, tecnico?: string): Promise<any[]> {
        try {
            let dateParams = '';
            if (daysBack > 0) {
                const pastDate = new Date();
                pastDate.setDate(pastDate.getDate() - daysBack);
                const start = pastDate.toISOString().split('T')[0];
                const end = new Date().toISOString().split('T')[0];
                dateParams = `&fecha_creacion_0=${start}&fecha_creacion_1=${end}`;
            }
            const tecnicoParam = tecnico ? `&tecnico=${encodeURIComponent(tecnico)}` : '&mis_tickets=true';
            const url = `${BASE_URL}/tickets/?limit=${limit}&ordering=-id${tecnicoParam}${dateParams}`;
            const response = await safeFetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            return (data.results || []).map((t: any) => this.mapTicket(t));
        } catch (error) {
            return [];
        }
    },

    async getTicketsByTechnician(technicianId: number | string, page: number = 1): Promise<any[]> {
        try {
            const limit = 100;
            const offset = (page - 1) * limit;
            const url = `${BASE_URL}/tickets/?tecnico=${technicianId}&limit=${limit}&offset=${offset}&ordering=-id`;
            const response = await safeFetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            return (data.results || []).map((t: any) => this.mapTicket(t));
        } catch (error) {
            return [];
        }
    },

    async getAllTicketsPage(page: number = 1, filters?: { startDate?: string; endDate?: string; tecnico?: string | number; status?: string | number }): Promise<{ results: any[], count: number }> {
        try {
            const limit = 50;
            const offset = (page - 1) * limit;
            let url = `${BASE_URL}/tickets/?limit=${limit}&offset=${offset}&ordering=-id`;

            if (filters?.startDate && filters?.endDate) {
                url += `&fecha_creacion_0=${filters.startDate}&fecha_creacion_1=${filters.endDate}`;
            }
            if (filters?.tecnico) {
                url += `&tecnico=${filters.tecnico}`;
            }
            if (filters?.status) {
                url += `&id_estado=${filters.status}`;
            }

            const response = await safeFetch(url);
            if (!response.ok) return { results: [], count: 0 };
            const data = await response.json();
            return { results: (data.results || []).map((t: any) => this.mapTicket(t)), count: data.count || 0 };
        } catch (error) {
            return { results: [], count: 0 };
        }
    },

    async getAllTicketsPaginated(maxPages: number = 30, daysBack: number = 60): Promise<any[]> {
        // ... (existing implementation)
        const allTickets: any[] = [];
        let dateParams = '';
        if (daysBack > 0) {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - daysBack);
            const start = pastDate.toISOString().split('T')[0];
            const end = new Date().toISOString().split('T')[0];
            dateParams = `&fecha_creacion_0=${start}&fecha_creacion_1=${end}`;
        }

        let nextUrl: string | null = `${BASE_URL}/tickets/?limit=100&ordering=-id${dateParams}`;
        let pages = 0;

        try {
            while (nextUrl && pages < maxPages) {
                const response = await safeFetch(nextUrl);
                if (!response.ok) break;
                const data = await response.json();
                allTickets.push(...(data.results || []).map((t: any) => this.mapTicket(t)));
                nextUrl = toProxyUrl(data.next);
                pages++;
            }
            return allTickets;
        } catch (e) {
            return allTickets;
        }
    },

    async uploadClientEvidence(clientId: string | number, file: Blob, description: string): Promise<boolean> {
        try {
            const formData = new FormData();
            formData.append('id_servicio', String(clientId));
            formData.append('archivo', file, `${description.replace(/\s+/g, '_')}.jpg`);
            formData.append('descripcion', description);

            console.log(`[WispHub] Uploading evidence: ${description} for client ${clientId}`);

            // INTENTO 1: Endpoint de adjuntos/archivos (Probaremos rutas estándar)
            // Ruta A: /clientes/archivos/ (General)
            const response = await safeFetch(`${BASE_URL}/clientes/archivos/`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) return true;

            // INTENTO 2: Ruta B: /clientes/{id}/adjuntos/ (Específica)
            const response2 = await safeFetch(`${BASE_URL}/clientes/${clientId}/adjuntos/`, {
                method: 'POST',
                body: formData
            });

            return response2.ok;
        } catch (e) {
            console.error('[WispHub] Error uploading evidence:', e);
            return false;
        }
    }
};
