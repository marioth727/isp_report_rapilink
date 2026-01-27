import { useState, useEffect, useRef } from 'react';
import {
    QrCode,
    Search,
    AlertTriangle,
    Loader2,
    Package,
    History,
    ShieldCheck,
    CheckCircle2,
    ArrowRightLeft,
    Activity,
    Save,
    Plus,
    Camera,
    Upload,
    AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/imageUtils';
import { SmartOLTService } from '../lib/smartolt';
import { Modal } from '../components/ui/Modal';
import { AssetHistoryModal } from '../components/operations/AssetHistoryModal';
import clsx from 'clsx';

export default function AssetScanner() {
    const [serial, setSerial] = useState('');
    const [loading, setLoading] = useState(false);
    const [assetData, setAssetData] = useState<any>(null);
    const [smartOltStatus, setSmartOltStatus] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [technicians, setTechnicians] = useState<any[]>([]);

    // Movement Modal State
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [movementType, setMovementType] = useState<'transfer' | 'installation' | 'recovery' | 'defective'>('installation');
    const [isSaving, setIsSaving] = useState(false);

    // Evidence & Upload States
    const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
    const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadTechnicians();
    }, []);

    const loadTechnicians = async () => {
        const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
        if (data) setTechnicians(data);
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const event = new CustomEvent('app:toast', {
            detail: { message, type, duration: 4000 }
        });
        window.dispatchEvent(event);
    };

    const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // 1. Comprimir imagen (Límite 1200px, Calidad 0.7)
            const compressedBlob = await compressImage(file, 1200, 0.7);

            // 2. Previsualización Local
            const reader = new FileReader();
            reader.onloadend = () => setEvidencePreview(reader.result as string);
            reader.readAsDataURL(compressedBlob);

            // 3. Subida a Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `movements/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('movement-evidences') // Bucket dedicado para movimientos
                .upload(filePath, compressedBlob, {
                    contentType: 'image/jpeg'
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('movement-evidences')
                .getPublicUrl(filePath);

            setEvidenceUrl(publicUrl);
            showToast('Evidencia cargada y optimizada', 'success');
        } catch (error: any) {
            console.error('Error uploading evidence:', error);
            showToast('Error al subir evidencia. Verifica el bucket "movement-evidences"', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!serial) return;

        setLoading(true);
        setError(null);
        setAssetData(null);
        setSmartOltStatus(null);

        try {
            // 1. Local Search (Slightly more relaxed)
            const { data: asset } = await supabase
                .from('inventory_assets')
                .select(`
          *,
          inventory_items (name, sku),
          profiles!current_holder_id (full_name)
        `)
                .eq('serial_number', serial.trim())
                .maybeSingle();

            if (asset) {
                setAssetData(asset);
            }

            // 2. SmartOLT Synchronous Check (Always Run)
            const oltData = await SmartOLTService.verifyAssetStatus(serial.trim());
            setSmartOltStatus(oltData);

            // 3. Logic: If none found, then show error
            if (!asset && !oltData) {
                setError('El serial no se encuentra ni en inventario local ni en la red (SmartOLT).');
            }

        } catch (err: any) {
            setError('Error al consultar los sistemas. Verifica tu conexión y configuración de API.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleProcessMovement = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!assetData) return;

        setIsSaving(true);
        const formData = new FormData(e.currentTarget);
        const destId = formData.get('destination_id') as string;
        const clientRef = formData.get('client_reference') as string;
        const notes = formData.get('notes') as string;

        try {
            let newStatus = assetData.status;
            let newHolderId = assetData.current_holder_id;
            let newLocation = assetData.current_location;

            if (movementType === 'installation') {
                newStatus = 'installed';
                newLocation = 'CLIENTE SITE';
                newHolderId = null;
            } else if (movementType === 'transfer') {
                newStatus = 'assigned';
                newHolderId = destId;
                newLocation = 'CAMPO';
            } else if (movementType === 'recovery') {
                newStatus = 'warehouse';
                newLocation = 'BODEGA CENTRAL';
                newHolderId = null;
            } else if (movementType === 'defective') {
                newStatus = 'defective';
                newLocation = 'BODEGA DE FALLOS (RMA)';
                newHolderId = null;
            }

            const { data: moveData, error: logError } = await supabase
                .from('inventory_movements')
                .insert({
                    asset_id: assetData.id,
                    origin_holder_id: assetData.current_holder_id,
                    destination_holder_id: newHolderId,
                    movement_type: movementType === 'defective' ? 'recovery_defective' : movementType,
                    client_reference: clientRef,
                    evidence_url: evidenceUrl,
                    notes: notes,
                    defect_details: movementType === 'defective' ? notes : null
                })
                .select()
                .single();

            if (logError) throw logError;

            const { error: assetError } = await supabase
                .from('inventory_assets')
                .update({
                    status: newStatus,
                    current_holder_id: newHolderId,
                    current_location: newLocation,
                    last_movement_id: moveData.id
                })
                .eq('id', assetData.id);

            if (assetError) throw assetError;

            showToast(`Movimiento de ${movementType} procesado con éxito`, 'success');
            setIsMoveModalOpen(false);
            handleSearch();
        } catch (err: any) {
            console.error(err);
            showToast('Error al procesar el movimiento: ' + err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-inner">
                    <QrCode className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-3xl font-black uppercase tracking-tight">Escaneo de Activos</h1>
                <p className="text-muted-foreground font-medium">Valida la trazabilidad técnica y logística al instante.</p>
            </div>

            <form onSubmit={handleSearch} className="relative group">
                <input
                    type="text"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value.toUpperCase())}
                    placeholder="ESCANEÉ O INGRESE EL SERIAL (S/N)..."
                    className="w-full bg-card border-2 border-border rounded-3xl py-6 px-8 text-xl font-black placeholder:text-muted-foreground/50 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all shadow-xl"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-primary text-primary-foreground rounded-2xl shadow-lg shadow-primary/30 hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
                </button>
            </form>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl flex items-center gap-4 animate-in zoom-in-95">
                    <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
                    <p className="text-sm font-bold text-red-500">{error}</p>
                </div>
            )}

            {(assetData || smartOltStatus) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-300">
                    {/* Inventory Side */}
                    <div className={clsx(
                        "bg-card border-2 border-border rounded-[2rem] p-8 space-y-6 relative overflow-hidden shadow-sm transition-all",
                        !assetData && "opacity-60 bg-muted/20"
                    )}>
                        <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                            <Package className="w-32 h-32" />
                        </div>

                        <div className="flex items-center gap-3">
                            <span className={clsx(
                                "px-3 py-1 text-[10px] font-black uppercase rounded-full border",
                                !assetData ? "bg-muted text-muted-foreground border-border" :
                                    assetData.status === 'warehouse' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                        assetData.status === 'assigned' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                            "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
                            )}>
                                {assetData ? `Estado: ${assetData.status}` : 'No en Inventario Local'}
                            </span>
                        </div>

                        <div className="space-y-1">
                            <h3 className="text-2xl font-black text-foreground uppercase leading-tight">
                                {assetData?.inventory_items?.name || 'Equipo Desconocido'}
                            </h3>
                            <p className="text-xs font-bold text-muted-foreground tracking-widest">SKU: {assetData?.inventory_items?.sku || 'N/A'}</p>
                        </div>

                        {assetData ? (
                            <button
                                onClick={() => setIsHistoryModalOpen(true)}
                                className="w-full py-3 bg-secondary/10 border border-secondary/20 rounded-xl text-[10px] font-black uppercase text-secondary-foreground hover:bg-secondary/20 transition-all flex items-center justify-center gap-2"
                            >
                                <History className="w-3 h-3" /> Ver Historial Completo
                            </button>
                        ) : (
                            <button
                                onClick={() => showToast('Funcionalidad de registro rápido próximamente', 'info')}
                                className="w-full py-3 bg-primary/5 border border-primary/20 rounded-xl text-[10px] font-black uppercase text-primary hover:bg-primary/10 transition-all flex items-center justify-center gap-2"
                            >
                                <Plus className="w-3 h-3" /> Registrar en Inventario
                            </button>
                        )}
                    </div>

                    {/* Technical Side (SmartOLT) */}
                    <div className={clsx(
                        "rounded-[2rem] p-8 space-y-6 relative overflow-hidden transition-all border-2 shadow-sm",
                        smartOltStatus
                            ? "border-primary/50 bg-primary/[0.02]"
                            : "border-border bg-muted/20 opacity-60"
                    )}>
                        <div className="absolute top-0 right-0 p-4 opacity-[0.05]">
                            <ShieldCheck className="w-32 h-32 text-primary" />
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-full border border-primary/20">
                                Validación Técnica (Live)
                            </span>
                        </div>

                        {smartOltStatus ? (
                            <>
                                <div className="space-y-1">
                                    <h3 className="text-3xl font-black text-foreground uppercase flex items-center gap-2">
                                        {smartOltStatus.status}
                                        <div className={clsx(
                                            "w-3 h-3 rounded-full animate-pulse",
                                            smartOltStatus.status === 'online' ? "bg-emerald-500" : "bg-red-500"
                                        )} />
                                    </h3>
                                    <p className="text-xs font-bold text-muted-foreground tracking-widest uppercase truncate">
                                        {smartOltStatus.olt_name} • {smartOltStatus.pon_port}
                                    </p>
                                </div>

                                <div className="p-5 bg-card border border-primary/10 rounded-3xl">
                                    <p className="text-[10px] font-black text-primary uppercase mb-2 flex items-center gap-2">
                                        <Activity className="w-3 h-3" /> Nivel de Potencia
                                    </p>
                                    <p className="text-3xl font-black tracking-tighter">
                                        {smartOltStatus.signal_dbm} <span className="text-sm font-bold text-muted-foreground">dBm</span>
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col justify-center items-center text-center space-y-4 py-8">
                                <div className="p-4 bg-muted/50 rounded-full border-2 border-dashed border-border opacity-30">
                                    <AlertTriangle className="w-12 h-12" />
                                </div>
                                <p className="text-[10px] font-black uppercase text-muted-foreground">No detectado en red SmartOLT</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Action Buttons (Only if in inventory or found in OLT) */}
            {(assetData || smartOltStatus) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                    <button
                        disabled={!assetData}
                        onClick={() => {
                            setMovementType('transfer');
                            setEvidencePreview(null);
                            setEvidenceUrl(null);
                            setIsMoveModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-3 px-6 py-4 bg-card border-2 border-border rounded-2xl text-[10px] font-black uppercase hover:bg-muted transition-all group disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ArrowRightLeft className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                        Transferir a Técnico
                    </button>

                    <button
                        disabled={!assetData}
                        onClick={() => {
                            setMovementType('installation');
                            setEvidencePreview(null);
                            setEvidenceUrl(null);
                            setIsMoveModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-3 px-6 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        Registrar Instalación
                    </button>

                    <button
                        disabled={!assetData}
                        onClick={() => {
                            setMovementType('recovery');
                            setEvidencePreview(null);
                            setEvidenceUrl(null);
                            setIsMoveModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-3 px-6 py-4 bg-card border-2 border-border rounded-2xl text-[10px] font-black uppercase hover:border-amber-500/50 hover:text-amber-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <History className="w-4 h-4" />
                        Recuperar Bueno
                    </button>

                    <button
                        disabled={!assetData}
                        onClick={() => {
                            setMovementType('defective');
                            setEvidencePreview(null);
                            setEvidenceUrl(null);
                            setIsMoveModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-3 px-6 py-4 bg-card border-2 border-red-500/20 text-red-500 rounded-2xl text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed sm:col-span-2 lg:col-span-1"
                    >
                        <AlertCircle className="w-4 h-4" />
                        Reportar Falla
                    </button>
                </div>
            )}

            {/* Manual Registration Suggestion */}
            {!assetData && smartOltStatus && (
                <div className="bg-primary/5 border border-primary/20 p-6 rounded-[2rem] text-center space-y-3">
                    <p className="text-xs font-bold text-foreground">
                        Este equipo se encuentra en la **red activa (SmartOLT)** pero no está en tu **inventario local**.
                    </p>
                    <p className="text-[10px] font-black text-muted-foreground uppercase">
                        Te recomendamos registrarlo para empezar su trazabilidad.
                    </p>
                </div>
            )}

            {/* Movement Modal */}
            <Modal
                isOpen={isMoveModalOpen}
                onClose={() => setIsMoveModalOpen(false)}
                title={
                    movementType === 'transfer' ? "Transferir Activo" :
                        movementType === 'installation' ? "Instalación en Cliente" :
                            movementType === 'defective' ? "Reportar Falla Técnica (RMA)" :
                                "Recuperación / Devolución"
                }
            >
                <form onSubmit={handleProcessMovement} className="space-y-6">
                    {movementType === 'transfer' && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Seleccionar Técnico Destino</label>
                            <select name="destination_id" required className="w-full bg-muted/30 border border-border rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary outline-none">
                                <option value="">Seleccionar...</option>
                                {technicians.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                            </select>
                        </div>
                    )}

                    {movementType === 'installation' && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Referencia / ID de Cliente</label>
                            <input name="client_reference" placeholder="Ej: Servicio #12345 o Nombre" required className="w-full bg-muted/30 border border-border rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary outline-none" />
                        </div>
                    )}

                    {/* Evidence Upload */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Evidencia Fotográfica (Opcional)</label>
                        <div className="flex items-center gap-4 p-4 bg-muted/20 border-2 border-dashed border-border rounded-2xl group hover:bg-muted/30 transition-all">
                            <div className="w-16 h-16 bg-card rounded-xl border border-border flex items-center justify-center overflow-hidden shrink-0">
                                {evidencePreview ? (
                                    <img src={evidencePreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <Camera className="w-6 h-6 text-muted-foreground/30" />
                                )}
                            </div>
                            <div className="flex-1">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-lg border border-primary/20 hover:bg-primary/20 transition-all flex items-center gap-2"
                                >
                                    <Upload className="w-3 h-3" /> {uploading ? 'Comprimiendo...' : 'Subir Foto'}
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleEvidenceUpload}
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                />
                                <p className="text-[9px] text-muted-foreground mt-1">La foto se comprimirá automáticamente.</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Notas del Movimiento</label>
                        <textarea name="notes" className="w-full bg-muted/30 border border-border rounded-xl p-3 text-sm focus:ring-1 focus:ring-primary outline-none h-24" placeholder="Detalles adicionales..." />
                    </div>

                    <div className="flex gap-3">
                        <button type="button" onClick={() => setIsMoveModalOpen(false)} className="flex-1 py-4 bg-muted rounded-xl text-xs font-black uppercase">Cancelar</button>
                        <button type="submit" disabled={isSaving || uploading} className="flex-1 py-4 bg-primary text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Confirmar
                        </button>
                    </div>
                </form>
            </Modal>

            <AssetHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                assetId={assetData?.id}
                serialNumber={assetData?.serial_number}
            />
        </div>
    );
}
