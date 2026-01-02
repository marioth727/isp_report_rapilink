
export interface DailyReport {
    id?: string;
    user_id?: string;
    date: string;
    metrics: {
        contacts: {
            made: number;
            effective: number;
            no_answer: number;
            switched_off: number;
            wrong_number: number;
            hung_up: number;
        };
        conversion: {
            accepted: number;
            rejected: number;
        };
        alerts: {
            churn_rate: number;
            complaints: number;
            escalations: number;
        };
    };
    categories_results: CategoryResult[];
    objections: Objection[];
    special_cases: SpecialCase[];
    observations: string;
    performance_score?: 'VERDE' | 'AMARILLO' | 'ROJO';
    created_at?: string;
}

export interface CategoryResult {
    category_name: string;
    goal: number;
    contacted: number;
    accepted: number;
    rejected: number;
    switched_off: number;
    wrong_number: number;
    hung_up: number;
    thinking: number;
    no_answer: number;
}

export interface Objection {
    objection: string;
    custom_reason?: string;
    count: number;
}

export interface SpecialCase {
    description: string;
    account_number?: string;
}

export interface CRMInteraction {
    id?: string;
    user_id?: string;
    client_id?: number; // WispHub Service ID (Numeric)
    scheduled_followup?: string; // ISO Date for callback scheduling
    client_reference: string;
    current_plan?: string;
    migration_category?: string;
    duration_min?: number;
    result: 'Aceptó Migración' | 'Lo pensará' | 'Rechazó (Mantiene)' | 'Rechazó (Cancelación)' | 'No contesta' | 'Equivocado' | 'Cuelgan' | 'Falla Técnica';
    objection?: string;
    suggested_plan?: string;
    price_difference?: number;
    technician_schedule?: string;
    technician_required?: boolean;
    is_special_case?: boolean;
    special_case_description?: string;
    special_case_number?: string;
    nps?: number;
    created_at?: string;
}

export const PLAN_OPTIONS = [
    "HOGAR - 100MB",
    "FAMILIA - 200MB",
    "ULTRA - 500MB",
    "ELITE - 700MB"
];

export const REPORT_CATEGORIES = [
    "Upgrade Gratis",
    "Migración con Ahorro",
    "Migración con Aumento",
    "Obsoletos",
    "Suspendidos"
];

export const PREDEFINED_OBJECTIONS = [
    "Es muy caro, no puedo pagar más",
    "Mi internet actual funciona bien",
    "No uso tanto internet",
    "Déjame pensarlo / consultarlo",
    "Ya me voy a cambiar de empresa",
    "Tengo deudas pendientes",
    "No tengo tiempo para cambios / instalaciones",
    "Quiero hablar con un supervisor",
    "Otros vecinos tienen problemas con ustedes",
    "Me ofrecieron más barato en otra empresa",
    "No me avisaron de este cambio",
    "Antes me dijeron otra cosa"
];

export interface PipelineStage {
    id: string;
    user_id: string;
    name: string;
    order_index: number;
    color?: string;
    created_at?: string;
}

export interface PipelineDeal {
    id: string;
    user_id: string;
    client_id: number;
    client_name: string;
    cedula?: string;
    phone?: string;
    current_plan?: string;
    last_result?: string;
    stage_id: string;
    suggested_plan?: string;
    last_interaction_id?: string;
    created_at?: string;
    updated_at?: string;
}
