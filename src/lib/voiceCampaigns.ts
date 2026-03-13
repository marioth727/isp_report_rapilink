import { supabase } from './supabase';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface VoiceCampaign {
    id: string;
    nombre: string;
    descripcion?: string;
    estado: 'borrador' | 'revision' | 'activa' | 'pausada' | 'completada';
    total_clientes: number;
    llamadas_completadas: number;
    llamadas_aceptaron: number;
    llamadas_rechazaron: number;
    llamadas_reintento: number;
    llamadas_escaladas: number;
    aprobado_por?: string;
    aprobado_at?: string;
    creado_por?: string;
    created_at: string;
    updated_at: string;
}

export interface VoiceCampaignClient {
    id: string;
    campana_id: string;
    id_cliente_wisphub: string;
    nombre: string;
    telefono: string;
    plan_actual?: string;
    velocidad_actual?: number;
    precio_actual?: number;
    categoria?: 'A' | 'B' | 'C' | 'D';
    plan_upsell?: string;
    precio_upsell?: number;
    velocidad_upsell?: number;
    plan_downsell?: string;
    precio_downsell?: number;
    velocidad_downsell?: number;
    estado: 'pendiente' | 'en_llamada' | 'completado' | 'error';
    call_id_retell?: string;
    created_at: string;
}

export interface VoiceCall {
    id: string;
    campana_id?: string;
    cliente_id?: string;
    id_cliente_wisphub: string;
    call_id_retell?: string;
    estado: 'iniciada' | 'en_curso' | 'completada' | 'fallida';
    resultado?: 'acepto' | 'rechazo' | 'reintento' | 'escalado' | 'no_contesto' | 'buzon';
    plan_aceptado?: string;
    precio_aceptado?: number;
    motivo_rechazo?: string;
    fecha_reintento?: string;
    hora_reintento?: string;
    duracion_segundos?: number;
    transcript?: string;
    recording_url?: string;
    retell_call_analysis?: Record<string, any>;
    iniciada_at: string;
    finalizada_at?: string;
    created_at: string;
}

export interface CampaignStats {
    tasa_conversion: number;
    tasa_rechazo: number;
    duracion_promedio: number;
    pendientes: number;
}

// ─────────────────────────────────────────────
// HELPERS — Cálculo de variables de texto
// ─────────────────────────────────────────────

function numeroATexto(n: number): string {
    const unidades = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
        'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

    if (n === 0) return 'cero';
    if (n < 0) return 'menos ' + numeroATexto(-n);
    if (n < 20) return unidades[n];
    if (n === 100) return 'cien';
    if (n < 100) {
        const d = Math.floor(n / 10);
        const u = n % 10;
        return decenas[d] + (u ? ' y ' + unidades[u] : '');
    }
    if (n < 1000) {
        const c = Math.floor(n / 100);
        const resto = n % 100;
        return centenas[c] + (resto ? ' ' + numeroATexto(resto) : '');
    }
    if (n < 1000000) {
        const miles = Math.floor(n / 1000);
        const resto = n % 1000;
        return (miles === 1 ? 'mil' : numeroATexto(miles) + ' mil') + (resto ? ' ' + numeroATexto(resto) : '');
    }
    return n.toString();
}

