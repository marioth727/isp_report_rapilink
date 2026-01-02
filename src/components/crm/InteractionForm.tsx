import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { useState, useEffect } from 'react';
import { Save, User, Phone, Clock, DollarSign, AlertCircle, Wrench, BookOpen, Search, Loader2, Play, Square, AlertTriangle } from 'lucide-react';
import type { CRMInteraction } from '../../types';
import { PREDEFINED_OBJECTIONS, REPORT_CATEGORIES, PLAN_OPTIONS } from '../../types';
import clsx from 'clsx';
import { ScriptViewer } from './ScriptViewer';
import { Modal } from '../ui/Modal';
import { WisphubService, type WispHubClient, type WispHubPlan, type WispHubStaff, TICKET_SUBJECTS } from '../../lib/wisphub';

interface InteractionFormProps {
    onSuccess: () => void;
    initialValues?: CRMInteraction | null;
    preSelectedClient?: WispHubClient | null;
    previousInteraction?: CRMInteraction | null;
}

// Fallback precios manuales si la API falla (Plan B)
const PLAN_PRICES_FALLBACK: Record<string, number> = {
    'ELITE': 199900,
    'ULTRA': 80000,
    'FAMILIA': 60000,
    'HOGAR': 69900,
    'INTERNET 100MB FO': 55000
};

// Helper to get robust price from WispHub plan
const getPlanPrice = (plan: any) => {
    // 1. Try API fields
    let p = plan.precio || plan.Precio || plan.costo || plan.mensualidad || 0;
    p = Number(p);

    // 2. Fallback: Search by name similarity if API returned 0
    if (p === 0 && plan.nombre) {
        const name = plan.nombre.toUpperCase();
        for (const [key, price] of Object.entries(PLAN_PRICES_FALLBACK)) {
            if (name.includes(key)) {
                return price;
            }
        }
    }
    return p;
};

