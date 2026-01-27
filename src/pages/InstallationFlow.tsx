import { useState, useEffect, useRef } from 'react';
import {
    Camera,
    Scan,
    Wifi,
    ChevronRight,
    ChevronLeft,
    CheckCircle2,
    Loader2,
    X,
    Smartphone,
    Check,
    Save,
    MapPin,
    Search,
    RefreshCw,
    MoreHorizontal
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import SignatureCanvas from 'react-signature-canvas';
import { compressImage } from '../lib/imageUtils';
import { WisphubService } from '../lib/wisphub';
import { SmartOLTService } from '../lib/smartolt';
import clsx from 'clsx';

type Step = 'FORM' | 'HARDWARE' | 'EVIDENCE' | 'SIGNATURE' | 'FINISH';

interface InstallationData {
    // Datos del Cliente
    nombre: string;
    apellido: string;
    dni: string;
    email: string;
    direccion: string;
    barrio: string;
    telefono: string;
    ciudad: string;
    coordenadas: string;
    forma_contratacion: string;
    costo: string;
    comentarios: string;
    // Datos de Conexión
    ip: string;
    router: string;
    plan: string;
    sectorial: string;
    zona: string;
    // Hardware
    sn: string;
    mac: string;
    // IDs de WispHub
    id_plan: string | number;
    id_router: string | number;
    id_sector: string | number;
    // Credenciales PPPoE
    usuario_rb: string;
    password_rb: string;
}

interface Evidence {
    id: string;
    title: string;
    captured: boolean;
    image?: string;
    required: boolean;
}

export default function InstallationFlow() {
    const [currentStep, setCurrentStep] = useState<Step>('FORM');
    const [formData, setFormData] = useState<InstallationData>({
        nombre: '', apellido: '', dni: '', email: '', direccion: '', barrio: '',
        ciudad: 'Soledad', telefono: '', coordenadas: '', forma_contratacion: '3', // 3 = Oficina
        costo: '50000', comentarios: '', ip: '', router: '', plan: '', sectorial: '',
        zona: '', sn: '', mac: '',
        id_plan: '', id_router: '', id_sector: '',
        usuario_rb: '', password_rb: ''
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [installations, setInstallations] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedInstallId, setSelectedInstallId] = useState<string | null>(null);

    const [plans, setPlans] = useState<any[]>([]);
    const [routers, setRouters] = useState<any[]>([]);
    const [sectors, setSectors] = useState<any[]>([]);
    const [oltData, setOltData] = useState<any>(null); // Datos escaneados de OLT

    // INFO: Signal Data y Justification eliminados

    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [regLoading, setRegLoading] = useState(false);
    const [regError, setRegError] = useState<string | null>(null);
    const [regInfo, setRegInfo] = useState<string | null>(null); // Estado para mensajes informativos (Azul)
    const [successData, setSuccessData] = useState<any>(null);
    const [installationStatus] = useState<string>('1'); // Default: 1 (Nueva) - Removed unused setter
    const [selectedBrand, setSelectedBrand] = useState<string>('ZTE'); // Default Brand

    const BRANDS = ['HUAWEI', 'ZTE', 'C-DATA', 'LATIC', 'EASY4 LINK', 'VSOL'];

    const [evidences, setEvidences] = useState<Evidence[]>([
        { id: 'nap', title: 'Caja NAP', captured: false, required: true },
        { id: 'router', title: 'Router (Etiqueta)', captured: false, required: true },
        { id: 'vivienda', title: 'Fachada Vivienda', captured: false, required: true },
        { id: 'cedula_f', title: 'Cédula Frontal', captured: false, required: true },
    ]);



    const sigPad = useRef<SignatureCanvas>(null);
    useEffect(() => {
        WisphubService.getInternetPlans().then(setPlans);
        WisphubService.getRouters().then(setRouters);
    }, []);

    // Actualizar sectores al cambiar router (Simulado, ya que getSectors devuelve todo)
    useEffect(() => {
        if (formData.id_router) {
            WisphubService.getSectors().then(setSectors);
        } else {
            setSectors([]);
        }
    }, [formData.id_router]);

    // Limpiar errores y avisos al cambiar de paso
    useEffect(() => {
        setRegError(null);
        setRegInfo(null);
    }, [currentStep]);

    // Scanner logic (placeholder for existing scanner effect)

    // Scanner
    useEffect(() => {
        if (isScannerOpen) {
            const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
            scanner.render((decodedText) => {
                const text = decodedText.trim().toUpperCase();

                // 1. Detección de código de inventario (con guiones)
                if (text.includes('-') && text.length > 10) {
                    alert('⚠️ HAS ESCANEADO EL SERIAL DE FÁBRICA.\n\nEste código NO sirve para la OLT.\nBusca la etiqueta "P-SN" o "GPON-SN" (ej: CDTC..., ZTE..., HWTC...)');
                    return; // No cerrar escáner, dejar que intente de nuevo
                }

                // 2. Detección de MAC (contiene :)
                if (text.includes(':')) {
                    if (confirm('⚠️ Parece que escaneaste una MAC Address.\n\n¿Quieres usarla en el campo "MAC Bridge"?\n(Si buscas el Serial, dale Cancelar y sigue buscando)')) {
                        setFormData(prev => ({ ...prev, mac: text }));
                        setIsScannerOpen(false);
                        scanner.clear();
                    }
                    return;
                }

                // 3. Validación de Formato GPON (4 letras + 8 hex o similar)
                // Ej: CDTCAFB2BE7B (12 chars) o ALCLF... (12 chars)
                const gponPattern = /^[A-Z]{4}[0-9A-F]{8}$/;

                // Si cumple patrón exacto O al menos parece un serial válido (sin guiones, largo razonable)
                if (gponPattern.test(text) || (text.length >= 10 && text.length <= 16 && /^[A-Z0-9]+$/.test(text))) {
                    setFormData(prev => ({ ...prev, sn: text }));
                    setIsScannerOpen(false);
                    scanner.clear();
                    // Feedback sonoro/visual
                    // alert(`✅ Serial detectado: ${text}`);
                } else {
                    alert(`⚠️ CÓDIGO SOSPECHOSO: ${text}\n\nLos seriales de PON suelen tener 12-16 caracteres (ej: CDTCAFB2BE7B).\nVerifica que sea el "P-SN".`);
                }

            }, console.error);
            return () => { scanner.clear().catch(console.error); };
        }
    }, [isScannerOpen]);

    const handleSearch = async () => {
        if (!searchQuery) return;
        setSearching(true);
        try {
            const results = await WisphubService.searchClients(searchQuery);
            // Mapear WispHubClient a formato esperado por handleSelectInstallation
            const mappedResults = results.map(c => ({
                id: c.id_servicio,
                cliente_nombre: c.nombre,
                telefono: c.telefono || '',
                direccion: c.cedula || '', // Usamos cedula temporalmente si no hay direccion en lista simple
                colonia: '',
                ciudad: c.ip || '',
                coordenadas: '',
                ip: c.ip,
                sn_onu: '',
                mac_cpe: '',
                comentarios: '',
                plan_internet: c.plan_internet?.nombre || '',
                server_control: '',
                sector: ''
            }));
            setInstallations(mappedResults);
        } catch (e) {
            console.error(e);
        } finally {
            setSearching(false);
        }
    };

    const handleSelectInstallation = (inst: any) => {
        setSelectedInstallId(inst.id);
        const [nombre, ...apellidoParts] = (inst.cliente_nombre || '').split(' ');
        setFormData({
            ...formData,
            nombre: nombre || '',
            apellido: apellidoParts.join(' ') || '',
            telefono: inst.telefono || '',
            direccion: inst.direccion || '',
            barrio: inst.colonia || '',
            ciudad: inst.ciudad || 'Soledad',
            coordenadas: inst.coordenadas || '',
            ip: inst.ip || '',
            sn: inst.sn_onu || '',
            mac: inst.mac_cpe || '',
            comentarios: inst.comentarios || '',
            id_plan: inst.plan_internet || '',
            id_router: inst.server_control || '',
            id_sector: inst.sector || ''
        });
    };

    const handleGPS = () => {
        navigator.geolocation.getCurrentPosition(pos => {
            setFormData(prev => ({ ...prev, coordenadas: `${pos.coords.latitude},${pos.coords.longitude}` }));
        });
    };

    const handlePhotoCapture = async (id: string) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = async (e: any) => {
            if (e.target.files?.[0]) {
                const rawFile = e.target.files[0];
                const compressed = await compressImage(rawFile);
                // @ts-ignore
                setEvidences(prev => prev.map(ev => ev.id === id ? { ...ev, captured: true, image: compressed, rawFile: rawFile } : ev));
            }
        };
        input.click();
    };

    const handleReadOLTPort = async () => {
        setSearching(true);
        setRegError(null);
        setRegInfo(null);
        try {
            // Normalizar lo que buscamos (e.g. convertir raw hex a CDTC...)
            const searchSN = formData.sn ? SmartOLTService.normalizeSerialNumber(formData.sn).trim().toUpperCase() : '';

            console.log('[DEBUG] Buscando SN:', searchSN);

            if (!searchSN) {
                setRegError('Por favor escanee o ingrese un Serial Number primero.');
                setSearching(false);
                return;
            }

            // 1. Buscar en NO CONFIGURADOS
            const unconfigured = await SmartOLTService.getUnconfiguredOnus();
            console.log('[DEBUG] Unconfigured List:', unconfigured);

            // Búsqueda Robusta: Normalizamos también los SN que vienen de la OLT por si vienen en Hex
            let match = unconfigured.find(o => {
                const norm = SmartOLTService.normalizeSerialNumber(o.sn).trim().toUpperCase();
                return norm === searchSN || norm.includes(searchSN);
            });

            let statusMsg = '';

            // 2. Si no es nuevo, buscar en CONFIGURADOS
            if (!match) {
                const configured = await SmartOLTService.verifyAssetStatus(searchSN);
                if (configured) {
                    match = { sn: configured.sn, mac: (configured as any).mac || "" };
                    statusMsg = 'Equipo RECONOCIDO (Activo en OLT)';
                }
            } else {
                statusMsg = 'Equipo NUEVO detectado en OLT';
            }

            if (match) {
                console.log('[DEBUG] Match Found:', match);
                setFormData(prev => ({
                    ...prev,
                    mac: match.mac || prev.mac,
                    sn: match.sn // Usamos el SN tal como viene de la OLT
                }));

                if (!match.mac) {
                    // INFO: Mensaje informativo (Azul) en lugar de error
                    setRegInfo(`${statusMsg}. La OLT no retornó la MAC (normal en nuevos), por favor ingrésela manualmente de la etiqueta.`);
                } else {
                    setRegInfo(null);
                    alert(`${statusMsg}. Datos sincronizados.`);
                }
            } else {
                // NO DETECTADO: Aviso informativo amarillo/azul
                setRegInfo(`Aviso: Equipo no detectado en OLT (${searchSN}). Puede continuar si el tendido está en proceso.`);
                console.warn('[DEBUG] No match found, permitting continuation.');
            }
        } catch (e) {
            console.error('[ERROR] Read OLT:', e);
            setRegError('Error de conexión con OLT. Ingrese datos manualmente.');
        } finally {
            setSearching(false);
        }
    };

    const handleFinalRegister = async () => {
        setRegLoading(true);
        setRegError(null);
        try {
            const result = await WisphubService.createInstallation({
                ...formData,
                id_zona: formData.id_router,
                estado_instalacion: installationStatus
            });

            if (result.success && result.data?.id_servicio) {
                console.log('[DEBUG] Datos de éxito recibidos:', result.data);

                let authMessage = '';

                // Autorizar en SmartOLT
                if (oltData && !oltData.is_configured) {
                    try {
                        const authResult = await SmartOLTService.authorizeOnu({
                            olt_id: 1,
                            board: oltData.pon_port.split('/')[0] || 1,
                            port: oltData.pon_port.split('/')[1] || oltData.pon_port,
                            sn: formData.sn,
                            onu_type: selectedBrand, // USER SELECTED BRAND
                            zone_id: formData.id_sector,
                            name: `${formData.nombre} ${formData.apellido}`,
                            external_id: result.data.id_servicio
                        });

                        if (authResult.status) authMessage = '\n✅ SmartOLT: ONU Autorizada Correctamente.';
                        else authMessage = `\n⚠️ SmartOLT Error: ${authResult.message}`;
                    } catch (authErr: any) {
                        authMessage = `\n⚠️ SmartOLT Failed: ${authErr.message}`;
                    }
                }

                setSuccessData({ ...result.data, auth_message: authMessage });
                setCurrentStep('FINISH');
            } else {
                console.error('[ERROR] WispHub:', result.message);
                setRegError(result.message || 'Error desconocido al registrar en WispHub');
            }
        } catch (e: any) {
            console.error('[EXCEPTION]', e);
            setRegError(e.message || 'Error de conexión');
        } finally {
            setRegLoading(false);
        }
    };

    const isStepValid = (step: Step) => {
        switch (step) {
            case 'FORM':
                return !!(formData.id_router && formData.id_sector && formData.id_plan && formData.nombre && formData.dni && formData.coordenadas);
            case 'HARDWARE':
                return !!formData.sn;
            case 'EVIDENCE':
                return !evidences.some(e => e.required && !e.captured);
            case 'SIGNATURE':
                return true;
            default:
                return true;
        }
    };

    const steps: Step[] = ['FORM', 'HARDWARE', 'EVIDENCE', 'SIGNATURE', 'FINISH'];
    const currentStepIndex = steps.indexOf(currentStep);

    const handleNext = () => {
        if (currentStep === 'SIGNATURE') {
            handleFinalRegister();
            return;
        }
        if (currentStepIndex < steps.length - 1) {
            setCurrentStep(steps[currentStepIndex + 1]);
            window.scrollTo(0, 0);
        }
    };

    const handleBack = () => {
        if (currentStepIndex > 0) {
            setCurrentStep(steps[currentStepIndex - 1]);
            window.scrollTo(0, 0);
        }
    };

    const saveDraft = () => {
        localStorage.setItem('installation_draft', JSON.stringify({ formData, evidences }));
        alert('Borrador guardado');
    };

    return (
        <div className="min-h-screen bg-background pb-32 animate-in fade-in duration-500">
            {/* Header Sticky con Stepper */}
            <div className="p-4 border-b border-border bg-card/60 backdrop-blur-2xl sticky top-0 z-50">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-zinc-900 flex items-center justify-center text-white shadow-sm">
                            <Smartphone size={16} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold tracking-tight text-zinc-900 leading-none">Asistente</h1>
                            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mt-1">Gestión de Campo</p>
                        </div>
                    </div>
                    <button onClick={saveDraft} className="h-8 px-3 rounded-md bg-white border border-zinc-200 text-[10px] font-bold uppercase text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center gap-2 shadow-sm">
                        <Save size={13} strokeWidth={2.5} /> Borrador
                    </button>
                </div>

                {/* STEPPER MINIMALISTA SOLO TEXTO / INDICADOR */}
                <div className="relative px-2">
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-zinc-100 -translate-y-1/2 z-0" />
                    <div className="relative z-10 flex justify-between">
                        {steps.map((step, idx) => (
                            <div key={step} className={clsx("flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border",
                                idx === currentStepIndex ? "bg-zinc-900 border-zinc-900 text-white shadow-md" :
                                    idx < currentStepIndex ? "bg-white border-emerald-500 text-emerald-600" :
                                        "bg-white border-zinc-200 text-zinc-400"
                            )}>
                                {idx < currentStepIndex ? <Check size={10} strokeWidth={4} /> :
                                    <span className="text-[10px] font-bold">{idx + 1}</span>}
                                {idx === currentStepIndex && (
                                    <span className="text-[10px] font-bold uppercase tracking-wide">
                                        {step === 'FORM' ? 'Inicio' : step === 'HARDWARE' ? 'Equipos' : step === 'EVIDENCE' ? 'Fotos' : step === 'SIGNATURE' ? 'Firma' : 'Fin'}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Contenido Principal */}
            <div className="max-w-xl mx-auto p-4 space-y-6">
                {currentStep === 'FORM' && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-1">
                            <h2 className="text-xl font-black uppercase tracking-tighter text-foreground">Alistamiento</h2>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest italic">Completa todas las secciones</p>
                        </div>

                        {/* Buscador Refinado */}
                        <div className="flex gap-3">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar por cédula o nombre..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                    className="w-full bg-white border border-zinc-200 pl-11 pr-4 py-3 rounded-lg text-xs font-medium outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 transition-all text-zinc-900 placeholder:text-zinc-400 uppercase"
                                />
                            </div>
                            <button onClick={handleSearch} disabled={searching} className="px-6 bg-zinc-900 text-white rounded-lg font-bold uppercase text-[10px] tracking-wider hover:bg-zinc-800 active:scale-95 transition-all shadow-sm">
                                {searching ? <Loader2 size={14} className="animate-spin" /> : 'Buscar'}
                            </button>
                        </div>

                        {installations.length > 0 && (
                            <div className="space-y-2 max-h-56 overflow-y-auto p-2 bg-zinc-50 rounded-xl border border-zinc-200 animate-in fade-in">
                                {installations.map(inst => (
                                    <button key={inst.id} onClick={() => handleSelectInstallation(inst)} className={clsx("w-full text-left p-3 rounded-lg border transition-all flex justify-between items-center group", selectedInstallId === inst.id ? "border-zinc-900 bg-white ring-1 ring-zinc-900" : "bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-sm")}>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">ID: {inst.id}</p>
                                            <p className="text-xs font-bold uppercase text-zinc-900 group-hover:text-black">{inst.cliente_nombre}</p>
                                        </div>
                                        <ChevronRight size={14} className={clsx("text-zinc-300 transition-transform", selectedInstallId === inst.id && "translate-x-1 text-zinc-900")} />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* SECCIONES LINEALES DENSAS */}
                        <div className="space-y-5">
                            {/* SECCIÓN RED - Minimalist */}
                            <div className="p-6 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-4">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2 pb-2 border-b border-zinc-100">
                                    <Wifi size={14} /> Red & Servidor
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase text-zinc-600 ml-1">Router MikroTik</label>
                                        <select value={formData.id_router} onChange={e => setFormData({ ...formData, id_router: e.target.value, id_sector: e.target.value })} className="w-full bg-white border border-zinc-200 p-3 rounded-lg text-xs font-medium uppercase focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 outline-none transition-all appearance-none cursor-pointer hover:border-zinc-300">
                                            <option value="">Seleccionar...</option>
                                            {routers.map(r => <option key={r.id || r.id_router} value={r.id || r.id_router}>{r.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold uppercase text-zinc-600 ml-1">Zona</label>
                                            <select value={formData.id_sector} onChange={e => setFormData({ ...formData, id_sector: e.target.value })} className="w-full bg-white border border-zinc-200 p-3 rounded-lg text-xs font-medium uppercase focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 outline-none transition-all appearance-none cursor-pointer hover:border-zinc-300">
                                                <option value="">Zona...</option>
                                                {sectors.map(s => <option key={s.id || s.id_sector} value={s.id || s.id_sector}>{s.nombre_sector || s.nombre}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold uppercase text-zinc-600 ml-1">Plan</label>
                                            <select value={formData.id_plan} onChange={e => setFormData({ ...formData, id_plan: e.target.value })} className="w-full bg-white border border-zinc-200 p-3 rounded-lg text-xs font-medium uppercase focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 outline-none transition-all appearance-none cursor-pointer hover:border-zinc-300">
                                                <option value="">Plan...</option>
                                                {plans.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECCIÓN CLIENTE - Minimalist */}
                            <div className="p-6 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-4">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2 pb-2 border-b border-zinc-100">
                                    <Smartphone size={14} /> Información del Cliente
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <InputField label="Nombres" value={formData.nombre} onChange={(v: string) => setFormData({ ...formData, nombre: v })} />
                                        <InputField label="Apellidos" value={formData.apellido} onChange={(v: string) => setFormData({ ...formData, apellido: v })} />
                                    </div>
                                    <InputField label="Email" value={formData.email} onChange={(v: string) => setFormData({ ...formData, email: v })} placeholder="cliente@ejemplo.com" />
                                    <div className="grid grid-cols-2 gap-4">
                                        <InputField label="DNI / Cédula" value={formData.dni} onChange={(v: string) => setFormData({ ...formData, dni: v })} />
                                        <InputField label="Celular" value={formData.telefono} onChange={(v: string) => setFormData({ ...formData, telefono: v })} />
                                    </div>
                                    <InputField label="Barrio / Sector" value={formData.barrio} onChange={(v: string) => setFormData({ ...formData, barrio: v })} />
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase text-zinc-600 ml-1">Dirección Exacta</label>
                                        <textarea value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} className="w-full bg-white border border-zinc-200 p-3 rounded-lg text-xs font-medium uppercase outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 transition-all min-h-[70px] placeholder:text-zinc-300" />
                                    </div>
                                    <div className="relative">
                                        <InputField label="Coordenadas GPS" value={formData.coordenadas} onChange={(v: string) => setFormData({ ...formData, coordenadas: v })} />
                                        <button onClick={handleGPS} className="absolute right-3 bottom-2 p-2 bg-zinc-100 text-zinc-600 rounded-md hover:bg-zinc-200 transition-all" title="Capturar GPS">
                                            <MapPin size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* SECCIÓN CONEXIÓN - Minimalist */}
                            <div className="p-6 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-4">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2 pb-2 border-b border-zinc-100">
                                    <MoreHorizontal size={14} /> Detalles Técnicos
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <InputField label="Dirección IP" value={formData.ip} onChange={(v: string) => setFormData({ ...formData, ip: v })} />
                                        <InputField label="Costo" value={formData.costo} onChange={(v: string) => setFormData({ ...formData, costo: v })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase text-zinc-600 ml-1">Observaciones</label>
                                        <textarea value={formData.comentarios} onChange={e => setFormData({ ...formData, comentarios: e.target.value })} className="w-full bg-white border border-zinc-200 p-3 rounded-lg text-xs font-medium uppercase outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 transition-all min-h-[70px] placeholder:text-zinc-300" placeholder="Ej: NAP llena, cable extra..." />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 'HARDWARE' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                        <div className="space-y-1 text-center">
                            <h2 className="text-xl font-bold tracking-tight text-zinc-900">Sincronización</h2>
                            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">SmartOLT Link</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <button onClick={() => setIsScannerOpen(true)} className="p-10 border border-zinc-200 rounded-2xl bg-white hover:bg-zinc-50 transition-all group flex flex-col items-center gap-3 shadow-sm hover:shadow-md hover:border-zinc-300">
                                <div className="p-4 bg-zinc-100 rounded-full group-hover:scale-110 transition-transform text-zinc-700">
                                    <Scan size={32} strokeWidth={1.5} />
                                </div>
                                <div className="text-center">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 block">Escanear SN ONU</span>
                                    {formData.sn && <p className="font-mono font-bold text-emerald-600 mt-2 text-sm tracking-tight bg-emerald-50 px-3 py-1 rounded-md border border-emerald-100 inline-block">{formData.sn}</p>}
                                </div>
                            </button>

                            <div className="p-6 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-5 relative overflow-hidden">
                                <div className="flex items-center justify-between border-b border-zinc-50 pb-4">
                                    <div className="space-y-1 flex-1">
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">MAC BRIDGE</p>
                                        <input
                                            type="text"
                                            value={formData.mac}
                                            onChange={(e) => setFormData({ ...formData, mac: e.target.value.toUpperCase() })}
                                            placeholder="--:--:--:--:--:--"
                                            className="w-full bg-transparent text-xl font-bold font-mono tracking-tight text-zinc-900 leading-none outline-none border-none p-0 placeholder:text-zinc-200 uppercase"
                                        />
                                    </div>
                                    <div className={clsx("px-3 py-1 rounded-full text-[10px] font-bold uppercase border", formData.mac ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-zinc-50 text-zinc-400 border-zinc-100")}>
                                        {formData.mac ? 'Conectado' : 'Pendiente'}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase text-zinc-600 ml-1 tracking-wide">Marca / Modelo</label>
                                    <select
                                        value={selectedBrand}
                                        onChange={e => setSelectedBrand(e.target.value)}
                                        className="w-full bg-white border border-zinc-200 p-3 rounded-lg text-xs font-medium uppercase outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 transition-all appearance-none cursor-pointer hover:border-zinc-300"
                                    >
                                        {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        disabled={searching}
                                        className="flex-1 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] font-bold uppercase text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 transition-all shadow-sm flex items-center justify-center gap-2"
                                        onClick={handleReadOLTPort}
                                    >
                                        {searching ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} strokeWidth={2} />}
                                        Leer OLT
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 'EVIDENCE' && <EvidencesView evidences={evidences} onCapture={handlePhotoCapture} />}

                {currentStep === 'SIGNATURE' && <SignatureView sigPad={sigPad} clientName={formData.nombre} />}
                {currentStep === 'FINISH' && <FinishView onDone={() => { localStorage.removeItem('installation_draft'); window.location.href = '/'; }} successData={successData} />}

                {/* INFO (AZUL / AMARILLO) */}
                {regInfo && (
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl animate-in fade-in zoom-in-95 mt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-full text-blue-500 flex-shrink-0 animate-bounce"><Wifi size={16} /></div>
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-tight leading-4">{regInfo}</p>
                        </div>
                    </div>
                )}

                {/* ERROR (ROJO) */}
                {regError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in fade-in zoom-in-95 mt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-500/20 rounded-full text-red-500 flex-shrink-0 animate-shake"><X size={16} /></div>
                            <p className="text-[10px] font-black uppercase text-red-500 tracking-tight leading-4">{regError}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* BARRA DE NAVEGACIÓN INFERIOR (Floating Island Clean) */}
            {currentStep !== 'FINISH' && (
                <div className="sticky bottom-6 z-[60] mt-10">
                    <div className="max-w-xl mx-auto px-4">
                        <div className="bg-white/95 backdrop-blur-xl border border-zinc-200 p-2 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex gap-3">
                            {currentStepIndex > 0 && (
                                <button
                                    onClick={handleBack}
                                    className="px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-zinc-100 hover:border-zinc-300 transition-all text-zinc-600 shadow-sm"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                            )}
                            <button
                                disabled={!isStepValid(currentStep) || regLoading}
                                onClick={handleNext}
                                className={clsx(
                                    "flex-1 py-3.5 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all shadow-sm",
                                    (isStepValid(currentStep) && !regLoading)
                                        ? "bg-zinc-900 text-white hover:bg-black hover:shadow-lg hover:shadow-zinc-900/20 active:scale-[0.98]"
                                        : "bg-zinc-100 text-zinc-300 border border-zinc-100 cursor-not-allowed"
                                )}
                            >
                                {regLoading ? <Loader2 size={16} className="animate-spin" /> : (
                                    <>
                                        {currentStep === 'SIGNATURE' ? 'Registrar Activación' : 'Siguiente Paso'}
                                        <ChevronRight size={16} />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scanner Overlay */}
            {isScannerOpen && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
                    <button onClick={() => setIsScannerOpen(false)} className="absolute top-10 right-6 p-3 bg-white/10 rounded-full text-white"><X size={28} /></button>
                    <div id="reader" className="w-full max-w-xs rounded-3xl overflow-hidden border-2 border-primary/50 bg-white" />
                    <div className="mt-8 text-center space-y-1.5">
                        <p className="text-white text-lg font-black uppercase tracking-tighter italic">Buscando QR/SN</p>
                        <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest">Escanea la etiqueta del equipo</p>
                    </div>
                </div>
            )}
        </div>
    );
}

interface InputFieldProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
}

function InputField({ label, value, onChange, placeholder }: InputFieldProps) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-zinc-600 ml-1 tracking-wide">{label}</label>
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-white border border-zinc-200 p-3 rounded-lg text-xs font-medium uppercase outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100 transition-all placeholder:text-zinc-300"
            />
        </div>
    );
}

interface EvidencesViewProps {
    evidences: Evidence[];
    onCapture: (id: string) => void;
}

function EvidencesView({ evidences, onCapture }: EvidencesViewProps) {
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="text-center space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-zinc-900">Evidencias</h2>
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Documentación necesaria</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
                {evidences.map((ev) => (
                    <button key={ev.id} onClick={() => onCapture(ev.id)} className={clsx("aspect-square rounded-xl border flex flex-col items-center justify-center gap-3 relative overflow-hidden shadow-sm transition-all group", ev.captured ? "border-emerald-200 bg-emerald-50" : "bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-md")}>
                        {ev.image ? <img src={ev.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" /> : <Camera size={24} strokeWidth={1.5} className="text-zinc-300 group-hover:text-zinc-400 group-hover:scale-110 transition-transform" />}
                        <p className={clsx("relative z-10 text-[10px] font-bold uppercase text-center px-2", ev.captured ? "text-emerald-900" : "text-zinc-500")}>{ev.title}</p>
                        {ev.captured && <CheckCircle2 size={18} className="text-emerald-500 relative z-10 drop-shadow-sm" />}
                    </button>
                ))}
            </div>
        </div>
    );
}



interface SignatureViewProps {
    sigPad: React.RefObject<SignatureCanvas | null>;
    clientName: string;
}

function SignatureView({ sigPad, clientName }: SignatureViewProps) {
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="text-center space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-zinc-900">Aceptación</h2>
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">{clientName || 'Cliente'}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-zinc-200 h-64 relative shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <SignatureCanvas ref={sigPad} penColor='black' canvasProps={{ width: 500, height: 200, className: 'sigCanvas w-full h-full' }} />
                <button onClick={() => sigPad?.current?.clear()} className="absolute top-4 right-4 text-[10px] font-bold uppercase px-3 py-1.5 bg-zinc-50 border border-zinc-100 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-red-50 transition-colors">Limpiar</button>
                <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none opacity-20">
                    <p className="text-[10px] font-black uppercase text-zinc-300">Área de Firma</p>
                </div>
            </div>
            <p className="text-[10px] text-center text-zinc-400 px-6 uppercase font-medium leading-relaxed">Al firmar, el cliente acepta la correcta instalación y funcionamiento del servicio.</p>
        </div>
    );
}

interface FinishViewProps {
    onDone: () => void;
    successData?: any;
}

function FinishView({ onDone, successData }: FinishViewProps) {
    return (
        <div className="text-center py-10 space-y-6 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto shadow-sm animate-bounce"><Check size={40} strokeWidth={2.5} /></div>
            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Sincronización Exitosa</h2>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest px-8 leading-relaxed">Los datos se han registrado correctamente en WispHub y SmartOLT.</p>
            </div>

            {successData && (
                <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-200 text-left space-y-2 text-xs font-mono break-all animate-in fade-in slide-in-from-bottom-2 shadow-inner text-zinc-600">
                    <p className="font-bold text-zinc-400 uppercase text-[10px]">Respuesta del Servidor</p>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(successData, null, 2)}</pre>
                </div>
            )}

            <button onClick={onDone} className="w-full max-w-xs px-8 py-4 bg-zinc-900 text-white font-bold uppercase text-xs rounded-xl shadow-lg shadow-zinc-900/10 hover:scale-[1.02] active:scale-95 transition-all outline-none focus:ring-4 focus:ring-zinc-100">
                Regresar al Panel
            </button>
        </div>
    );
}