export function calcularVariablesTxt(client: Partial<VoiceCampaignClient>): Record<string, string> {
    const vel_actual = client.velocidad_actual || 1;
    const precio_upsell = client.precio_upsell || 89900;
    const precio_downsell = client.precio_downsell || 69900;
    const vel_upsell = client.velocidad_upsell || 200;
    const vel_downsell = client.velocidad_downsell || 100;

    const diario_upsell = Math.round(precio_upsell / 30);
    const diario_downsell = Math.round(precio_downsell / 30);
    const veces_upsell = Math.round(vel_upsell / vel_actual);
    const veces_downsell = Math.round(vel_downsell / vel_actual);

    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const fecha_activacion = `el primero de ${meses[primerDia.getMonth()]}`;

    const formatVeces = (v: number) => {
        if (v === 2) return 'el doble';
        if (v === 3) return 'el triple';
        return `${numeroATexto(v)} veces más rápido`;
    };

    return {
        precio_upsell_txt: `${numeroATexto(precio_upsell)} pesos`,
        precio_downsell_txt: `${numeroATexto(precio_downsell)} pesos`,
        velocidad_upsell_txt: vel_upsell >= 1000 ? 'un gigabyte' : `${numeroATexto(vel_upsell)} megas`,
        velocidad_downsell_txt: vel_downsell >= 1000 ? 'un gigabyte' : `${numeroATexto(vel_downsell)} megas`,
        diario_upsell_txt: `${numeroATexto(diario_upsell)} pesos`,
        diario_downsell_txt: `${numeroATexto(diario_downsell)} pesos`,
        veces_upsell_txt: formatVeces(veces_upsell),
        veces_downsell_txt: formatVeces(veces_downsell),
        fecha_activacion,
    };
}

// ─────────────────────────────────────────────
// CATEGORIZACIÓN DE CLIENTES
// ─────────────────────────────────────────────



export function categorizarCliente(precio_actual: number): {
    categoria: 'A' | 'B' | 'C' | 'D';
    plan_upsell: string;
    precio_upsell: number;
    velocidad_upsell: number;
    plan_downsell: string;
    precio_downsell: number;
    velocidad_downsell: number;
} {
    // Categoría A: paga $69,900 ya — upgrade gratis o similar
    if (precio_actual >= 65000 && precio_actual <= 75000) {
        return { categoria: 'A', plan_upsell: 'FAMILIA', precio_upsell: 89900, velocidad_upsell: 200, plan_downsell: 'HOGAR', precio_downsell: 69900, velocidad_downsell: 100 };
    }
    // Categoría B: paga ~$99,900 — migración con ahorro
    if (precio_actual >= 90000 && precio_actual <= 110000) {
        return { categoria: 'B', plan_upsell: 'ULTRA', precio_upsell: 159900, velocidad_upsell: 500, plan_downsell: 'FAMILIA', precio_downsell: 89900, velocidad_downsell: 200 };
    }
    // Categoría C: paga menos de $65,000 — aumenta el precio
    if (precio_actual < 65000 && precio_actual > 0) {
        return { categoria: 'C', plan_upsell: 'FAMILIA', precio_upsell: 89900, velocidad_upsell: 200, plan_downsell: 'HOGAR', precio_downsell: 69900, velocidad_downsell: 100 };
    }
    // Categoría D: planes obsoletos (precio muy bajo o muy alto sin categoría)
    return { categoria: 'D', plan_upsell: 'FAMILIA', precio_upsell: 89900, velocidad_upsell: 200, plan_downsell: 'HOGAR', precio_downsell: 69900, velocidad_downsell: 100 };
}

// ─────────────────────────────────────────────
// VOICE CAMPAIGNS SERVICE
// ─────────────────────────────────────────────