export function InteractionForm({ onSuccess, initialValues, preSelectedClient, previousInteraction }: InteractionFormProps) {
    const [saving, setSaving] = useState(false);
    const [showMobileScripts, setShowMobileScripts] = useState(false);

    // WispHub Search State
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<WispHubClient[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [balanceAlert, setBalanceAlert] = useState<number | null>(null);

    // Dynamic Plans & Upsell Logic
    const [wispHubPlans, setWispHubPlans] = useState<WispHubPlan[]>([]);
    const [offeredPlans, setOfferedPlans] = useState<any[]>([]); // Plans from Config/Ajustes
    const [currentPlanPrice, setCurrentPlanPrice] = useState<number>(0);
    const [currentPlanDetails, setCurrentPlanDetails] = useState<any>(null); // Full details for ROI
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

    // Technicians List
    const [technicians, setTechnicians] = useState<WispHubStaff[]>([]);

    // Ticket Context Logic
    const [recentTickets, setRecentTickets] = useState<any[]>([]);

    // Call Timer State
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [isManualDuration, setIsManualDuration] = useState(false);

    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CRMInteraction>({
        defaultValues: {
            result: 'No contesta',
            duration_min: 1,
            is_special_case: false,
            technician_required: false
        }
    });

    const suggestedPlanName = watch('suggested_plan');

    // Calculate Upsell when Suggested Plan changes
    useEffect(() => {
        if (!suggestedPlanName || offeredPlans.length === 0) {
            if (!suggestedPlanName) setValue('price_difference', 0);
            return;
        }

        const newPlan = offeredPlans.find(p => p.name === suggestedPlanName);
        if (newPlan) {
            const newPrice = Number(newPlan.price);
            const diff = newPrice - (currentPlanPrice || 0);
            setValue('price_difference', diff > 0 ? diff : 0);
        }
    }, [suggestedPlanName, currentPlanPrice, offeredPlans, setValue]);

    // Timer Logic
    useEffect(() => {
        let interval: any;
        if (isTimerRunning) {
            interval = setInterval(() => {
                setTimerSeconds(s => {
                    const newSeconds = s + 1;
                    // Sync with form (minutes with 2 decimals)
                    const minutes = parseFloat((newSeconds / 60).toFixed(2));
                    setValue('duration_min', minutes);
                    return newSeconds;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, setValue]);

    const toggleTimer = () => {
        if (isTimerRunning) {
            // Stopping
            if (confirm("¿Detener el cronómetro de la llamada?")) {
                setIsTimerRunning(false);
                setIsManualDuration(false); // Validated by system
            }
        } else {
            // Starting
            setIsTimerRunning(true);
            setIsManualDuration(false);
        }
    };

    const handleManualDurationChange = () => {
        setIsTimerRunning(false); // Auto-stop timer
        setIsManualDuration(true); // Mark as manual
    };

    // Format seconds to MM:SS for display
    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };


    // Reset/Populate form when initialValues changes & Load Plans from WispHub
    useEffect(() => {
        const loadData = async () => {
            // Fetch plans list FAST (without details)
            const plans = await WisphubService.getInternetPlans(false);
            if (plans.length > 0) {
                setWispHubPlans(plans);
            }

            // Load Config (Offered Plans)
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data } = await supabase
                        .from('crm_config')
                        .select('plan_prices')
                        .eq('user_id', user.id)
                        .single();

                    if (data?.plan_prices) {
                        setOfferedPlans(data.plan_prices);
                    }
                }
            } catch (error) {
                console.error("Error loading config plans:", error);
            }

            // Load Technicians
            try {
                const techs = await WisphubService.getStaff();
                console.log('[WispHub] Loaded technicians:', techs); // Log to see IDs
                setTechnicians(techs);
            } catch (error) {
                console.error("Error loading technicians from WispHub:", error);
                setTechnicians([]); // Ensure technicians is an empty array on error
            }
        };
        loadData();
    }, [setValue]);

    useEffect(() => {
        if (initialValues) {
            reset(initialValues);
        } else {
            reset({
                result: 'No contesta',
                duration_min: 1,
                is_special_case: false,
                technician_required: false,
                client_reference: '',
                current_plan: '',
                migration_category: '',
                objection: '',
                suggested_plan: '',
                price_difference: undefined,
                special_case_description: '',
                special_case_number: ''
            });
            setCurrentPlanPrice(0);
        }
    }, [initialValues, reset]);

    // Fetch Recent Tickets when Client Selected
    useEffect(() => {
        if (selectedClientId) {
            WisphubService.getTickets(selectedClientId)
                .then(tickets => setRecentTickets(tickets))
                .catch(err => console.error(err));
        } else {
            setRecentTickets([]);
        }
    }, [selectedClientId]);

    const result = watch('result');
    const isSpecialCase = watch('is_special_case');
    const technicianRequired = watch('technician_required');

    const onSubmit = async (data: CRMInteraction) => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            // 1. WispHub Ticket Creation (if applicable)
            if (isTechSupport || technicianRequired) {
                // Validate required fields for ticket
                const ticketDescription = (document.getElementById('ticket_description') as HTMLTextAreaElement)?.value;
                const ticketSubject = (document.getElementById('ticket_subject') as HTMLSelectElement)?.value;
                const ticketPriority = (document.getElementById('ticket_priority') as HTMLSelectElement)?.value;
                const ticketTechnicianSelect = (document.getElementById('ticket_technician') as HTMLSelectElement)?.value;
                const ticketTechnicianManual = (document.getElementById('ticket_technician_manual') as HTMLInputElement)?.value;
                const ticketTechnician = ticketTechnicianManual || ticketTechnicianSelect;

                console.log('[DEBUG] Ticket Data:', {
                    servicio: selectedClientId,
                    asunto: ticketSubject,
                    descripcion: ticketDescription,
                    prioridad: ticketPriority,
                    technicianId: ticketTechnician
                });

                if (!selectedClientId) {
                    alert('⚠️ Debes buscar y seleccionar un cliente de WispHub para crear un ticket.');
                    setSaving(false);
                    return;
                }

                if (!ticketDescription || ticketDescription.length < 5) {
                    alert('⚠️ La descripción del ticket es muy corta.');
                    setSaving(false);
                    return;
                }

                // Call API
                const ticketResult = await WisphubService.createTicket({
                    servicio: selectedClientId,
                    asunto: ticketSubject || 'Internet Lento',
                    descripcion: ticketDescription,
                    prioridad: parseInt(ticketPriority || '2'),
                    technicianId: ticketTechnician || undefined // Pass technician ID if provided
                });

                if (!ticketResult.success) {
                    if (!confirm(`❌ Error creando ticket en WispHub: ${ticketResult.message}\n\n¿Deseas guardar la gestión de todas formas?`)) {
                        setSaving(false);
                        return;
                    }
                } else {
                    alert(`✅ Ticket creado exitosamente en WispHub.`);
                }
            }

            // 2. Save Interaction to Supabase
            const interactionData = {
                ...data,
                user_id: user.id,
                client_id: selectedClientId || undefined, // Save WispHub ID
                technician_schedule: null,
                special_case_description: data.is_special_case ? data.special_case_description : null,
                special_case_number: data.is_special_case ? data.special_case_number : null,
                created_at: data.created_at ? new Date(data.created_at).toISOString() : undefined,
                scheduled_followup: data.scheduled_followup ? new Date(data.scheduled_followup).toISOString() : null
            };

            let error;
            if (initialValues?.id) {
                const { error: updateError } = await supabase
                    .from('crm_interactions')
                    .update(interactionData)
                    .eq('id', initialValues.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('crm_interactions')
                    .insert(interactionData);
                error = insertError;
            }

            if (error) throw error;

            // 3. Sync to Pipeline (Automatic Lead Management)
            if (selectedClientId) {
                try {
                    const { data: stages } = await supabase
                        .from('pipeline_stages')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('order_index');

                    if (stages && stages.length > 0) {
                        let targetStageId = null;

                        // Decision logic for stage
                        if (data.result === 'Aceptó Migración') {
                            targetStageId = stages.find(s => s.name.toLowerCase().includes('ganado'))?.id || stages[stages.length - 1].id;
                        } else if (data.result === 'Lo pensará') {
                            targetStageId = stages.find(s => s.name.toLowerCase().includes('seguimiento'))?.id || stages[Math.min(1, stages.length - 1)].id;
                        } else if (['No contesta', 'Cuelgan', 'Equivocado'].includes(data.result)) {
                            // Optionally move to 'Pendiente' or leave as is if already exists
                        }

                        if (targetStageId) {
                            await supabase
                                .from('sales_pipeline')
                                .upsert({
                                    user_id: user.id,
                                    client_id: selectedClientId,
                                    client_name: data.client_reference.split('(')[0].trim(),
                                    cedula: data.client_reference.match(/\(([^)]+)\)/)?.[1] || '',
                                    phone: data.special_case_number || '',
                                    current_plan: data.current_plan,
                                    last_result: data.result,
                                    stage_id: targetStageId,
                                    suggested_plan: data.suggested_plan,
                                    last_interaction_id: initialValues?.id || undefined, // Logic to get the newly created ID if possible
                                    updated_at: new Date().toISOString()
                                }, {
                                    onConflict: 'user_id,client_id'
                                });
                        }
                    }
                } catch (syncError) {
                    console.error('Error syncing to pipeline:', syncError);
                }
            }

            reset({
                result: 'No contesta',
                duration_min: 1,
                is_special_case: false,
                technician_required: false,
                client_reference: '',
                current_plan: '',
                migration_category: '',
                objection: '',
                suggested_plan: '',
                price_difference: undefined,
                special_case_description: '',
                special_case_number: '',
                scheduled_followup: undefined
            });
            setCurrentPlanPrice(0);
            setSelectedClientId(null);

            // Reset Timer
            setIsTimerRunning(false);
            setTimerSeconds(0);
            setIsManualDuration(false);
            onSuccess();
        } catch (error: any) {
            alert('Error al guardar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSearch = async () => {
        const query = watch('client_reference');
        if (!query || query.length < 3) {
            alert("Ingresa al menos 3 caracteres para buscar");
            return;
        }

        setSearching(true);
        setShowResults(true);
        try {
            const results = await WisphubService.searchClients(query);
            setSearchResults(results);
            if (results.length === 0) alert("No se encontraron clientes en WispHub");
        } catch (error) {
            console.error(error);
            alert("Error buscando en WispHub");
        } finally {
            setSearching(false);
        }
    };

    const selectClient = async (client: WispHubClient) => {
        const cedulaStr = client.cedula ? ` (${client.cedula})` : '';
        setValue('client_reference', `${client.nombre}${cedulaStr}`);

        setSelectedClientId(client.id_servicio);

        // Auto-fill Current Plan and Price
        if (client.plan_internet?.nombre) {
            setValue('current_plan', client.plan_internet.nombre);

            // 1. Try to get real details (Speed & Price) from WispHub
            const fastPlanMatching = wispHubPlans.find(p => p.nombre === client.plan_internet?.nombre);
            if (fastPlanMatching?.id) {
                WisphubService.getPlanDetails(fastPlanMatching.id).then(details => {
                    if (details) {
                        console.log("[WispHub] Loaded real current plan details:", details);
                        setCurrentPlanPrice(details.precio);
                        setCurrentPlanDetails(details);
                    }
                });
            } else {
                // Fallback to basic if ID not found immediately
                const price = getPlanPrice(client.plan_internet);
                setCurrentPlanPrice(price);
                setCurrentPlanDetails(null);
            }
        }

        if (client.last_result) {
            setValue('result', client.last_result as any);
        }

        setShowResults(false);

        // Check Balance
        if (client.id_servicio) {
            const balance = await WisphubService.getClientBalance(client.id_servicio);
            if (balance > 0) {
                setBalanceAlert(balance);
                alert(`⚠️ ATENCIÓN: El cliente tiene saldo pendiente de $${balance}`);
            } else {
                setBalanceAlert(null);
            }
        }
    };

    // Derived state for UI logic
    const isSale = result === 'Aceptó Migración';
    const isRejection = result.includes('Rechazó') || result === 'Lo pensará';
    const isTechSupport = result === 'Falla Técnica';

    const category = watch('migration_category');
    const currentObjection = watch('objection');

    // Auto-select client effect - Optimized to be faster
    useEffect(() => {
        if (preSelectedClient) {
            console.log("Auto-selecting client:", preSelectedClient);
            // We select basic info immediately without waiting for plans
            selectClient(preSelectedClient);
        }
    }, [preSelectedClient]); // Don't wait for wispHubPlans here


    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
            {/* ... Modal ... */}
            <button
                type="button"
                onClick={() => setShowMobileScripts(true)}
                className="lg:hidden fixed bottom-6 right-6 z-40 bg-indigo-600 text-white p-4 rounded-full shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-transform active:scale-90 flex items-center justify-center"
            >
                <BookOpen className="w-6 h-6" />
            </button>

            <Modal
                isOpen={showMobileScripts}
                onClose={() => setShowMobileScripts(false)}
                title="Guiones de Venta"
            >
                <ScriptViewer category={category || ''} objection={currentObjection || null} />
            </Modal>

            <div className="lg:col-span-2">
                <form onSubmit={handleSubmit(onSubmit)} className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-6">
                    <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                        <Phone className="w-5 h-5" /> Nueva Gestión
                    </h3>

                    {/* Context Alert for Re-engagement */}
                    {previousInteraction && !initialValues && (
                        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 rounded shadow-sm animate-in slide-in-from-top-2">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-bold text-sm">💡 Contexto de Re-ingreso</p>
                                    <p className="text-sm mt-1">
                                        Este cliente fue gestionado el <b>{new Date(previousInteraction.created_at || '').toLocaleDateString()}</b>.
                                    </p>
                                    <ul className="list-disc list-inside text-xs mt-2 space-y-1">
                                        <li><b>Resultado:</b> {previousInteraction.result}</li>
                                        <li><b>Objeción:</b> {previousInteraction.objection || 'Ninguna'}</li>
                                        <li><b>Plan Sugerido:</b> {previousInteraction.suggested_plan || 'N/A'}</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Ticket History Context */}
                    {selectedClientId && recentTickets.length > 0 && (
                        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm animate-in slide-in-from-top-2">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                                <div className="w-full">
                                    <p className="font-bold text-sm">🚩 Historial de Fallas Recientes</p>
                                    <p className="text-xs mb-2">Este cliente tiene {recentTickets.length} tickets reportados. Verifica antes de vender.</p>
                                    <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                                        {recentTickets.map((t: any) => (
                                            <div key={t.id} className="text-xs bg-white/50 p-2 rounded border border-red-100">
                                                <p className="font-semibold">{t.asunto || 'Sin Asunto'} <span className="opacity-70">({t.fecha_creacion?.split(' ')[0]})</span></p>
                                                <p className="line-clamp-2 italic opacity-80">{t.descripcion}</p>
                                                <span className={clsx("text-[10px] px-1 rounded", t.estado === 'Abierto' ? "bg-red-200 text-red-900" : "bg-gray-200")}>
                                                    {t.estado === '1' ? 'Abierto' : 'Cerrado/Resuelto'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ... Inputs ... */}
                    {/* Leaving inputs as existing code, jumping to Result section update */}

                    {/* (This replacement block is getting too large, I will focus on onSubmit + Result Logic + Tech Support UI) */}

                    {/* REUSING EXISTING INPUTS... */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1 relative">
                            <label className="text-xs font-medium text-muted-foreground">Cliente / ID <span className="text-red-500">*</span></label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <User className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                    <input
                                        {...register('client_reference', { required: true })}
                                        className={clsx(
                                            "w-full pl-9 bg-background border rounded-md p-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none",
                                            errors.client_reference ? "border-red-500 ring-1 ring-red-500" : "border-input"
                                        )}
                                        placeholder="Buscar por Nombre o Cédula..."
                                        autoComplete="off"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSearch}
                                    disabled={searching}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-md transition-colors"
                                    title="Buscar en WispHub"
                                >
                                    {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                </button>
                            </div>
                            {/* Results Dropdown */}
                            {showResults && searchResults.length > 0 && (
                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-xl max-h-60 overflow-y-auto">
                                    <div className="p-2 border-b border-border flex justify-between items-center bg-muted/30">
                                        <span className="text-xs font-bold text-muted-foreground">Resultados WispHub</span>
                                        <button type="button" onClick={() => setShowResults(false)} className="text-xs text-red-500 hover:underline">Cerrar</button>
                                    </div>
                                    {searchResults.map(client => (
                                        <div
                                            key={client.id_servicio}
                                            onClick={() => selectClient(client)}
                                            className="p-3 hover:bg-muted/50 cursor-pointer border-b border-border/50 last:border-0 transition-colors"
                                        >
                                            <p className="font-bold text-sm text-foreground">{client.nombre}</p>
                                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                                <span>CC: {client.cedula}</span>
                                                <span className={clsx(
                                                    "px-1.5 py-0.5 rounded text-[10px]",
                                                    client.estado === 'Activo' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'
                                                )}>{client.estado}</span>
                                            </div>
                                            <p className="text-xs text-indigo-500 mt-0.5">{client.plan_internet?.nombre || 'Sin Plan'}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {balanceAlert !== null && (
                                <div className="mt-1 p-2 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-xs flex items-center gap-2 animate-pulse">
                                    <AlertCircle className="w-4 h-4" />
                                    <b>Cliente en Mora:</b> Deuda total de ${balanceAlert.toLocaleString()}
                                </div>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Plan Actual <span className="text-red-500">*</span></label>
                            <input
                                {...register('current_plan', { required: true })}
                                className={clsx(
                                    "w-full bg-background border rounded-md p-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none",
                                    errors.current_plan ? "border-red-500 ring-1 ring-red-500" : "border-input"
                                )}
                                placeholder="Ej. Hogar 10MB"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                            <select {...register('migration_category')} className="w-full bg-background border border-input rounded-md p-2 text-sm">
                                <option value="">Seleccionar...</option>
                                {REPORT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground flex justify-between">
                                <span>Duración (min)</span>
                                {isTimerRunning && <span className="text-green-600 font-mono animate-pulse">{formatTime(timerSeconds)}</span>}
                            </label>
                            <div className="flex gap-2 items-center">
                                <div className="relative flex-1">
                                    <Clock className={clsx("absolute left-3 top-2.5 w-4 h-4", isManualDuration ? "text-amber-500" : "text-green-600")} />
                                    <input
                                        type="number"
                                        step="0.1"
                                        {...register('duration_min', {
                                            onChange: handleManualDurationChange
                                        })}
                                        className={clsx(
                                            "w-full pl-9 bg-background border rounded-md p-2 text-sm transition-colors",
                                            isManualDuration
                                                ? "border-amber-300 bg-amber-50 dark:bg-amber-900/10 focus:ring-amber-200"
                                                : "border-green-300 bg-green-50 dark:bg-green-900/10 focus:ring-green-200"
                                        )}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={toggleTimer}
                                    className={clsx(
                                        "p-2 rounded-md text-white transition-all shadow-sm active:scale-95 flex items-center gap-2",
                                        isTimerRunning ? "bg-red-500 hover:bg-red-600" : "bg-green-600 hover:bg-green-700"
                                    )}
                                    title={isTimerRunning ? "Detener Cronómetro" : "Iniciar Cronómetro"}
                                >
                                    {isTimerRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                                </button>
                            </div>
                            {isManualDuration && (
                                <p className="text-[10px] text-amber-600 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Editado manualmente (Estimado)
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-border">
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                            <span>📅 Fecha de Gestión (Opcional - Para cargas retroactivas)</span>
                        </label>
                        <input
                            type="datetime-local"
                            {...register('created_at')}
                            className="bg-muted/30 border border-input rounded-md p-2 text-sm w-full text-foreground"
                        />
                        <p className="text-[10px] text-muted-foreground">Dejar vacío para usar la fecha/hora actual.</p>
                    </div>

                    {/* RESULTS SECTION */}
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Resultado</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {['Aceptó Migración', 'Lo pensará', 'No contesta', 'Rechazó (Mantiene)', 'Rechazó (Cancelación)', 'Equivocado', 'Cuelgan'].map((res) => (
                                <label
                                    key={res}
                                    className={clsx(
                                        "cursor-pointer text-xs font-medium p-2 rounded-md border text-center transition-all select-none",
                                        result === res
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background hover:bg-muted"
                                    )}
                                >
                                    <input
                                        type="radio"
                                        value={res}
                                        {...register('result')}
                                        className="sr-only"
                                    />
                                    {res}
                                </label>
                            ))}
                        </div>
                    </div>



                    {/* Sale Section */}
                    {isSale && (
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-4 animate-in zoom-in-95">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs font-medium text-green-700 dark:text-green-400">Plan Vendido</label>
                                    <select
                                        {...register('suggested_plan')}
                                        className="w-full bg-background border border-input rounded-md p-2 text-sm"
                                    >
                                        <option value="">Selecciona el plan...</option>
                                        {offeredPlans.length > 0 ? (
                                            offeredPlans.map(plan => (
                                                <option key={plan.id} value={plan.name}>
                                                    {plan.name} - ${Number(plan.price).toLocaleString()}
                                                </option>
                                            ))
                                        ) : (
                                            PLAN_OPTIONS.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                {/* ROI / Speed Calculator */}
                                <div className="space-y-1 md:col-span-4 mt-2 p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                    <label className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                                        🚀 Calculadora de Beneficio (Argumento de Venta)
                                    </label>
                                    <div className="text-xs flex flex-wrap gap-4 items-center">
                                        {(() => {
                                            const currentPlanObj = currentPlanDetails || wispHubPlans.find(p => p.nombre === watch('current_plan'));
                                            const newPlanObj = offeredPlans.find(p => p.name === suggestedPlanName);

                                            // Fallback speeds if plan details missing
                                            const getCurrentSpeed = (p: any) => p?.velocidad_bajada || (p?.nombre?.match(/(\d+)MB/i)?.[1]) || (p?.name?.match(/(\d+)MB/i)?.[1]) || '?';

                                            const currentSpeed = getCurrentSpeed(currentPlanObj);
                                            const newSpeed = getCurrentSpeed(newPlanObj);
                                            const diffPrice = watch('price_difference') || 0;

                                            return (
                                                <>
                                                    <div className="flex flex-col">
                                                        <span className="text-muted-foreground">Velocidad Actual:</span>
                                                        <span className="font-bold">{currentSpeed} Mb</span>
                                                    </div>
                                                    <div className="text-muted-foreground">→</div>
                                                    <div className="flex flex-col">
                                                        <span className="text-green-600 font-bold">Nueva Velocidad:</span>
                                                        <span className="font-bold text-green-600">{newSpeed} Mb</span>
                                                    </div>
                                                    <div className="h-8 w-px bg-border mx-2"></div>
                                                    <div>
                                                        El cliente paga solo <span className="font-bold text-green-600">${diffPrice.toLocaleString()}</span> más
                                                        por <span className="font-bold text-indigo-600">
                                                            {Number(newSpeed) && Number(currentSpeed) ? (Number(newSpeed) / Number(currentSpeed)).toFixed(1) + 'x' : 'mejor'} velocidad
                                                        </span>.
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>


                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-green-700 dark:text-green-400">Upsell ($)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-green-600" />
                                        <input
                                            type="text"
                                            readOnly
                                            value={watch('price_difference')
                                                ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(watch('price_difference') || 0)
                                                : '$ 0'}
                                            className="w-full pl-9 bg-background border border-input rounded-md p-2 text-sm font-bold text-green-700"
                                        />
                                        <input
                                            type="hidden"
                                            {...register('price_difference', { valueAsNumber: true })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-blue-700 dark:text-blue-400">Costo Día</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-blue-600" />
                                        <input
                                            type="text"
                                            readOnly
                                            value={watch('price_difference')
                                                ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format((watch('price_difference') || 0) / 30)
                                                : '$ 0'}
                                            className="w-full pl-9 bg-background border border-input rounded-md p-2 text-sm font-bold text-blue-700"
                                        />
                                    </div>
                                </div>
                            </div>



                        </div>
                    )}

                    {/* Rejection Section */}
                    {isRejection && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg space-y-4 animate-in zoom-in-95">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-red-700 dark:text-red-400">Objeción Principal</label>
                                <select
                                    {...register('objection')}
                                    className="w-full bg-background border border-input rounded-md p-2 text-sm"
                                >
                                    <option value="">Selecciona motivo...</option>
                                    {PREDEFINED_OBJECTIONS.map(obj => (
                                        <option key={obj} value={obj}>{obj}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Scheduling UI for Call Back */}
                            <div className="space-y-1 pt-2 border-t border-red-200 dark:border-red-800/30">
                                <label className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                                    📅 Agendar Llamada de Seguimiento
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="datetime-local"
                                        {...register('scheduled_followup')}
                                        className="w-full bg-background border border-input rounded-md p-2 text-sm"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    Se te notificará para llamar nuevamente al cliente en esta fecha.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Tech Support Ticket UI - Shown if Technical Failure OR Technician Required */}

                    {/* Always allow toggling the ticket section via this switch, unless Result is explicitly Tech Failure */}
                    {!isTechSupport && (
                        <div className="flex items-center gap-2 pt-2 border-t border-muted/20">
                            <input
                                type="checkbox"
                                id="manual_tech_required"
                                checked={technicianRequired}
                                onChange={(e) => setValue('technician_required', e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                            />
                            <label htmlFor="manual_tech_required" className="text-sm font-bold text-orange-600 flex items-center gap-1 cursor-pointer select-none">
                                <Wrench className="w-4 h-4" /> 🚩 Reportar Falla Técnica / Crear Ticket
                            </label>
                        </div>
                    )}

                    {(isTechSupport || technicianRequired) && (
                        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg space-y-4 animate-in zoom-in-95 mt-2">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-orange-700 dark:text-orange-400">
                                        Asunto <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        id="ticket_subject"
                                        className="w-full bg-background border border-input rounded-md p-2 text-sm"
                                    >
                                        {TICKET_SUBJECTS.map(subj => (
                                            <option key={subj} value={subj}>{subj}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-orange-700 dark:text-orange-400">
                                        Técnico Responsable <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        id="ticket_technician"
                                        className="w-full bg-background border border-input rounded-md p-2 text-sm"
                                    >
                                        <option value="">Seleccionar técnico...</option>
                                        {technicians.length > 0 ? (
                                            technicians.map(tech => (
                                                <option key={tech.id || tech.usuario} value={tech.id}>
                                                    {tech.nombre}
                                                </option>
                                            ))
                                        ) : (
                                            <>
                                                {/* Fallback IDs (Usernames with Domain) matching wisphub.ts */}
                                                <option value="tecnico4@rapilink-sas">TOMAS MCAUSLAND</option>
                                                <option value="tecnico3@rapilink-sas">MARIO SABANAGRANDE</option>
                                                <option value="asistente.administrativa1@rapilink-sas">VALENTINA SUAREZ</option>
                                                <option value="asistente.administrativa2@rapilink-sas">ELENA MACHADO</option>
                                                <option value="lucia@rapilink-sas">LUCIA ACUÑA</option>
                                                <option value="cristobal@rapilink-sas">CRISTOBAL MARTINEZ</option>
                                                <option value="javier@rapilink-sas">JAVIER OLIVERA</option>
                                                <option value="vanessa@rapilink-sas">Vanessa Barrera</option>
                                            </>
                                        )}
                                    </select>

                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-orange-700 dark:text-orange-400">
                                    Descripción <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="ticket_description"
                                    className="w-full bg-background border border-input rounded-md p-2 text-sm min-h-[100px]"
                                    placeholder="Describe el problema, pruebas realizadas, síntomas, etc..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-orange-700 dark:text-orange-400">Prioridad</label>
                                    <select
                                        id="ticket_priority"
                                        className="w-full bg-background border border-input rounded-md p-2 text-sm"
                                    >
                                        <option value="1">Baja</option>
                                        <option value="2" defaultValue="2">Normal</option>
                                        <option value="3">Alta</option>
                                        <option value="4">Muy Alta</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Estado</label>
                                    <input
                                        type="text"
                                        value="Nuevo"
                                        disabled
                                        className="w-full bg-muted border border-input rounded-md p-2 text-sm text-muted-foreground cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            {!selectedClientId && (
                                <div className="text-xs text-red-500 font-bold bg-red-100 dark:bg-red-900/20 p-2 rounded flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> Debes buscar y seleccionar un cliente arriba para poder crear el ticket.
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2 pt-2 border-t border-border">
                        <label className="text-xs font-medium text-muted-foreground">¿Del 0 al 10, qué tan probable es que nos recomiende? (NPS)</label>
                        <div className="flex justify-between gap-1">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                                <label key={val} className="flex flex-col items-center cursor-pointer group">
                                    <input
                                        type="radio"
                                        value={val}
                                        {...register('nps', { valueAsNumber: true })}
                                        className="sr-only peer"
                                    />
                                    <div className={clsx(
                                        "w-8 h-8 flex items-center justify-center rounded-full text-xs font-medium border transition-all peer-checked:scale-110",
                                        "peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-indigo-500",
                                        val <= 6 ? "peer-checked:bg-red-500 peer-checked:text-white border-red-200 hover:border-red-500" :
                                            val <= 8 ? "peer-checked:bg-yellow-500 peer-checked:text-white border-yellow-200 hover:border-yellow-500" :
                                                "peer-checked:bg-green-500 peer-checked:text-white border-green-200 hover:border-green-500"
                                    )}>
                                        {val}
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="special_case"
                                {...register('is_special_case')}
                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="special_case" className="text-sm font-medium text-indigo-600 flex items-center gap-1 cursor-pointer">
                                <AlertCircle className="w-4 h-4" /> Marcar como Caso Especial
                            </label>
                        </div>

                        {isSpecialCase && (
                            <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-indigo-700 dark:text-indigo-400">Descripción del Caso</label>
                                    <textarea
                                        {...register('special_case_description')}
                                        className="w-full bg-background border border-input rounded-md p-2 text-sm min-h-[60px]"
                                        placeholder="Detalles de la incidencia..."
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-indigo-700 dark:text-indigo-400">ID Servicio / Teléfono</label>
                                    <input
                                        {...register('special_case_number')}
                                        className="w-full bg-background border border-input rounded-md p-2 text-sm"
                                        placeholder="Ej. 102030 / 3001234567"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className={clsx(
                            "w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all disabled:opacity-50 mt-4",
                            initialValues?.id ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Guardando...' : (initialValues?.id ? 'Actualizar Gestión' : 'Guardar Gestión')}
                    </button>
                </form >
            </div >

            <div className="hidden lg:block lg:col-span-1">
                <div className="sticky top-6 h-[calc(100vh-100px)] overflow-hidden">
                    <ScriptViewer category={category || ''} objection={currentObjection || null} />
                </div>
            </div>
        </div >
    );
}
