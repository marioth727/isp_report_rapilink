import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { useState, useEffect } from 'react';
import { Save, User, Phone, Clock, DollarSign, AlertCircle, Wrench, BookOpen, Search, Loader2, Play, Square, Activity, Zap, ExternalLink, RefreshCw, Camera, X } from 'lucide-react';
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

// Helper to get robust price from WispHub plan
const getPlanPrice = (val: any) => {
    if (!val) return 0;
    const priceStr = typeof val === 'object'
        ? (val.precio || val.Precio || val.costo || val.mensualidad || 0)
        : val;

    if (typeof priceStr === 'string') {
        // Remove everything except digits and the FIRST dot/comma
        const clean = priceStr.replace(/[^0-9.,]/g, '').replace(',', '.');
        const price = parseFloat(clean);
        return isNaN(price) ? 0 : price;
    }
    return Number(priceStr) || 0;
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
    const [activeTab, setActiveTab] = useState<'scripts' | 'tickets'>('scripts');
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [fullClientData, setFullClientData] = useState<any>(null);
    const [portalLink, setPortalLink] = useState<string | null>(null);

    // Daily Stats State
    const [dailyGestiones, setDailyGestiones] = useState(0);
    const [avgNps, setAvgNps] = useState(0);
    const [pendingFollowups, setPendingFollowups] = useState<any[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                dispatchToast("Archivo muy grande", "error", "El límite es 5MB");
                return;
            }
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setFilePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
    };

    const fetchDailyStats = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            // Fetch daily count and NPS
            const { data: interactions } = await supabase
                .from('crm_interactions')
                .select('nps')
                .eq('user_id', user.id)
                .gte('created_at', today.toISOString());

            if (interactions) {
                setDailyGestiones(interactions.length);
                const npsValues = interactions.filter(i => i.nps !== null && i.nps !== undefined).map(i => i.nps);
                const avg = npsValues.length > 0 ? npsValues.reduce((a: number, b: number) => a + b, 0) / npsValues.length : 0;
                setAvgNps(avg);
            }

            // Fetch pending follow-ups for TODAY
            const { data: followups } = await supabase
                .from('crm_interactions')
                .select('id, client_reference, scheduled_followup')
                .eq('user_id', user.id)
                .gte('scheduled_followup', today.toISOString())
                .lte('scheduled_followup', endOfDay.toISOString());

            setPendingFollowups(followups || []);

        } catch (err) {
            console.error("Error fetching daily stats:", err);
        }
    };

    useEffect(() => {
        fetchDailyStats();
    }, []);


    // Reset/Populate form when initialValues changes & Load Plans from WispHub
    useEffect(() => {
        const loadData = async () => {
            // Fetch plans list
            const plans = await WisphubService.getInternetPlans();
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

    const refreshSpecificTicket = async (ticketId: string | number) => {
        try {
            const updated = await WisphubService.getTicketDetail(ticketId);
            if (updated) {
                setRecentTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
            }
        } catch (error) {
            console.error("Error refreshing ticket:", error);
        }
    };

    const result = watch('result');
    const isSpecialCase = watch('is_special_case');
    const technicianRequired = watch('technician_required');

    const dispatchToast = (message: string, type: 'success' | 'error' | 'info' | 'loading', description?: string, id?: string) => {
        window.dispatchEvent(new CustomEvent('app:toast', {
            detail: { message, type, description, id, duration: type === 'loading' ? 0 : 4000 }
        }));
    };

    const onSubmit = async (data: CRMInteraction) => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');

            // 0. Subir archivo a Supabase Storage si existe
            let attachmentUrl = null;
            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `${user.id}_${Date.now()}.${fileExt}`;
                const filePath = `attachments/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('interaction-attachments')
                    .upload(filePath, selectedFile);

                if (uploadError) {
                    console.error("Error al subir archivo:", uploadError);
                } else {
                    const { data: { publicUrl } } = supabase.storage
                        .from('interaction-attachments')
                        .getPublicUrl(filePath);
                    attachmentUrl = publicUrl;
                }
            }

            // 1. Guardado Local PRIORITARIO (Supabase)
            const interactionData = {
                ...data,
                user_id: user.id,
                client_id: selectedClientId || undefined,
                attachment_url: attachmentUrl,
                technician_schedule: null,
                special_case_description: data.is_special_case ? data.special_case_description : null,
                special_case_number: data.is_special_case ? data.special_case_number : null,
                created_at: data.created_at ? new Date(data.created_at).toISOString() : undefined,
                scheduled_followup: data.scheduled_followup ? new Date(data.scheduled_followup).toISOString() : null
            };

            let error;
            let savedInteraction: any = null;

            if (initialValues?.id) {
                const { data: updated, error: updateError } = await supabase
                    .from('crm_interactions')
                    .update(interactionData)
                    .eq('id', initialValues.id)
                    .select()
                    .single();
                error = updateError;
                savedInteraction = updated;
            } else {
                const { data: inserted, error: insertError } = await supabase
                    .from('crm_interactions')
                    .insert(interactionData)
                    .select()
                    .single();
                error = insertError;
                savedInteraction = inserted;
            }

            if (error) throw error;

            // --- CAPTURA DE VALORES DE UI ANTES DEL RESET ---
            const uiTicketSubject = (document.getElementById('ticket_subject') as HTMLSelectElement)?.value || 'Gestión desde Plataforma';
            const uiTicketDescription = (document.getElementById('ticket_description') as HTMLTextAreaElement)?.value || '';
            const uiTicketPriority = (document.getElementById('ticket_priority') as HTMLSelectElement)?.value || '2';
            const uiTicketTechnicianAuto = (document.getElementById('ticket_technician') as HTMLSelectElement)?.value;
            const uiTicketTechnicianManual = (document.getElementById('ticket_technician_manual') as HTMLInputElement)?.value;
            const uiTicketTechnician = uiTicketTechnicianManual || uiTicketTechnicianAuto;
            const uiMainNote = (document.getElementById('interaction_description') as HTMLTextAreaElement)?.value || data.special_case_description || '';

            // --- DESACOPLE: EL USUARIO YA PUEDE CONTINUAR ---
            const username = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Asesor';
            const clientName = data.client_reference.split('(')[0].trim();
            const syncId = `sync-${Date.now()}`;

            // Notificar éxito local
            dispatchToast("Gestión Guardada ✅", "success", `Cliente: ${clientName}`, `local-${syncId}`);

            // Resetear UI inmediatamente
            if (!initialValues) {
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
                setRecentTickets([]);
                setSelectedClientId(null);
                setIsTimerRunning(false);
                setTimerSeconds(0);
                setIsManualDuration(false);
                setSelectedFile(null);
                setFilePreview(null);
            }
            fetchDailyStats();
            onSuccess();
            setSaving(false);

            // 2. Sincronización en SEGUNDO PLANO (WispHub + Pipeline)
            if (selectedClientId) {
                (async () => {
                    dispatchToast("Sincronizando WispHub...", "loading", `Enviando datos de ${clientName}`, syncId);

                    try {
                        const mainNote = uiMainNote;

                        // A. Comentarios en WispHub
                        const crmNote = [
                            `[CRM - ${username}]`,
                            `Resultado: ${data.result}`,
                            data.objection ? `Objeción: ${data.objection}` : null,
                            data.suggested_plan ? `Plan Sugerido: ${data.suggested_plan}` : null,
                            `NPS: ${data.nps ?? 'N/A'}`,
                            `Nota: ${mainNote}`
                        ].filter(Boolean).join(' | ');

                        await WisphubService.updateClientComments(selectedClientId, crmNote);

                        // B. Ticket Técnico
                        if (isTechSupport || technicianRequired) {
                            const ticketDescription = uiTicketDescription || mainNote;
                            const ticketSubject = uiTicketSubject;
                            const ticketPriority = uiTicketPriority;
                            const ticketTechnician = uiTicketTechnician;

                            const ticketResult = await WisphubService.createTicket({
                                servicio: selectedClientId,
                                asunto: ticketSubject,
                                descripcion: `[CRM - ${username}] ${ticketDescription}`,
                                prioridad: parseInt(ticketPriority),
                                technicianId: ticketTechnician || undefined,
                                file: selectedFile || undefined
                            });

                            if (!ticketResult.success) {
                                throw new Error(`WispHub Ticket: ${ticketResult.message}`);
                            }
                        }

                        // C. Pipeline Sync
                        const { data: stages } = await supabase
                            .from('pipeline_stages')
                            .select('*')
                            .eq('user_id', user.id)
                            .order('order_index');

                        if (stages && stages.length > 0) {
                            let targetStageId = null;
                            if (data.result === 'Aceptó Migración') {
                                targetStageId = stages.find(s => s.name.toLowerCase().includes('ganado'))?.id || stages[stages.length - 1].id;
                            } else if (data.result === 'Lo pensará') {
                                targetStageId = stages.find(s => s.name.toLowerCase().includes('seguimiento'))?.id || stages[Math.min(1, stages.length - 1)].id;
                            }

                            if (targetStageId) {
                                await supabase
                                    .from('sales_pipeline')
                                    .upsert({
                                        user_id: user.id,
                                        client_id: selectedClientId,
                                        client_name: clientName,
                                        cedula: data.client_reference.match(/\(([^)]+)\)/)?.[1] || '',
                                        phone: data.special_case_number || '',
                                        current_plan: data.current_plan,
                                        last_result: data.result,
                                        stage_id: targetStageId,
                                        suggested_plan: data.suggested_plan,
                                        last_interaction_id: savedInteraction?.id,
                                        updated_at: new Date().toISOString()
                                    }, { onConflict: 'user_id,client_id' });
                            }
                        }

                        dispatchToast("Sincronización Completa ✅", "success", `WispHub & Pipeline actualizados para ${clientName}`, syncId);

                    } catch (syncErr: any) {
                        console.error("[Sync Error]", syncErr);
                        dispatchToast("Error de Sincronización ⚠️", "error", `WispHub no respondió: ${syncErr.message || 'Error de red'}. El registro local es válido.`, syncId);
                    }
                })();
            }
        } catch (error: any) {
            alert('Error al guardar localmente: ' + error.message);
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
            if (results.length === 0) {
                alert("No se encontraron clientes en WispHub");
            }
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

            const findAndSetPrice = (allPlans: WispHubPlan[]) => {
                const targetName = (client.plan_internet.nombre || '').trim();
                const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

                let match = allPlans.find(p => p.nombre.trim().toLowerCase() === targetName.toLowerCase());
                if (!match) match = allPlans.find(p => normalize(p.nombre) === normalize(targetName));

                if (match?.id) {
                    WisphubService.getPlanDetails(match.id, match.tipo).then((details: any) => {
                        if (details) {
                            const price = details.precio || details.Precio || details.costo || 0;
                            const numericPrice = getPlanPrice(price);
                            setCurrentPlanPrice(numericPrice);
                            setCurrentPlanDetails(details);
                        }
                    });
                } else {
                    setCurrentPlanPrice(getPlanPrice(client.plan_internet));
                }
            };

            // If plans aren't loaded yet, fetch them now
            if (wispHubPlans.length === 0) {
                WisphubService.getInternetPlans().then(plans => {
                    setWispHubPlans(plans);
                    findAndSetPrice(plans);
                });
            } else {
                findAndSetPrice(wispHubPlans);
            }
        }

        if (client.last_result) {
            setValue('result', client.last_result as any);
        }

        setShowResults(false);

        // Check Balance and Fetch Tickets
        if (client.id_servicio) {
            setRecentTickets([]);
            setLoadingTickets(true);

            // Fetch only what's needed for management and tickets history
            Promise.all([
                WisphubService.getTickets(client.id_servicio, client.nombre, client.cedula),
                WisphubService.getServiceDetail(client.id_servicio),
                WisphubService.getClientPortalLink(client.id_servicio)
            ]).then(([tickets, detail, link]) => {
                setRecentTickets(tickets);
                setFullClientData({ ...client, ...detail });
                setPortalLink(link);
                setLoadingTickets(false);
            });

            const balance = await WisphubService.getClientBalance(client.id_servicio);
            if (balance > 0) {
                setBalanceAlert(balance);
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

    // Auto-select client effect
    useEffect(() => {
        if (preSelectedClient) {
            selectClient(preSelectedClient);
        }
    }, [preSelectedClient]);

    const getClientHealth = () => {
        if (!selectedClientId) return null;

        const wispStatus = fullClientData?.estado || 'Desconocido';
        const hasDebt = (balanceAlert || 0) > 0;
        const hasOpenTickets = recentTickets.some(t => t.id_estado !== 3); // 3 is usually 'Cerrado'

        const badges = [];
        const statusLower = wispStatus.toLowerCase();

        // 1. Main Status Badge
        let mainColor = 'green';
        if (statusLower.includes('cancelado') || statusLower.includes('retirado')) {
            mainColor = 'red';
        } else if (statusLower.includes('suspendido')) {
            mainColor = 'orange';
        } else if (statusLower.includes('gratis') || statusLower.includes('cortesia') || statusLower.includes('cortesía')) {
            mainColor = 'blue';
        } else if (statusLower.includes('activo')) {
            mainColor = 'green';
        }

        badges.push({
            color: mainColor,
            label: wispStatus.toUpperCase(),
            icon: mainColor === 'red' ? '🔴' : mainColor === 'orange' ? '🟠' : mainColor === 'blue' ? '🔵' : '🟢',
            desc: `Estado: ${wispStatus}`
        });

        // 2. Alert Badge (Beside the main one)
        if (hasDebt || hasOpenTickets) {
            badges.push({
                color: 'yellow',
                label: 'CON ALERTA',
                icon: '🟡',
                desc: `${hasDebt ? 'Deuda pendiente' : ''}${hasOpenTickets ? ' | Tickets abiertos' : ''}`
            });
        }

        return badges;
    };

    const healthBadges = getClientHealth();

    return (
        <div className="flex flex-col gap-6 relative">
            {/* Daily Dashboard & Alerts */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-4 rounded-2xl shadow-lg shadow-indigo-500/20 flex items-center gap-4 border border-white/10 group hover:scale-[1.02] transition-transform cursor-pointer">
                    <div className="bg-white/20 p-3 rounded-xl group-hover:rotate-12 transition-transform">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] opacity-70 font-black uppercase tracking-widest leading-none mb-1">Logros del Día</p>
                        <h3 className="text-2xl font-black leading-none">{dailyGestiones} <span className="text-xs font-medium opacity-60 italic">gestiones</span></h3>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center gap-4 border border-white/10 group hover:scale-[1.02] transition-transform cursor-pointer">
                    <div className="bg-white/20 p-3 rounded-xl group-hover:scale-110 transition-transform">
                        <Zap className="w-6 h-6 fill-current" />
                    </div>
                    <div>
                        <p className="text-[10px] opacity-70 font-black uppercase tracking-widest leading-none mb-1">NPS Promedio</p>
                        <h3 className="text-2xl font-black leading-none">{avgNps.toFixed(1)} <span className="text-xs font-medium opacity-60">/ 10</span></h3>
                    </div>
                </div>

                {pendingFollowups.length > 0 ? (
                    <div className="md:col-span-2 bg-gradient-to-br from-amber-500 to-orange-600 text-white p-4 rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-between border border-white/10 animate-pulse-slow">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-3 rounded-xl">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[10px] opacity-80 font-black uppercase tracking-widest leading-none mb-1">¡Seguimientos Hoy!</p>
                                <p className="text-sm font-bold line-clamp-1">Tienes {pendingFollowups.length} llamadas pendientes de "Lo pensará"</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveTab('tickets')}
                            className="bg-white/20 hover:bg-white/30 p-2 rounded-lg text-xs font-bold transition-colors"
                        >
                            Ver Lista
                        </button>
                    </div>
                ) : (
                    <div className="md:col-span-2 bg-slate-100 dark:bg-slate-800/50 text-slate-400 p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center gap-4">
                        <div className="p-3 rounded-xl border border-dashed border-slate-300">
                            <Clock className="w-6 h-6 opacity-40" />
                        </div>
                        <p className="text-sm italic">No tienes seguimientos pendientes para hoy.</p>
                    </div>
                )}
            </div>

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
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-primary flex items-center gap-3">
                                <Phone className="w-5 h-5" />
                                <span>Nueva Gestión</span>
                                {healthBadges?.map((badge, idx) => (
                                    <div key={idx} className={clsx(
                                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border animate-in zoom-in-95 duration-500",
                                        badge.color === 'red' ? "bg-red-500 text-white border-red-600 shadow-lg shadow-red-500/20" :
                                            badge.color === 'orange' ? "bg-orange-500 text-white border-orange-600 shadow-lg shadow-orange-500/20" :
                                                badge.color === 'yellow' ? "bg-yellow-400 text-yellow-950 border-yellow-500 shadow-lg shadow-yellow-400/20" :
                                                    badge.color === 'blue' ? "bg-blue-500 text-white border-blue-600 shadow-lg shadow-blue-500/20" :
                                                        "bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-500/20"
                                    )} title={badge.desc}>
                                        <span className="relative flex h-2 w-2">
                                            <span className={clsx(
                                                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                                                badge.color === 'yellow' ? "bg-yellow-900" : "bg-white"
                                            )}></span>
                                            <span className={clsx(
                                                "relative inline-flex rounded-full h-2 w-2",
                                                badge.color === 'yellow' ? "bg-yellow-900" : "bg-white"
                                            )}></span>
                                        </span>
                                        {badge.label}
                                    </div>
                                ))}
                            </h3>
                            {recentTickets.length > 0 && (
                                <div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                                    <AlertCircle className="w-3 h-3" />
                                    {recentTickets.length} Tickets Recientes
                                </div>
                            )}
                        </div>

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

                        {/* AI Smart Suggestion - Feature 4 */}
                        {selectedClientId && (
                            <div className={clsx(
                                "p-4 rounded-xl border-l-4 animate-in slide-in-from-left-2 duration-500",
                                recentTickets.some(t => t.asunto?.toLowerCase().includes('lento') || t.asunto?.toLowerCase().includes('intermitencia'))
                                    ? "bg-amber-50 border-amber-500 text-amber-900"
                                    : "bg-indigo-50 border-indigo-500 text-indigo-900"
                            )}>
                                <div className="flex items-start gap-4">
                                    <div className={clsx(
                                        "p-2 rounded-xl",
                                        recentTickets.some(t => t.asunto?.toLowerCase().includes('lento') || t.asunto?.toLowerCase().includes('intermitencia'))
                                            ? "bg-amber-500 text-white"
                                            : "bg-indigo-600 text-white"
                                    )}>
                                        <Zap className="w-5 h-5 fill-current" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black uppercase tracking-widest opacity-70 mb-1 leading-none">Sugerencia Inteligente</h4>
                                        <p className="text-sm font-bold">
                                            {(() => {
                                                const issues = recentTickets.filter(t =>
                                                    t.asunto?.toLowerCase().includes('lento') ||
                                                    t.asunto?.toLowerCase().includes('intermitencia') ||
                                                    t.asunto?.toLowerCase().includes('falla')
                                                );

                                                if (issues.length >= 2) {
                                                    return "Detectada inestabilidad recurrente por historial. Recomendación: Migración prioritaria a Fibra Óptica + Router Dual Band (Plan 100MB+).";
                                                } else if (watch('current_plan')?.toLowerCase().includes('10mb')) {
                                                    return "Plan básico detectado. El cliente es ideal para un Upsell agresivo a 100MB por una diferencia mínima.";
                                                } else if (recentTickets.some(t => t.asunto?.toLowerCase().includes('wifi'))) {
                                                    return "Reportes de problemas de cobertura WiFi. Sugiere extensor Mesh o un plan con mejor router.";
                                                }
                                                return "Sin fallas críticas reportadas. Enfócate en la estabilidad y velocidad superior de la Fibra como principal argumento.";
                                            })()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}


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
                                {/* Results Dropdown ... */}
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
                                    <div className="mt-1 p-2 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-xs flex flex-col gap-2 animate-pulse">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" />
                                            <b>Cliente en Mora:</b> Deuda total de ${balanceAlert.toLocaleString()}
                                        </div>
                                        {portalLink && (
                                            <a
                                                href={portalLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-[10px] font-black flex items-center justify-center gap-1.5 transition-colors mt-1 w-fit"
                                            >
                                                <ExternalLink className="w-3 h-3" /> VER FACTURAS EN PORTAL
                                            </a>
                                        )}
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

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-indigo-500" /> Celular
                                </label>
                                <input
                                    type="text"
                                    value={fullClientData?.telefono || fullClientData?.telefono1 || ''}
                                    placeholder="---"
                                    readOnly
                                    className="w-full bg-muted/30 border border-input rounded-md p-2 text-sm text-foreground font-medium cursor-default"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Activity className="w-3 h-3 text-indigo-500" /> IP del Servicio
                                </label>
                                <input
                                    type="text"
                                    value={fullClientData?.ip || ''}
                                    placeholder="---"
                                    readOnly
                                    className="w-full bg-muted/30 border border-input rounded-md p-2 text-sm text-foreground font-medium cursor-default"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <DollarSign className="w-3 h-3 text-indigo-500" /> Saldo Pendiente
                                </label>
                                <input
                                    type="text"
                                    value={balanceAlert !== null ? `$${balanceAlert.toLocaleString()}` : '$0'}
                                    readOnly
                                    className={clsx(
                                        "w-full border rounded-md p-2 text-sm font-black cursor-default",
                                        (balanceAlert || 0) > 0
                                            ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800"
                                            : "bg-muted/30 border-input text-foreground"
                                    )}
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
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Observaciones Generales</label>
                            <textarea
                                id="interaction_description"
                                className="w-full bg-background border border-input rounded-md p-2 text-sm min-h-[80px]"
                                placeholder="Anota aquí los detalles de la conversación..."
                            />
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
                                {['Aceptó Migración', 'Lo pensará', 'No contesta', 'Rechazó (Mantiene)', 'Rechazó (Cancelación)', 'Equivocado', 'Cuelgan', 'Falla Técnica'].map((res) => (
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

                                                // Robust Speed Extraction
                                                const getCurrentSpeed = (p: any) => {
                                                    if (!p) return '?';
                                                    const str = typeof p === 'string' ? p : (p.velocidad_bajada || p.nombre || p.name || '');
                                                    // Matches: 100MB, 100 MB, 100Mb, 100 Mb, 100Megas, 100M
                                                    const match = String(str).match(/(\d+)\s*(?:MB|MH|M|MEGAS|megas|kb)/i);
                                                    return match ? match[1] : (typeof p === 'object' && p.velocidad_bajada ? p.velocidad_bajada : '?');
                                                };

                                                const currentPlanName = watch('current_plan');
                                                const currentSpeed = getCurrentSpeed(currentPlanObj || currentPlanName);
                                                const newSpeed = getCurrentSpeed(newPlanObj || suggestedPlanName);
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
                                                    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(watch('price_difference') || 0).replace('$', '').trim()
                                                    : '0'}
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
                                                    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format((watch('price_difference') || 0) / 30).replace('$', '').trim()
                                                    : '0'}
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
                                                    <option key={tech.id || tech.usuario} value={tech.usuario}>
                                                        {tech.nombre}
                                                    </option>
                                                ))
                                            ) : (
                                                <>
                                                    {/* Fallback Strings (Usernames for WispHub) */}
                                                    <option value="tecnico4@rapilink-sas">TOMAS MCAUSLAND</option>
                                                    <option value="tecnico1@rapilink-sas">JAVIER OLIVERA</option>
                                                    <option value="yuranis.moreno@rapilink-sas">ELENA PEREZ</option>
                                                    <option value="admin@rapilink-sas">ADMINISTRACIÓN</option>
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

                                {/* File Attachment UI */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-orange-700 dark:text-orange-400">
                                        Adjuntar Imagen (Opcional)
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <label className="cursor-pointer group flex items-center justify-center w-12 h-12 rounded-lg border-2 border-dashed border-input hover:border-orange-500 hover:bg-orange-500/5 transition-all">
                                            <Camera className="w-5 h-5 text-muted-foreground group-hover:text-orange-500" />
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleFileChange}
                                            />
                                        </label>

                                        {filePreview && (
                                            <div className="relative group">
                                                <img
                                                    src={filePreview}
                                                    alt="Preview"
                                                    className="w-12 h-12 rounded-lg object-cover border border-border"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={removeFile}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                        {!filePreview && (
                                            <p className="text-[10px] text-muted-foreground">Haz clic en el icono para subir una foto de la falla.</p>
                                        )}
                                    </div>
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
                    <div className="sticky top-6 h-[calc(100vh-100px)] flex flex-col gap-4">
                        {/* Sidebar Tabs */}
                        <div className="flex p-1 bg-muted rounded-lg w-full">
                            <button
                                type="button"
                                onClick={() => setActiveTab('scripts')}
                                className={clsx(
                                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all",
                                    activeTab === 'scripts' ? "bg-background text-primary shadow-sm" : "hover:bg-background/50 text-muted-foreground"
                                )}
                            >
                                <BookOpen className="w-4 h-4" /> Guiones
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('tickets')}
                                className={clsx(
                                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all p-relative",
                                    activeTab === 'tickets' ? "bg-background text-primary shadow-sm" : "hover:bg-background/50 text-muted-foreground"
                                )}
                            >
                                <Wrench className="w-4 h-4" /> Historial
                                {recentTickets.length > 0 && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
                                )}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pb-20">
                            {activeTab === 'scripts' ? (
                                <ScriptViewer category={category || ''} objection={currentObjection || null} />
                            ) : activeTab === 'tickets' ? (
                                <div className="space-y-4">
                                    {/* Pending CRM Follow-ups */}
                                    {pendingFollowups.length > 0 && (
                                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm space-y-3">
                                            <h4 className="text-sm font-bold flex items-center gap-2 text-amber-700">
                                                <Clock className="w-4 h-4" /> Seguimientos Hoy
                                            </h4>
                                            <div className="space-y-2">
                                                {pendingFollowups.map((f) => (
                                                    <div key={f.id} className="p-2 bg-white rounded border border-amber-100 text-xs">
                                                        <p className="font-bold text-slate-800">{f.client_reference}</p>
                                                        <p className="text-[10px] text-amber-600 font-medium">
                                                            {new Date(f.scheduled_followup).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* WispHub Tickets */}
                                    <div className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-4">
                                        <h4 className="text-sm font-bold flex items-center gap-2 border-b border-border pb-2">
                                            <Clock className="w-4 h-4 text-blue-500" /> Tickets de WispHub
                                        </h4>

                                        {loadingTickets ? (
                                            <div className="py-12 text-center space-y-3">
                                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                                                <p className="text-xs text-muted-foreground animate-pulse font-bold">Buscando historial en WispHub...</p>
                                            </div>
                                        ) : recentTickets.length === 0 ? (
                                            <div className="py-8 text-center space-y-2 opacity-50">
                                                <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground" />
                                                <p className="text-xs">No hay tickets registrados para este cliente.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {recentTickets.map((ticket, idx) => (
                                                    <div
                                                        key={ticket.id || idx}
                                                        className="p-3 bg-muted/30 rounded-lg border border-border/50 hover:border-blue-500/30 transition-colors"
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className={clsx(
                                                                "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                                                                ticket.id_estado === 3 ? "bg-green-100 text-green-700" :
                                                                    ticket.id_estado === 2 ? "bg-orange-100 text-orange-700" :
                                                                        "bg-blue-100 text-blue-700"
                                                            )}>
                                                                {ticket.nombre_estado}
                                                            </span>
                                                            <div className="flex items-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => refreshSpecificTicket(ticket.id)}
                                                                    className="p-1 hover:bg-white/50 rounded transition-colors text-muted-foreground hover:text-primary"
                                                                    title="Refrescar estado"
                                                                >
                                                                    <RefreshCw className="w-3 h-3" />
                                                                </button>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    #{ticket.id}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs font-bold leading-tight mb-2">{ticket.asunto}</p>
                                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                            <div className="flex flex-col">
                                                                <span className="text-muted-foreground">Técnico:</span>
                                                                <span className="truncate">{ticket.nombre_tecnico}</span>
                                                            </div>
                                                            <div className="flex flex-col text-right">
                                                                <span className="text-muted-foreground">Fecha:</span>
                                                                <span>{new Date(ticket.fecha_creacion).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                        {ticket.id_estado !== 3 && (
                                                            <div className={clsx(
                                                                "mt-2 text-[9px] font-bold flex items-center gap-1",
                                                                ticket.sla_status === 'critico' ? "text-red-500" :
                                                                    ticket.sla_status === 'amarillo' ? "text-amber-500" :
                                                                        "text-green-600"
                                                            )}>
                                                                <Clock className="w-3 h-3" /> Abierto hace {ticket.horas_abierto}h
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