export const VoiceCampaignService = {
    // Listar campañas
    async getCampaigns(): Promise<VoiceCampaign[]> {
        const { data, error } = await supabase
            .from('voice_campaigns')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    // Crear campaña
    async createCampaign(nombre: string, descripcion?: string): Promise<VoiceCampaign> {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('voice_campaigns')
            .insert({ nombre, descripcion, creado_por: user?.id })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Agregar clientes a campaña
    async addClients(campana_id: string, clients: Omit<VoiceCampaignClient, 'id' | 'created_at' | 'estado'>[]): Promise<void> {
        const { error } = await supabase
            .from('voice_campaign_clients')
            .insert(clients.map(c => ({ ...c, campana_id, estado: 'pendiente' })));
        if (error) throw error;

        // actualizar contador
        await supabase
            .from('voice_campaigns')
            .update({ total_clientes: clients.length })
            .eq('id', campana_id);
    },

    // Obtener clientes de una campaña
    async getCampaignClients(campana_id: string): Promise<VoiceCampaignClient[]> {
        const { data, error } = await supabase
            .from('voice_campaign_clients')
            .select('*')
            .eq('campana_id', campana_id)
            .order('created_at');
        if (error) throw error;
        return data || [];
    },

    // Enviar campaña a revisión
    async submitForReview(campana_id: string): Promise<void> {
        const { error } = await supabase
            .from('voice_campaigns')
            .update({ estado: 'revision' })
            .eq('id', campana_id);
        if (error) throw error;
    },

    // Aprobar campaña e iniciar llamadas vía n8n
    async approveCampaign(campana_id: string, n8n_webhook_url: string, max_simultaneas: number = 1): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Marcar como activa
        const { error } = await supabase
            .from('voice_campaigns')
            .update({ estado: 'activa', aprobado_por: user?.id, aprobado_at: new Date().toISOString() })
            .eq('id', campana_id);
        if (error) throw error;

        // 2. Disparar n8n webhook
        const response = await fetch(n8n_webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campana_id, max_simultaneas }),
        });

        if (!response.ok) {
            throw new Error(`n8n webhook error: ${response.status}`);
        }
    },

    // Obtener llamadas de una campaña
    async getCampaignCalls(campana_id: string): Promise<VoiceCall[]> {
        const { data, error } = await supabase
            .from('voice_calls')
            .select('*')
            .eq('campana_id', campana_id)
            .order('iniciada_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    // Stats de una campaña
    async getCampaignStats(campaign: VoiceCampaign): Promise<CampaignStats> {
        const completadas = campaign.llamadas_completadas || 1;
        return {
            tasa_conversion: Math.round((campaign.llamadas_aceptaron / completadas) * 100),
            tasa_rechazo: Math.round((campaign.llamadas_rechazaron / completadas) * 100),
            duracion_promedio: 0, // se calcula desde voice_calls
            pendientes: campaign.total_clientes - campaign.llamadas_completadas,
        };
    },

    // Pausar campaña
    async pauseCampaign(campana_id: string): Promise<void> {
        const { error } = await supabase
            .from('voice_campaigns')
            .update({ estado: 'pausada' })
            .eq('id', campana_id);
        if (error) throw error;
    },

    // Eliminar campaña y sus clientes asociados
    async deleteCampaign(campana_id: string): Promise<void> {
        // Primero eliminar clientes para evitar errores de FK (aunque ON DELETE CASCADE debería manejarlo)
        const { error: errorClients } = await supabase
            .from('voice_campaign_clients')
            .delete()
            .eq('campana_id', campana_id);
        if (errorClients) throw errorClients;

        const { error } = await supabase
            .from('voice_campaigns')
            .delete()
            .eq('id', campana_id);
        if (error) throw error;
    },

    // Archivar campaña (marcar como completada)
    async archiveCampaign(campana_id: string): Promise<void> {
        const { error } = await supabase
            .from('voice_campaigns')
            .update({ estado: 'completada' })
            .eq('id', campana_id);
        if (error) throw error;
    },

    // Obtener resumen de resultados por cliente (para filtros de exclusión)
    async getCallsSummary(): Promise<Record<string, { resultado: string; fecha: string }>> {
        const { data, error } = await supabase
            .from('voice_calls')
            .select('id_cliente_wisphub, resultado, iniciada_at')
            .order('iniciada_at', { ascending: false });

        if (error) throw error;

        const summary: Record<string, { resultado: string; fecha: string }> = {};
        data?.forEach(call => {
            if (!summary[call.id_cliente_wisphub]) {
                summary[call.id_cliente_wisphub] = {
                    resultado: call.resultado,
                    fecha: call.iniciada_at,
                };
            }
        });
        return summary;
    },
};
