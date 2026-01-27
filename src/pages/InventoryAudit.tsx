import { useState, useEffect, useCallback } from 'react';
import {
    ClipboardCheck,
    Users,
    QrCode,
    Search,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Loader2,
    ChevronRight,
    Save,
    History
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AssetHistoryModal } from '../components/operations/AssetHistoryModal';
import clsx from 'clsx';

interface AuditItem {
    id: string;
    serial_number: string;
    item_name: string;
    expected_status: string;
    found_status: 'pending' | 'found' | 'missing' | 'unexpected';
    scanned_at?: string;
}

export default function InventoryAudit() {
    const [step, setStep] = useState<'selection' | 'scanning' | 'review'>('selection');
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [selectedTech, setSelectedTech] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // History Modal
    const [selectedAssetForHistory, setSelectedAssetForHistory] = useState<any>(null);

    // Audit State
    const [expectedAssets, setExpectedAssets] = useState<AuditItem[]>([]);
    const [scannedSerials, setScannedSerials] = useState<string[]>([]);
    const [manualSerial, setManualSerial] = useState('');
    const [auditSummary, setAuditSummary] = useState({ found: 0, missing: 0, unexpected: 0 });

    useEffect(() => {
        loadTechnicians();
    }, []);

    const loadTechnicians = async () => {
        setLoading(true);
        const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
        if (data) setTechnicians(data);
        setLoading(false);
    };

    const startAudit = async (tech: any) => {
        setLoading(true);
        setSelectedTech(tech);

        // Load what the tech SHOULD have
        const { data: assets } = await supabase
            .from('inventory_assets')
            .select('*, inventory_items(name)')
            .eq('current_holder_id', tech.id)
            .eq('status', 'assigned');

        if (assets) {
            const items: AuditItem[] = assets.map(a => ({
                id: a.id,
                serial_number: a.serial_number,
                item_name: a.inventory_items?.name || 'Desconocido',
                expected_status: 'assigned',
                found_status: 'pending'
            }));
            setExpectedAssets(items);
        }

        setStep('scanning');
        setLoading(false);
    };

    const handleScan = useCallback(async (serial: string) => {
        const cleanSerial = serial.trim().toUpperCase();
        if (!cleanSerial || scannedSerials.includes(cleanSerial)) return;

        setScannedSerials(prev => [cleanSerial, ...prev]);
        setManualSerial('');

        // Play feedback
        const foundInExpected = expectedAssets.find(a => a.serial_number === cleanSerial);
        if (foundInExpected) {
            setExpectedAssets(prev => prev.map(a =>
                a.serial_number === cleanSerial ? { ...a, found_status: 'found', scanned_at: new Date().toISOString() } : a
            ));
        } else {
            // Check if it exists in DB at all (Unexpected)
            const { data: globalAsset } = await supabase
                .from('inventory_assets')
                .select('*, inventory_items(name)')
                .eq('serial_number', cleanSerial)
                .maybeSingle();

            const newItem: AuditItem = {
                id: globalAsset?.id || `temp-${Date.now()}`,
                serial_number: cleanSerial,
                item_name: globalAsset?.inventory_items?.name || 'Equipo no registrado',
                expected_status: 'unknown',
                found_status: 'unexpected',
                scanned_at: new Date().toISOString()
            };
            setExpectedAssets(prev => [newItem, ...prev]);
        }
    }, [expectedAssets, scannedSerials]);

    const finishScanning = () => {
        // Mark remaining pending as missing
        const finalAssets = expectedAssets.map(a =>
            a.found_status === 'pending' ? { ...a, found_status: 'missing' } as AuditItem : a
        );
        setExpectedAssets(finalAssets);

        const summary = finalAssets.reduce((acc, curr) => {
            if (curr.found_status === 'found') acc.found++;
            if (curr.found_status === 'missing') acc.missing++;
            if (curr.found_status === 'unexpected') acc.unexpected++;
            return acc;
        }, { found: 0, missing: 0, unexpected: 0 });

        setAuditSummary(summary);
        setStep('review');
    };

    const saveAudit = async () => {
        setIsSaving(true);
        try {
            // 1. Create Audit Record
            const { data: audit, error: auditError } = await supabase
                .from('inventory_audits')
                .insert({
                    technician_id: selectedTech.id,
                    status: 'completed',
                    discrepancy_count: auditSummary.missing + auditSummary.unexpected,
                    notes: `Auditoría física realizada. Hallados: ${auditSummary.found}, Faltantes: ${auditSummary.missing}, Inesperados: ${auditSummary.unexpected}`
                })
                .select()
                .single();

            if (auditError) throw auditError;

            // 2. Insert Audit Items
            const auditItems = expectedAssets
                .filter(a => a.found_status !== 'pending')
                .map(a => ({
                    audit_id: audit.id,
                    asset_id: a.id.startsWith('temp-') ? null : a.id,
                    expected_holder_id: selectedTech.id,
                    found_status: a.found_status
                }));

            const { error: itemsError } = await supabase.from('inventory_audit_items').insert(auditItems);
            if (itemsError) throw itemsError;

            window.dispatchEvent(new CustomEvent('app:toast', {
                detail: { message: 'Auditoría guardada correctamente', type: 'success' }
            }));
            resetAudit();
        } catch (error: any) {
            console.error(error);
            window.dispatchEvent(new CustomEvent('app:toast', {
                detail: { message: 'Error al guardar: ' + error.message, type: 'error' }
            }));
        } finally {
            setIsSaving(false);
        }
    };

    const resetAudit = () => {
        setStep('selection');
        setSelectedTech(null);
        setExpectedAssets([]);
        setScannedSerials([]);
    };

    if (loading && step === 'selection') {
        return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-inner">
                    <ClipboardCheck className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-4xl font-black uppercase tracking-tight">Auditoría de Vehículos</h1>
                <p className="text-muted-foreground font-medium">Conciliación física de stock por técnico en tiempo real.</p>
            </div>

            {/* Step Selection */}
            {step === 'selection' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
                    {technicians.map(tech => (
                        <button
                            key={tech.id}
                            onClick={() => startAudit(tech)}
                            className="bg-card border-2 border-border p-6 rounded-[2rem] hover:border-primary hover:bg-primary/5 transition-all text-left group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                    <Users className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                                </div>
                                <div>
                                    <p className="font-black uppercase tracking-tight text-foreground">{tech.full_name}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Iniciar Toma Física</p>
                                </div>
                                <ChevronRight className="ml-auto w-5 h-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Step Scanning */}
            {step === 'scanning' && (
                <div className="space-y-6 animate-in zoom-in-95">
                    <div className="bg-primary text-white p-6 rounded-[2.5rem] shadow-xl shadow-primary/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-2xl shadow-inner">
                                <QrCode size={32} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase opacity-60">Auditando a:</p>
                                <h2 className="text-2xl font-black uppercase">{selectedTech?.full_name}</h2>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="text-center bg-white/10 px-6 py-2 rounded-2xl border border-white/20 backdrop-blur-md">
                                <p className="text-[10px] font-black uppercase opacity-60">Escaneados</p>
                                <p className="text-2xl font-black">{scannedSerials.length}</p>
                            </div>
                            <div className="text-center bg-white/10 px-6 py-2 rounded-2xl border border-white/20 backdrop-blur-md">
                                <p className="text-[10px] font-black uppercase opacity-60">Esperados</p>
                                <p className="text-2xl font-black">{expectedAssets.filter(a => a.expected_status === 'assigned').length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative group">
                        <input
                            type="text"
                            value={manualSerial}
                            autoFocus
                            onChange={(e) => setManualSerial(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleScan(manualSerial)}
                            placeholder="ESCANEÉ AHORA O INGRESE SERIAL..."
                            className="w-full bg-card border-2 border-border rounded-3xl py-6 px-10 text-2xl font-black placeholder:text-muted-foreground/30 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all shadow-xl"
                        />
                        <button
                            onClick={() => handleScan(manualSerial)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-primary text-white rounded-2xl"
                        >
                            <Search size={24} />
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <History size={14} /> Recién Escaneados
                            </h3>
                            <button onClick={finishScanning} className="text-xs font-black uppercase text-primary hover:underline">Finalizar Escaneo →</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {expectedAssets.filter(a => a.found_status === 'found' || a.found_status === 'unexpected').slice(0, 4).map(asset => (
                                <div key={asset.id} className={clsx(
                                    "p-4 rounded-2xl border flex items-center gap-4 animate-in slide-in-from-left-4",
                                    asset.found_status === 'found' ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/5 border-amber-500/20"
                                )}>
                                    <div className={clsx(
                                        "p-2 rounded-lg",
                                        asset.found_status === 'found' ? "bg-emerald-500/20 text-emerald-500" : "bg-amber-500/20 text-amber-500"
                                    )}>
                                        {asset.found_status === 'found' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-xs uppercase truncate">{asset.serial_number}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{asset.item_name}</p>
                                    </div>
                                    <span className="text-[8px] font-black uppercase opacity-40">OK</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Step Review */}
            {step === 'review' && (
                <div className="space-y-8 animate-in slide-in-from-right-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-emerald-500/10 border-2 border-emerald-500/20 p-6 rounded-3xl text-center">
                            <p className="text-3xl font-black text-emerald-500 leading-none mb-1">{auditSummary.found}</p>
                            <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Encontrados</p>
                        </div>
                        <div className="bg-red-500/10 border-2 border-red-500/20 p-6 rounded-3xl text-center">
                            <p className="text-3xl font-black text-red-500 leading-none mb-1">{auditSummary.missing}</p>
                            <p className="text-[10px] font-black uppercase text-red-600 tracking-widest">Faltantes</p>
                        </div>
                        <div className="bg-amber-500/10 border-2 border-amber-500/20 p-6 rounded-3xl text-center">
                            <p className="text-3xl font-black text-amber-500 leading-none mb-1">{auditSummary.unexpected}</p>
                            <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Inesperados</p>
                        </div>
                    </div>

                    <div className="bg-card border-2 border-border rounded-[2.5rem] overflow-hidden shadow-sm">
                        <div className="p-8 border-b border-border bg-muted/20">
                            <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Resumen Detallado</h3>
                        </div>
                        <div className="divide-y divide-border">
                            {expectedAssets.sort((a, b) => a.found_status.localeCompare(b.found_status)).map(asset => (
                                <div key={asset.id} className="p-6 flex items-center justify-between hover:bg-muted/10 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={clsx(
                                            "w-10 h-10 rounded-xl flex items-center justify-center",
                                            asset.found_status === 'found' ? "bg-emerald-500/10 text-emerald-500" :
                                                asset.found_status === 'missing' ? "bg-red-500/10 text-red-500" :
                                                    "bg-amber-500/10 text-amber-500"
                                        )}>
                                            {asset.found_status === 'found' ? <CheckCircle2 size={20} /> :
                                                asset.found_status === 'missing' ? <XCircle size={20} /> :
                                                    <AlertTriangle size={20} />}
                                        </div>
                                        <div>
                                            <p className="font-black text-sm uppercase">{asset.serial_number}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{asset.item_name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={clsx(
                                            "px-3 py-1 text-[10px] font-black uppercase rounded-full border",
                                            asset.found_status === 'found' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                asset.found_status === 'missing' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                    "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                        )}>
                                            {asset.found_status === 'found' ? 'Confirmado' :
                                                asset.found_status === 'missing' ? 'No hallado' :
                                                    'No era de él'}
                                        </span>
                                        {!asset.id.startsWith('temp-') && (
                                            <button
                                                onClick={() => setSelectedAssetForHistory(asset)}
                                                className="p-2 text-muted-foreground hover:text-primary transition-colors"
                                            >
                                                <History size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => setStep('scanning')}
                            className="px-8 py-4 bg-muted text-foreground text-xs font-black uppercase rounded-2xl hover:bg-muted/80 transition-all"
                        >
                            ← Volver a Escanear
                        </button>
                        <button
                            onClick={saveAudit}
                            disabled={isSaving}
                            className="flex-1 py-4 bg-primary text-white text-xs font-black uppercase rounded-2xl shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-3"
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            Guardar y Finalizar Auditoría
                        </button>
                    </div>
                </div>
            )}

            <AssetHistoryModal
                isOpen={!!selectedAssetForHistory}
                onClose={() => setSelectedAssetForHistory(null)}
                assetId={selectedAssetForHistory?.id}
                serialNumber={selectedAssetForHistory?.serial_number}
            />
        </div>
    );
}
